import { z } from "zod"
import { requireCaseAccess, requireRole } from "@/lib/server/auth"
import { recordEvent } from "@/lib/server/events"
import { latestRecommendation, nextVersion } from "@/lib/server/readiness-service"
import { prisma } from "@/lib/server/db"
import { handle, ok, parseJson, tidakDitemukan } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const Body = z.object({
  isi: z.string().trim().min(1, "Isi rekomendasi tidak boleh kosong."),
  alasanPerubahan: z.string().trim().min(1, "Alasan perubahan wajib diisi."),
})

/**
 * PUT /api/kasus/[kode]/rekomendasi — `data-contract.md` §3.5.
 *
 * MEMBUAT BARIS BARU, tidak pernah menimpa (`recommendation` append-only,
 * `handoff-backend.md` §2). `AI-DRAFT-01` tetap tersimpan dan tetap bisa
 * diambil lewat `versiSebelumnya` di `GET .../draft`.
 */
export async function PUT(request: Request, context: { params: Promise<{ kode: string }> }) {
  return handle(async () => {
    const user = await requireRole("PETUGAS")
    const { kode } = await context.params
    const kasus = await requireCaseAccess(kode, user)
    const body = await parseJson(request, Body)

    const latest = await latestRecommendation(kasus.id)
    if (!latest) {
      throw tidakDitemukan("Draft belum tersedia. Kasus ini belum dikirim untuk ditinjau.")
    }

    const versi = await nextVersion(kasus.id, "OFFICER")

    await prisma.$transaction(async (tx) => {
      await tx.recommendation.create({
        data: {
          caseId: kasus.id,
          versi,
          sumber: "OFFICER",
          isi: body.isi,
          ringkasan: latest.ringkasan,
          tahap: latest.tahap,
          tahapPenjelasan: latest.tahapPenjelasan,
          keyakinan: latest.keyakinan,
          alasanReview: latest.alasanReview,
          alasanPerubahan: body.alasanPerubahan,
          dibuatOlehId: user.id,
          fakta: { create: latest.fakta.map((f) => ({ label: f.label, nilai: f.nilai, asal: f.asal, dikonfirmasi: f.dikonfirmasi })) },
          belumDiketahui: { create: latest.belumDiketahui.map((u) => ({ teks: u.teks, dimensiTerkait: u.dimensiTerkait })) },
          sumberReferensi: {
            create: latest.sumberReferensi.map((s) => ({ judul: s.judul, penerbit: s.penerbit, tahun: s.tahun, mendukung: s.mendukung, url: s.url })),
          },
        },
      })
      await recordEvent(tx, {
        caseId: kasus.id,
        tipe: "REKOMENDASI_DIEDIT",
        ringkasan: `Petugas mengedit rekomendasi: ${body.alasanPerubahan}`,
        aktorId: user.id,
        aktorLabel: user.namaLengkap,
        peranAktor: "PETUGAS",
        versi,
      })
    })

    return ok({ versi, sumber: "OFFICER" })
  })
}
