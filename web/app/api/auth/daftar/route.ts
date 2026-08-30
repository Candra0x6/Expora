import { z } from "zod"
import type { AuthResult } from "@/lib/types"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/server/db"
import { redirectForRole } from "@/lib/server/auth"
import { ApiError, created, handle, parseJson } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const Body = z.object({
  namaPemilik: z.string().trim().min(2, "Nama pemilik minimal 2 karakter."),
  namaUsaha: z.string().trim().min(2, "Nama usaha minimal 2 karakter."),
  email: z.string().trim().email("Format email belum benar."),
  password: z.string().min(8, "Password minimal 8 karakter."),
})

/**
 * POST /api/auth/daftar — hanya membuat akun UMKM.
 * Petugas tidak bisa mendaftar sendiri; akunnya di-seed (user-flow §2).
 *
 * Satu pendaftaran = auth user + profile + business. Kalau bagian Prisma gagal,
 * auth user yang terlanjur dibuat dihapus lagi supaya tidak ada akun yatim yang
 * bisa login tapi tidak punya profil.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseJson(request, Body)
    const admin = supabaseAdmin()

    const { data, error } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true, // Tidak ada verifikasi email di MVP (user-flow §5.1).
      user_metadata: { role: "UMKM", namaLengkap: body.namaPemilik },
    })

    if (error || !data.user) {
      const pesan = error?.message?.toLowerCase() ?? ""
      if (pesan.includes("already") || pesan.includes("registered") || pesan.includes("exists")) {
        throw new ApiError("EMAIL_SUDAH_DIPAKAI", "Email ini sudah terdaftar. Coba masuk saja.")
      }
      throw new ApiError("KESALAHAN_SERVER", "Pendaftaran gagal. Coba lagi sebentar lagi.")
    }

    try {
      await prisma.$transaction([
        prisma.profile.create({
          data: { id: data.user.id, role: "UMKM", namaLengkap: body.namaPemilik },
        }),
        prisma.business.create({
          data: { ownerId: data.user.id, nama: body.namaUsaha },
        }),
      ])
    } catch (dbError) {
      await admin.auth.admin.deleteUser(data.user.id).catch(() => undefined)
      throw dbError
    }

    // Langsung masuk setelah daftar — cookie sesi ikut di-set di sini.
    const supabase = await createSupabaseServerClient()
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    })
    if (loginError) {
      throw new ApiError("KESALAHAN_SERVER", "Akun berhasil dibuat, tetapi gagal masuk otomatis. Silakan masuk manual.")
    }

    const hasil: AuthResult = { role: "UMKM", redirectTo: redirectForRole("UMKM") }
    return created(hasil)
  })
}
