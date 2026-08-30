import type { CaseStatus } from "@/lib/types"
import { prisma } from "@/lib/server/db"
import { requireRole } from "@/lib/server/auth"
import { requireTransition } from "@/lib/server/case-state"
import { recordEvent } from "@/lib/server/events"
import { unggahBerkas, validasiBerkas } from "@/lib/server/storage"
import { ApiError, handle, ok, transisiTidakValid } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const RINGKASAN_MAKS = 140

/**
 * POST /api/permintaan/[id]/jawab — `data-contract.md` §3.6.
 * `multipart/form-data`: `pesan` (text) + `berkas[]` (File, opsional).
 * Kasus kembali ke `MENUNGGU_TINJAUAN`.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireRole("UMKM")
    const { id } = await context.params

    const permintaan = await prisma.infoRequest.findUnique({
      where: { id },
      include: { case: { select: { id: true, status: true, businessId: true } } },
    })
    if (!permintaan || !user.businessIds.includes(permintaan.case.businessId)) {
      throw new ApiError("TIDAK_DITEMUKAN", "Permintaan tidak ditemukan.")
    }
    if (permintaan.status !== "TERBUKA") {
      throw transisiTidakValid("Permintaan ini sudah tidak menunggu jawaban.")
    }
    const ke = requireTransition(permintaan.case.status as CaseStatus, "JAWAB_PERMINTAAN", "UMKM")

    const form = await request.formData()
    const pesan = String(form.get("pesan") ?? "").trim()
    if (pesan === "") {
      throw new ApiError("VALIDASI_GAGAL", "Jawaban tidak boleh kosong.", { pesan: "Wajib diisi." })
    }
    const files = form.getAll("berkas[]").filter((v): v is File => v instanceof File && v.size > 0)
    validasiBerkas(files)
    const uploaded = files.length > 0 ? await unggahBerkas(permintaan.case.id, files) : []

    const aktorLabel = user.usaha?.nama ?? user.namaLengkap
    const now = new Date()

    await prisma.$transaction(async (tx) => {
      const jawaban = await tx.infoResponse.create({
        data: { requestId: permintaan.id, pesan, olehId: user.id, dibuatPada: now },
      })
      if (uploaded.length > 0) {
        await tx.evidence.createMany({
          data: uploaded.map((u) => ({
            caseId: permintaan.case.id,
            infoResponseId: jawaban.id,
            namaBerkas: u.namaBerkas,
            storagePath: u.storagePath,
            tipe: u.tipe,
            ukuranBytes: u.ukuranBytes,
            diunggahOlehId: user.id,
          })),
        })
      }
      await tx.infoRequest.update({ where: { id: permintaan.id }, data: { status: "DIJAWAB", dijawabPada: now } })
      await tx.case.update({ where: { id: permintaan.case.id }, data: { status: ke } })
      await recordEvent(tx, {
        caseId: permintaan.case.id,
        tipe: "INFO_DIJAWAB",
        ringkasan: pesan.length > RINGKASAN_MAKS ? `${pesan.slice(0, RINGKASAN_MAKS - 1)}…` : pesan,
        aktorId: user.id,
        aktorLabel,
        peranAktor: "UMKM",
        pada: now,
      })
      if (uploaded.length > 0) {
        await recordEvent(tx, {
          caseId: permintaan.case.id,
          tipe: "BUKTI_DIUNGGAH",
          ringkasan: `${uploaded.length} berkas bukti diunggah bersama jawaban.`,
          aktorId: user.id,
          aktorLabel,
          peranAktor: "UMKM",
          pada: now,
        })
      }
    })

    return ok({ statusKasus: ke, redirectTo: "/umkm" })
  })
}
