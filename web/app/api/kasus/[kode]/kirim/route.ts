import type { CaseStatus } from "@/lib/types"
import { prisma } from "@/lib/server/db"
import { requireCaseAccess, requireRole } from "@/lib/server/auth"
import { requireTransition } from "@/lib/server/case-state"
import { recordEvent } from "@/lib/server/events"
import { iso } from "@/lib/server/mappers"
import { unansweredRequired } from "@/lib/server/engine/visible-questions"
import { readAllAnswers, computeAndPersist, nextVersion } from "@/lib/server/readiness-service"
import { generateDraft } from "@/lib/server/ai/draft"
import { aturanBisnis, handle, ok } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/kasus/[kode]/kirim — `data-contract.md` §3.2.
 *
 * Efek samping: hitung ulang readiness, buat draft AI `AI-DRAFT-01`, tulis
 * `case_event` DIKIRIM_TINJAUAN + DRAFT_AI_DIBUAT.
 */
export async function POST(_request: Request, context: { params: Promise<{ kode: string }> }) {
  return handle(async () => {
    const user = await requireRole("UMKM")
    const { kode } = await context.params
    const kasus = await requireCaseAccess(kode, user)

    const ke = requireTransition(kasus.status as CaseStatus, "KIRIM", "UMKM")

    const answers = await readAllAnswers(kasus.id)
    const belumTerjawab = unansweredRequired(answers)
    if (belumTerjawab.length > 0) {
      throw aturanBisnis("Masih ada pertanyaan wajib yang belum dijawab sebelum kasus bisa dikirim.", {
        belumTerjawab,
      })
    }

    const aktorLabel = user.usaha?.nama ?? user.namaLengkap
    const now = new Date()

    await prisma.$transaction(async (tx) => {
      await tx.case.update({ where: { id: kasus.id }, data: { status: ke, dikirimPada: now } })
      await recordEvent(tx, {
        caseId: kasus.id,
        tipe: "DIKIRIM_TINJAUAN",
        ringkasan: `${aktorLabel} mengirim kasus untuk ditinjau petugas.`,
        aktorId: user.id,
        aktorLabel,
        peranAktor: "UMKM",
        pada: now,
      })
    })

    const computed = await computeAndPersist(kasus.id)
    const draft = await generateDraft(computed.answers, computed.statuses, computed.actions, {
      namaUsaha: kasus.business.nama,
      produk: kasus.produk,
      tujuan: kasus.tujuan,
    })
    const versi = await nextVersion(kasus.id, "AI")

    await prisma.$transaction(async (tx) => {
      await tx.recommendation.create({
        data: {
          caseId: kasus.id,
          versi,
          sumber: "AI",
          isi: draft.isi,
          ringkasan: draft.ringkasan,
          tahap: draft.tahap,
          tahapPenjelasan: draft.tahapPenjelasan,
          keyakinan: draft.keyakinan,
          alasanReview: draft.alasanReview,
          fakta: { create: draft.fakta.map((f) => ({ label: f.label, nilai: f.nilai, asal: f.asal, dikonfirmasi: f.dikonfirmasi })) },
          belumDiketahui: { create: draft.belumDiketahui.map((u) => ({ teks: u.teks, dimensiTerkait: u.dimensiTerkait })) },
          sumberReferensi: {
            create: draft.sumberReferensi.map((s) => ({ judul: s.judul, penerbit: s.penerbit, tahun: s.tahun, mendukung: s.mendukung, url: s.url })),
          },
        },
      })
      await recordEvent(tx, {
        caseId: kasus.id,
        tipe: "DRAFT_AI_DIBUAT",
        ringkasan: "Draft rekomendasi AI dibuat, menunggu tinjauan petugas.",
        peranAktor: "SISTEM",
        versi,
      })
    })

    return ok({ status: ke, dikirimPada: iso(now) })
  })
}
