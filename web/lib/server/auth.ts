/**
 * Otorisasi — ditegakkan DI SINI, bukan di RLS.
 *
 * RLS di database sengaja deny-all (lihat migrasi 20260830000100). Route Handler
 * memakai service-role key yang melewatinya. Alasannya ada di handoff §1: aturan
 * di lapisan API bisa dibaca, diuji, dan dijelaskan ke juri baris per baris.
 *
 * Aturan yang paling mudah dilanggar: kasus milik orang lain menghasilkan 404,
 * BUKAN 403. Jangan bocorkan keberadaan kasus.
 */

import type { Role, SessionUser } from "@/lib/types"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { prisma } from "./db"
import { aksesDitolak, belumMasuk, tidakDitemukan } from "./response"

export type Authed = SessionUser & { businessIds: string[] }

/** `null` kalau belum masuk. Tidak pernah melempar. */
export async function getSessionUser(): Promise<Authed | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null

  const profile = await prisma.profile.findUnique({
    where: { id: data.user.id },
    include: { businesses: { orderBy: { dibuatPada: "asc" } } },
  })

  // Auth user ada tapi profilnya belum — hanya terjadi kalau pendaftaran gagal
  // di tengah jalan. Diperlakukan sebagai belum masuk supaya tidak ada state
  // setengah jadi yang bocor ke API.
  if (!profile) return null

  const usaha = profile.businesses[0]

  return {
    id: profile.id,
    email: data.user.email ?? "",
    role: profile.role as Role,
    namaLengkap: profile.namaLengkap,
    usaha: profile.role === "UMKM" && usaha ? { id: usaha.id, nama: usaha.nama } : null,
    businessIds: profile.businesses.map((business) => business.id),
  }
}

export async function requireUser(): Promise<Authed> {
  const user = await getSessionUser()
  if (!user) throw belumMasuk()
  return user
}

export async function requireRole(role: Role): Promise<Authed> {
  const user = await requireUser()
  if (user.role !== role) {
    throw aksesDitolak(
      role === "PETUGAS"
        ? "Halaman ini hanya untuk petugas."
        : "Halaman ini hanya untuk pemilik usaha.",
    )
  }
  return user
}

/** Kode kasus di URL boleh huruf kecil; database menyimpan huruf besar. */
export function normalizeKode(kode: string): string {
  return decodeURIComponent(kode).trim().toUpperCase()
}

const CASE_INCLUDE = {
  business: { include: { owner: true } },
  ditinjauOleh: true,
} as const

export type CaseWithBusiness = NonNullable<
  Awaited<ReturnType<typeof findCase>>
>

async function findCase(kode: string) {
  return prisma.case.findUnique({ where: { kode }, include: CASE_INCLUDE })
}

/**
 * Kasus + pemeriksaan kepemilikan.
 *
 * - PETUGAS boleh membuka kasus mana pun (MVP: tidak ada penugasan per kasus).
 * - UMKM hanya boleh membuka kasus milik usahanya sendiri.
 * - Kasus milik orang lain → 404 dengan pesan yang sama persis seperti kasus
 *   yang memang tidak ada.
 */
export async function requireCaseAccess(kodeRaw: string, user: Authed): Promise<CaseWithBusiness> {
  const kasus = await findCase(normalizeKode(kodeRaw))
  if (!kasus) throw tidakDitemukan("Kasus tidak ditemukan.")

  if (user.role === "UMKM" && !user.businessIds.includes(kasus.businessId)) {
    throw tidakDitemukan("Kasus tidak ditemukan.")
  }
  return kasus
}

/** Redirect setelah masuk/daftar — ditentukan server, bukan dihitung frontend. */
export function redirectForRole(role: Role): string {
  return role === "PETUGAS" ? "/petugas/antrian" : "/umkm"
}
