import { z } from "zod"
import { DIMENSION_ORDER, type CaseStatus } from "@/lib/types"
import { prisma } from "@/lib/server/db"
import { requireCaseAccess, requireRole } from "@/lib/server/auth"
import { requireTransition } from "@/lib/server/case-state"
import { recordEvent } from "@/lib/server/events"
import { untouchedOfficerDimensions } from "@/lib/server/officer-gate"
import {
  computeAndPersist,
  latestOfficerRecommendation,
  latestRecommendation,
  nextVersion,
} from "@/lib/server/readiness-service"
import { ApiError, aturanBisnis, handle, ok, parseJson } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TaskInput = z.object({
  judul: z.string().trim().min(1),
  penjelasan: z.string().trim().min(1),
  owner: z.enum(["UMKM", "PETUGAS", "UMKM_DAN_PENDAMPING"]),
  buktiDibutuhkan: z.string().trim().min(1),
  targetSelesai: z.string().date().nullable().optional(),
})

const Body = z.object({
  ringkasanPetugas: z.string().trim().min(1, "Ringkasan wajib diisi."),
  tugas: z.array(TaskInput).min(1, "Minimal satu tugas."),
})

/**
 * POST /api/kasus/[kode]/rencana — `data-contract.md` §3.5, gerbang PRD #3.
 *
 * `422 ATURAN_BISNIS` kalau ada dimensi `officer` yang belum petugas sentuh
 * (lihat `lib/server/officer-gate.ts` untuk definisi "tersentuh").
 *
 * Kalau belum ada `Recommendation` bersumber OFFICER sama sekali (petugas
 * menyentuh gerbang lewat catatan/permintaan-info, bukan lewat edit
 * rekomendasi), satu baris OFFICER dibuat di sini dengan menyalin isi draft
 * terakhir — `buildMentoringPlan` (lib/server/plan.ts) mensyaratkan baris
 * OFFICER untuk bisa menampilkan rencana ke UMKM.
 */
export async function POST(request: Request, context: { params: Promise<{ kode: string }> }) {
  return handle(async () => {
    const user = await requireRole("PETUGAS")
    const { kode } = await context.params
    const kasus = await requireCaseAccess(kode, user)
    const ke = requireTransition(kasus.status as CaseStatus, "KIRIM_RENCANA", "PETUGAS")

    const body = await parseJson(request, Body)

    const computed = await computeAndPersist(kasus.id)
    const officerDims = DIMENSION_ORDER.filter((d) => computed.statuses[d] === "officer")
    const dimensiBelumDitinjau = await untouchedOfficerDimensions(kasus.id, [...officerDims])
    if (dimensiBelumDitinjau.length > 0) {
      throw aturanBisnis(
        `Dimensi ${dimensiBelumDitinjau.join(", ")} belum ditinjau. Tambahkan catatan, edit rekomendasi, atau minta informasi terlebih dulu.`,
        { dimensiBelumDitinjau },
      )
    }

    let officerRec = await latestOfficerRecommendation(kasus.id)
    if (!officerRec) {
      const dasar = await latestRecommendation(kasus.id)
      if (!dasar) {
        throw new ApiError("KESALAHAN_SERVER", "Draft rekomendasi belum ada untuk kasus ini.")
      }
      const versi = await nextVersion(kasus.id, "OFFICER")
      officerRec = await prisma.recommendation.create({
        data: {
          caseId: kasus.id,
          versi,
          sumber: "OFFICER",
          isi: dasar.isi,
          ringkasan: dasar.ringkasan,
          tahap: dasar.tahap,
          tahapPenjelasan: dasar.tahapPenjelasan,
          keyakinan: dasar.keyakinan,
          alasanReview: dasar.alasanReview,
          alasanPerubahan: "Ditinjau dan disetujui tanpa perubahan teks sebelum rencana dikirim.",
          dibuatOlehId: user.id,
        },
      })
    }

    const now = new Date()

    await prisma.$transaction(async (tx) => {
      await tx.case.update({
        where: { id: kasus.id },
        data: { status: ke, ditinjauOlehId: user.id, ditinjauPada: now },
      })
      await tx.recommendation.update({
        where: { id: officerRec!.id },
        data: { ringkasanPetugas: body.ringkasanPetugas },
      })
      await tx.task.createMany({
        data: body.tugas.map((t, index) => ({
          caseId: kasus.id,
          recommendationId: officerRec!.id,
          urutan: index + 1,
          judul: t.judul,
          penjelasan: t.penjelasan,
          owner: t.owner,
          buktiDibutuhkan: t.buktiDibutuhkan,
          targetSelesai: t.targetSelesai ? new Date(t.targetSelesai) : null,
          versi: officerRec!.versi,
        })),
      })
      await recordEvent(tx, {
        caseId: kasus.id,
        tipe: "RENCANA_DIKIRIM",
        ringkasan: body.ringkasanPetugas,
        aktorId: user.id,
        aktorLabel: user.namaLengkap,
        peranAktor: "PETUGAS",
        versi: officerRec!.versi,
        pada: now,
      })
    })

    return ok({
      statusKasus: ke,
      versi: officerRec.versi,
      ditinjauOleh: { nama: user.namaLengkap, pada: now.toISOString() },
    })
  })
}
