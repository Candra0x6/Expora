import { requireCaseAccess, requireUser } from "@/lib/server/auth"
import { buildReadinessResult } from "@/lib/server/readiness-service"
import { handle, ok } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/kasus/[kode]/kesiapan → `ReadinessResult` — `data-contract.md` §3.4. */
export async function GET(_request: Request, context: { params: Promise<{ kode: string }> }) {
  return handle(async () => {
    const user = await requireUser()
    const { kode } = await context.params
    const kasus = await requireCaseAccess(kode, user)
    return ok(await buildReadinessResult(kasus))
  })
}
