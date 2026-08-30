/**
 * Amplop respons — `docs/data-contract.md` §1.
 *
 * Sukses: payload langsung, tanpa pembungkus.
 * Gagal : selalu `{ error: { code, message, details? } }`.
 *
 * `message` SELALU Bahasa Indonesia dan layak ditampilkan apa adanya ke
 * pengguna. Frontend menampilkannya langsung dan tidak menyusun teks sendiri.
 */

import { NextResponse } from "next/server"
import { ZodError } from "zod"
import type { ApiErrorCode } from "@/lib/types"

const STATUS_FOR: Record<ApiErrorCode, number> = {
  VALIDASI_GAGAL: 400,
  KREDENSIAL_SALAH: 400,
  EMAIL_SUDAH_DIPAKAI: 400,
  BELUM_MASUK: 401,
  AKSES_DITOLAK: 403,
  TIDAK_DITEMUKAN: 404,
  TRANSISI_TIDAK_VALID: 409,
  ATURAN_BISNIS: 422,
  KESALAHAN_SERVER: 500,
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status })
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json(data, { status: 201 })
}

export function fail(
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    { error: details ? { code, message, details } : { code, message } },
    { status: STATUS_FOR[code] },
  )
}

/** Dilempar dari helper (auth, akses kasus) dan ditangkap `handle()`. */
export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export const belumMasuk = () => new ApiError("BELUM_MASUK", "Silakan masuk terlebih dahulu.")

export const aksesDitolak = (pesan = "Kamu tidak punya akses ke halaman ini.") =>
  new ApiError("AKSES_DITOLAK", pesan)

/** 404 juga dipakai untuk milik orang lain — jangan bocorkan keberadaan kasus. */
export const tidakDitemukan = (pesan = "Data yang kamu cari tidak ditemukan.") =>
  new ApiError("TIDAK_DITEMUKAN", pesan)

export const aturanBisnis = (pesan: string, details?: Record<string, unknown>) =>
  new ApiError("ATURAN_BISNIS", pesan, details)

export const transisiTidakValid = (pesan: string, details?: Record<string, unknown>) =>
  new ApiError("TRANSISI_TIDAK_VALID", pesan, details)

/**
 * Pembungkus setiap Route Handler. Menjamin tidak ada stack trace yang bocor
 * dan setiap kegagalan tetap memakai amplop yang sama.
 */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.code, error.message, error.details)
    }
    if (error instanceof ZodError) {
      return fail("VALIDASI_GAGAL", "Ada isian yang belum benar.", { isu: zodDetails(error) })
    }
    console.error("[api] kesalahan tak tertangani:", error)
    return fail("KESALAHAN_SERVER", "Terjadi kesalahan di server. Coba lagi sebentar lagi.")
  }
}

export function zodDetails(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_"
    if (!out[key]) out[key] = issue.message
  }
  return out
}

/** Parse body JSON dengan pesan yang layak dibaca pengguna. */
export async function parseJson<T>(
  request: Request,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: ZodError } },
): Promise<T> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    throw new ApiError("VALIDASI_GAGAL", "Isi permintaan bukan JSON yang sah.")
  }
  const hasil = schema.safeParse(raw)
  if (!hasil.success) {
    throw new ApiError("VALIDASI_GAGAL", "Ada isian yang belum benar.", {
      isu: zodDetails(hasil.error),
    })
  }
  return hasil.data
}
