import { z } from "zod"
import type { CaseStatus } from "@/lib/types"
import { DIMENSION_ORDER } from "@/lib/types"
import { prisma } from "@/lib/server/db"
import { requireCaseAccess, requireRole } from "@/lib/server/auth"
import { requireTransition } from "@/lib/server/case-state"
import { recordEvent } from "@/lib/server/events"
import { created, handle, parseJson } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const Body = z.object({
  judul: z.string().trim().min(1, "Judul wajib diisi."),
  pesan: z.string().trim().min(1, "Pesan wajib diisi."),
  dimensi: z.enum(DIMENSION_ORDER as [string, ...string[]]).optional(),
})

/**
 * POST /api/kasus/[kode]/permintaan-info — `data-contract.md` §3.5.
 * Kasus → `MENUNGGU_UMKM`. `dimensi`, kalau diisi, ikut dihitung gerbang
 * officer-in-the-loop (`lib/server/officer-gate.ts`) sebagai dimensi tersentuh.
 */
export async function POST(request: Request, context: { params: Promise<{ kode: string }> }) {
  return handle(async () => {
    const user = await requireRole("PETUGAS")
    const { kode } = await context.params
    const kasus = await requireCaseAccess(kode, user)
    const ke = requireTransition(kasus.status as CaseStatus, "MINTA_INFO", "PETUGAS")
    const body = await parseJson(request, Body)

    const id = await prisma.$transaction(async (tx) => {
      const infoRequest = await tx.infoRequest.create({
        data: { caseId: kasus.id, officerId: user.id, dimensi: body.dimensi ?? null, judul: body.judul, pesan: body.pesan },
      })
      await tx.case.update({ where: { id: kasus.id }, data: { status: ke } })
      await recordEvent(tx, {
        caseId: kasus.id,
        tipe: "INFO_DIMINTA",
        ringkasan: `Petugas meminta informasi: ${body.judul}`,
        aktorId: user.id,
        aktorLabel: user.namaLengkap,
        peranAktor: "PETUGAS",
      })
      return infoRequest.id
    })

    return created({ id, statusKasus: ke })
  })
}
