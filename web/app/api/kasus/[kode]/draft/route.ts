import type { RecommendationVersion } from "@/lib/types"
import { prisma } from "@/lib/server/db"
import { requireCaseAccess, requireRole } from "@/lib/server/auth"
import { latestRecommendation } from "@/lib/server/readiness-service"
import { iso } from "@/lib/server/mappers"
import { handle, ok, tidakDitemukan } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/kasus/[kode]/draft → `RecommendationDraft` — `data-contract.md` §3.5. */
export async function GET(_request: Request, context: { params: Promise<{ kode: string }> }) {
  return handle(async () => {
    const user = await requireRole("PETUGAS")
    const { kode } = await context.params
    const kasus = await requireCaseAccess(kode, user)

    const rekomendasi = await latestRecommendation(kasus.id)
    if (!rekomendasi) {
      throw tidakDitemukan("Draft belum tersedia. Kasus ini belum dikirim untuk ditinjau.")
    }

    const lainnya = await prisma.recommendation.findMany({
      where: { caseId: kasus.id, id: { not: rekomendasi.id } },
      orderBy: { dibuatPada: "asc" },
      select: { versi: true, sumber: true, dibuatPada: true },
    })
    const versiSebelumnya: RecommendationVersion[] = lainnya.map((r) => ({
      versi: r.versi,
      sumber: r.sumber,
      dibuatPada: iso(r.dibuatPada)!,
    }))

    return ok({
      versi: rekomendasi.versi,
      sumber: rekomendasi.sumber,
      isi: rekomendasi.isi,
      keyakinan: rekomendasi.keyakinan,
      alasanReview: rekomendasi.alasanReview,
      dibuatPada: iso(rekomendasi.dibuatPada),
      fakta: rekomendasi.fakta.map((f) => ({ label: f.label, nilai: f.nilai, asal: f.asal, dikonfirmasi: f.dikonfirmasi })),
      belumDiketahui: rekomendasi.belumDiketahui.map((u) => ({ teks: u.teks, dimensiTerkait: u.dimensiTerkait })),
      sumberReferensi: rekomendasi.sumberReferensi.map((s) => ({
        judul: s.judul,
        penerbit: s.penerbit,
        tahun: s.tahun,
        mendukung: s.mendukung,
        url: s.url,
      })),
      versiSebelumnya,
    })
  })
}
