import type { SessionUser } from "@/lib/types"
import { requireUser } from "@/lib/server/auth"
import { handle, ok } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/saya → SessionUser. `usaha` selalu null untuk PETUGAS. */
export async function GET() {
  return handle(async () => {
    const user = await requireUser()
    const hasil: SessionUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      namaLengkap: user.namaLengkap,
      usaha: user.usaha,
    }
    return ok(hasil)
  })
}
