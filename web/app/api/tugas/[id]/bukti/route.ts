import { prisma } from "@/lib/server/db"
import { requireRole } from "@/lib/server/auth"
import { recordEvent } from "@/lib/server/events"
import { toEvidenceFile } from "@/lib/server/mappers"
import { signedUrls, unggahBerkas, validasiBerkas } from "@/lib/server/storage"
import { ApiError, handle, ok, tidakDitemukan } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/tugas/[id]/bukti — `data-contract.md` §3.7.
 * `multipart/form-data`, field `berkas[]`. Maks 5 × 5 MB, `pdf/jpg/jpeg/png/zip`.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireRole("UMKM")
    const { id } = await context.params

    const task = await prisma.task.findUnique({
      where: { id },
      include: { case: { select: { id: true, businessId: true } } },
    })
    if (!task || !user.businessIds.includes(task.case.businessId)) {
      throw tidakDitemukan("Tugas tidak ditemukan.")
    }

    const form = await request.formData()
    const files = form.getAll("berkas[]").filter((v): v is File => v instanceof File && v.size > 0)
    if (files.length === 0) {
      throw new ApiError("VALIDASI_GAGAL", "Pilih minimal satu berkas untuk diunggah.")
    }
    validasiBerkas(files)
    const uploaded = await unggahBerkas(task.case.id, files)

    const aktorLabel = user.usaha?.nama ?? user.namaLengkap
    const rows = await prisma.$transaction(async (tx) => {
      const created = []
      for (const u of uploaded) {
        created.push(
          await tx.evidence.create({
            data: {
              caseId: task.case.id,
              taskId: task.id,
              namaBerkas: u.namaBerkas,
              storagePath: u.storagePath,
              tipe: u.tipe,
              ukuranBytes: u.ukuranBytes,
              diunggahOlehId: user.id,
            },
          }),
        )
      }
      await recordEvent(tx, {
        caseId: task.case.id,
        tipe: "BUKTI_DIUNGGAH",
        ringkasan: `${uploaded.length} berkas dilampirkan pada tugas "${task.judul}".`,
        aktorId: user.id,
        aktorLabel,
        peranAktor: "UMKM",
      })
      return created
    })

    const urls = await signedUrls(rows.map((r) => r.storagePath))
    return ok(rows.map((r) => toEvidenceFile(r, urls.get(r.storagePath) ?? "")))
  })
}
