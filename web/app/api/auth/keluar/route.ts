import { createSupabaseServerClient } from "@/lib/supabase/server"
import { handle, ok } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** POST /api/auth/keluar — menghapus cookie sesi. Selalu 200, walau belum masuk. */
export async function POST() {
  return handle(async () => {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.signOut()
    return ok({ redirectTo: "/masuk" })
  })
}
