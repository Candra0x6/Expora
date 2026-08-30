import { requireCaseAccess, requireUser } from "@/lib/server/auth"
import { buildTasks } from "@/lib/server/plan"
import { handle, ok } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/kasus/[kode]/tugas → `Task[]` — `data-contract.md` §3.7. */
export async function GET(_request: Request, context: { params: Promise<{ kode: string }> }) {
  return handle(async () => {
    const user = await requireUser()
    const { kode } = await context.params
    const kasus = await requireCaseAccess(kode, user)
    return ok(await buildTasks(kasus.id))
  })
}
