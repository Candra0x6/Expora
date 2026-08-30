/**
 * Klien service-role. HANYA boleh dipakai di Route Handler dan skrip seed.
 *
 * Service-role key melewati RLS dan bisa membuat/menghapus pengguna. Ia tidak
 * boleh pernah menyentuh klien: tanpa prefix `NEXT_PUBLIC_`, tidak pernah
 * diimpor dari komponen, tidak pernah dikirim dalam respons.
 *
 * Otorisasi ditegakkan di lib/server/auth.ts, bukan oleh kunci ini.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { requireEnv } from "./server"

let cached: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached
  cached = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cached
}

/** Bucket privat untuk unggahan bukti. */
export const BUKTI_BUCKET = "bukti"
