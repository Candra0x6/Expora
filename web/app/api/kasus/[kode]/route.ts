import { requireCaseAccess, requireUser } from "@/lib/server/auth"
import { buildCaseDetail } from "@/lib/server/case-detail"
import { handle, ok } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/kasus/[kode] → `CaseDetail`, bentuk disaring per role di `buildCaseDetail`. */
export async function GET(_request: Request, context: { params: Promise<{ kode: string }> }) {
  return handle(async () => {
    const user = await requireUser()
    const { kode } = await context.params
    const kasus = await requireCaseAccess(kode, user)
    return ok(await buildCaseDetail(kasus, user))
  })
}
