/**
 * Middleware — dua tugas (`docs/user-flow.md` §4).
 *
 * 1. Menyegarkan sesi Supabase pada setiap navigasi, supaya cookie httpOnly
 *    tidak kedaluwarsa di tengah demo.
 * 2. Menjaga rute SEBELUM halaman dirender.
 *
 * Role dibaca dari `user_metadata.role` pada JWT, bukan dari database. Alasannya
 * teknis: middleware Next.js berjalan di runtime Edge dan Prisma tidak bisa
 * dipakai di sana. `POST /api/auth/daftar` dan seed menuliskan metadata itu.
 * Otorisasi yang sebenarnya tetap ditegakkan di Route Handler (lib/server/auth.ts) —
 * middleware hanya mencegah layar yang salah muncul.
 *
 * Rute `/api/**` sengaja TIDAK dijaga di sini: API menjawab 401/403 JSON sendiri
 * supaya frontend bisa menampilkan pesannya.
 */

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const RUTE_PUBLIK = ["/", "/masuk", "/daftar"]
const RUTE_UMKM = ["/umkm", "/assessment", "/hasil", "/kirim-untuk-ditinjau"]
const RUTE_PETUGAS = ["/petugas"]

function cocok(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Tanpa konfigurasi Supabase, jangan menahan siapa pun — biarkan halaman
  // tampil dan API yang menjelaskan masalahnya.
  if (!url || !anon) return response

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
      },
    },
  })

  // getUser() memvalidasi token ke server Supabase sekaligus menyegarkannya.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, search } = request.nextUrl
  const role =
    (user?.user_metadata?.role as string | undefined) ??
    (user?.app_metadata?.role as string | undefined) ??
    "UMKM"
  const dashboard = role === "PETUGAS" ? "/petugas/antrian" : "/umkm"

  const perluLogin = cocok(pathname, RUTE_UMKM) || cocok(pathname, RUTE_PETUGAS)

  if (!user && perluLogin) {
    const tujuan = request.nextUrl.clone()
    tujuan.pathname = "/masuk"
    tujuan.search = ""
    tujuan.searchParams.set("next", `${pathname}${search}`)
    return NextResponse.redirect(tujuan)
  }

  if (user && (pathname === "/masuk" || pathname === "/daftar")) {
    return NextResponse.redirect(new URL(dashboard, request.url))
  }

  if (user && role === "UMKM" && cocok(pathname, RUTE_PETUGAS)) {
    return NextResponse.redirect(new URL("/umkm", request.url))
  }

  if (user && role === "PETUGAS" && cocok(pathname, RUTE_UMKM)) {
    return NextResponse.redirect(new URL("/petugas/antrian", request.url))
  }

  void RUTE_PUBLIK
  return response
}

export const config = {
  matcher: [
    /*
     * Semua rute kecuali:
     * - /api/**            (menjawab 401/403 JSON sendiri)
     * - _next/static, _next/image, favicon, dan berkas statis
     */
    "/((?!api|_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
