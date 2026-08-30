import { z } from "zod"
import type { AuthResult, Role } from "@/lib/types"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/server/db"
import { redirectForRole } from "@/lib/server/auth"
import { ApiError, handle, ok, parseJson } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const Body = z.object({
  email: z.string().trim().email("Format email belum benar."),
  password: z.string().min(1, "Password wajib diisi."),
})

/**
 * POST /api/auth/masuk
 *
 * `redirectTo` ditentukan server berdasarkan role. Frontend mengikuti dan tidak
 * menghitung sendiri — kalau frontend menebak, dua sisi bisa berbeda.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseJson(request, Body)
    const supabase = await createSupabaseServerClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    })

    // Satu pesan untuk semua kegagalan kredensial — jangan bocorkan email mana
    // yang terdaftar.
    if (error || !data.user) {
      throw new ApiError("KREDENSIAL_SALAH", "Email atau password salah.")
    }

    const profile = await prisma.profile.findUnique({ where: { id: data.user.id } })
    if (!profile) {
      await supabase.auth.signOut()
      throw new ApiError("KREDENSIAL_SALAH", "Email atau password salah.")
    }

    const role = profile.role as Role
    const hasil: AuthResult = { role, redirectTo: redirectForRole(role) }
    return ok(hasil)
  })
}
