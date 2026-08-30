import { z } from "zod"
import { DIMENSION_ORDER } from "@/lib/types"
import { prisma } from "@/lib/server/db"
import { requireCaseAccess, requireRole } from "@/lib/server/auth"
import { recordEvent } from "@/lib/server/events"
import { created, handle, parseJson } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const Body = z.object({
  isi: z.string().trim().min(1, "Catatan tidak boleh kosong."),
  dimensi: z.enum(DIMENSION_ORDER as [string, ...string[]]).optional(),
})

const RINGKASAN_MAKS = 140

/**
 * POST /api/kasus/[kode]/catatan — catatan internal petugas.
 *
 * `catatanInternal` tidak pernah masuk respons UMKM (disaring di `case-detail.ts`);
 * `caseEvent`-nya `internal = true` sehingga juga disaring dari riwayat UMKM.
 */
export async function POST(request: Request, context: { params: Promise<{ kode: string }> }) {
  return handle(async () => {
    const user = await requireRole("PETUGAS")
    const { kode } = await context.params
    const kasus = await requireCaseAccess(kode, user)
    const body = await parseJson(request, Body)

    const note = await prisma.$transaction(async (tx) => {
      const note = await tx.officerNote.create({
        data: { caseId: kasus.id, officerId: user.id, dimensi: body.dimensi ?? null, isi: body.isi },
      })
      await recordEvent(tx, {
        caseId: kasus.id,
        tipe: "CATATAN_PETUGAS",
        ringkasan: body.isi.length > RINGKASAN_MAKS ? `${body.isi.slice(0, RINGKASAN_MAKS - 1)}…` : body.isi,
        aktorId: user.id,
        aktorLabel: user.namaLengkap,
        peranAktor: "PETUGAS",
      })
      return note
    })

    return created({ id: note.id, isi: note.isi, olehNama: user.namaLengkap, dibuatPada: note.dibuatPada.toISOString() })
  })
}
