/**
 * Klien Supabase berbasis cookie, untuk Route Handler & Server Component.
 *
 * Memakai ANON key — bukan service role. Klien ini yang membaca sesi pengguna
 * dari cookie httpOnly dan yang menulis cookie saat masuk/keluar.
 *
 * Frontend tidak pernah menyentuh token; semua lewat cookie httpOnly.
 */

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Dipanggil dari Server Component yang tidak boleh menulis cookie.
          // Middleware sudah menyegarkan sesi, jadi aman diabaikan.
        }
      },
    },
  })
}

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Variabel lingkungan ${name} belum diisi. Salin web/.env.example menjadi web/.env lalu lengkapi nilainya.`,
    )
  }
  return value
}
