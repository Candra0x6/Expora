import { prisma } from "@/lib/server/db"
import { requireCaseAccess, requireUser } from "@/lib/server/auth"
import { toCaseEvent } from "@/lib/server/mappers"
import { handle, ok } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/kasus/[kode]/riwayat → `CaseEvent[]`, terbaru dulu — `data-contract.md` §3.7.
 * Timeline UMKM menghilangkan event `internal = true` (CATATAN_PETUGAS).
 */
export async function GET(_request: Request, context: { params: Promise<{ kode: string }> }) {
  return handle(async () => {
    const user = await requireUser()
    const { kode } = await context.params
    const kasus = await requireCaseAccess(kode, user)

    const events = await prisma.caseEvent.findMany({
      where: user.role === "UMKM" ? { caseId: kasus.id, internal: false } : { caseId: kasus.id },
      orderBy: { pada: "desc" },
    })

    return ok(events.map(toCaseEvent))
  })
}
