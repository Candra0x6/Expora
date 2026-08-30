import { z } from "zod"
import type { CaseStatus } from "@/lib/types"
import { DIMENSION_ORDER } from "@/lib/types"
import { prisma } from "@/lib/server/db"
import { requireCaseAccess, requireRole } from "@/lib/server/auth"
import { requireTransition } from "@/lib/server/case-state"
import { recordEvent } from "@/lib/server/events"
import { handle, ok, parseJson } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const Body = z.object({
  kategori: z.enum(DIMENSION_ORDER as [string, ...string[]]),
  alasan: z.string().trim().min(1, "Alasan eskalasi wajib diisi."),
})

/** POST /api/kasus/[kode]/eskalasi — `data-contract.md` §3.5. Kasus → `ESKALASI`. */
export async function POST(request: Request, context: { params: Promise<{ kode: string }> }) {
  return handle(async () => {
    const user = await requireRole("PETUGAS")
    const { kode } = await context.params
    const kasus = await requireCaseAccess(kode, user)
    const ke = requireTransition(kasus.status as CaseStatus, "ESKALASI", "PETUGAS")
    const body = await parseJson(request, Body)

    await prisma.$transaction(async (tx) => {
      await tx.escalation.create({
        data: { caseId: kasus.id, officerId: user.id, kategori: body.kategori, alasan: body.alasan },
      })
      await tx.case.update({ where: { id: kasus.id }, data: { status: ke } })
      await recordEvent(tx, {
        caseId: kasus.id,
        tipe: "KASUS_DIESKALASI",
        ringkasan: body.alasan,
        aktorId: user.id,
        aktorLabel: user.namaLengkap,
        peranAktor: "PETUGAS",
      })
    })

    return ok({ statusKasus: ke })
  })
}
