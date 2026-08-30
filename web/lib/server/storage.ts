/**
 * Unggahan bukti ke Supabase Storage, bucket privat `bukti`.
 *
 * Aturan dari data-contract §3.7: maksimal 5 berkas × 5 MB, tipe
 * `pdf, jpg, jpeg, png, zip`. Melanggar → `400`. Respons berisi metadata +
 * signed URL berumur 1 jam (bucket privat, jadi tidak ada URL permanen).
 */

import { randomUUID } from "node:crypto"
import { BUKTI_BUCKET, supabaseAdmin } from "@/lib/supabase/admin"
import { ApiError } from "./response"

export const MAKS_BERKAS = 5
export const MAKS_UKURAN = 5 * 1024 * 1024
export const SIGNED_URL_DETIK = 3600

const EKSTENSI_DIIZINKAN = ["pdf", "jpg", "jpeg", "png", "zip"] as const
const MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  zip: "application/zip",
}

export function ekstensiDari(namaBerkas: string): string {
  const bagian = namaBerkas.toLowerCase().split(".")
  return bagian.length > 1 ? bagian[bagian.length - 1] : ""
}

/** Melempar `400` dengan pesan yang layak ditampilkan langsung ke pengguna. */
export function validasiBerkas(files: File[]): void {
  if (files.length > MAKS_BERKAS) {
    throw new ApiError("VALIDASI_GAGAL", `Maksimal ${MAKS_BERKAS} berkas sekali unggah.`, {
      jumlah: files.length,
    })
  }
  for (const file of files) {
    const ext = ekstensiDari(file.name)
    if (!EKSTENSI_DIIZINKAN.includes(ext as (typeof EKSTENSI_DIIZINKAN)[number])) {
      throw new ApiError(
        "VALIDASI_GAGAL",
        `Berkas "${file.name}" tidak didukung. Format yang diterima: PDF, JPG, PNG, ZIP.`,
        { namaBerkas: file.name },
      )
    }
    if (file.size > MAKS_UKURAN) {
      throw new ApiError("VALIDASI_GAGAL", `Berkas "${file.name}" lebih dari 5 MB.`, {
        namaBerkas: file.name,
        ukuranBytes: file.size,
      })
    }
    if (file.size === 0) {
      throw new ApiError("VALIDASI_GAGAL", `Berkas "${file.name}" kosong.`, { namaBerkas: file.name })
    }
  }
}

export type UploadedFile = {
  namaBerkas: string
  storagePath: string
  tipe: string
  ukuranBytes: number
}

export async function unggahBerkas(caseId: string, files: File[]): Promise<UploadedFile[]> {
  const supabase = supabaseAdmin()
  const hasil: UploadedFile[] = []

  for (const file of files) {
    const ext = ekstensiDari(file.name)
    const path = `${caseId}/${randomUUID()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error } = await supabase.storage.from(BUKTI_BUCKET).upload(path, buffer, {
      contentType: file.type || MIME[ext] || "application/octet-stream",
      upsert: false,
    })
    if (error) {
      throw new ApiError("KESALAHAN_SERVER", `Gagal mengunggah "${file.name}". Coba lagi sebentar lagi.`)
    }

    hasil.push({
      namaBerkas: file.name,
      storagePath: path,
      tipe: ext.toUpperCase(),
      ukuranBytes: file.size,
    })
  }

  return hasil
}

/**
 * Signed URL berumur 1 jam. Bucket privat, jadi ini satu-satunya cara berkas
 * bisa dibuka — dan tautannya kedaluwarsa dengan sendirinya.
 */
export async function signedUrl(storagePath: string): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin()
      .storage.from(BUKTI_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_DETIK)
    if (error || !data) return ""
    return data.signedUrl
  } catch {
    return ""
  }
}

export async function signedUrls(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  await Promise.all(
    paths.map(async (path) => {
      out.set(path, await signedUrl(path))
    }),
  )
  return out
}

/** Membuat bucket kalau belum ada. Idempoten; dipanggil seed. */
export async function pastikanBucket(): Promise<void> {
  const supabase = supabaseAdmin()
  const { data } = await supabase.storage.getBucket(BUKTI_BUCKET)
  if (data) return
  await supabase.storage.createBucket(BUKTI_BUCKET, {
    public: false,
    fileSizeLimit: MAKS_UKURAN,
  })
}
