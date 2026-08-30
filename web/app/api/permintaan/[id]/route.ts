import { prisma } from "@/lib/server/db"
import { requireRole } from "@/lib/server/auth"
import { toEvidenceFile } from "@/lib/server/mappers"
import { signedUrls } from "@/lib/server/storage"
import { handle, ok, tidakDitemukan } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/permintaan/[id] → `InfoRequestDetail` — `data-contract.md` §3.6. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireRole("UMKM")
    const { id } = await context.params

    const permintaan = await prisma.infoRequest.findUnique({
      where: { id },
      include: {
        case: { select: { kode: true, businessId: true } },
        officer: true,
        jawaban: { include: { evidences: true } },
      },
    })
    if (!permintaan || !user.businessIds.includes(permintaan.case.businessId)) {
      throw tidakDitemukan("Permintaan tidak ditemukan.")
    }

    let jawaban = null
    if (permintaan.jawaban) {
      const urls = await signedUrls(permintaan.jawaban.evidences.map((e) => e.storagePath))
      jawaban = {
        pesan: permintaan.jawaban.pesan,
        dijawabPada: permintaan.jawaban.dibuatPada.toISOString(),
        bukti: permintaan.jawaban.evidences.map((e) => toEvidenceFile(e, urls.get(e.storagePath) ?? "")),
      }
    }

    return ok({
      id: permintaan.id,
      kodeKasus: permintaan.case.kode,
      judul: permintaan.judul,
      pesan: permintaan.pesan,
      dariPetugas: permintaan.officer.namaLengkap,
      dibuatPada: permintaan.dibuatPada.toISOString(),
      status: permintaan.status,
      jawaban,
    })
  })
}
