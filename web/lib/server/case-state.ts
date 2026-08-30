/**
 * Mesin keadaan kasus — `docs/user-flow.md` §3.
 *
 * SATU tempat. Route tidak boleh menebak transisi sendiri; kalau logikanya
 * tersebar, cepat atau lambat ada route yang mengizinkan transisi terlarang.
 *
 * Transisi di luar tabel ditolak `409 TRANSISI_TIDAK_VALID`.
 * Tidak ada aksi yang mengembalikan kasus ke `DRAFT` setelah dikirim.
 */

import type { CaseStatus, NextActionBy, Role } from "@/lib/types"
import { transisiTidakValid } from "./response"

export type CaseAction =
  | "KIRIM"
  | "MINTA_INFO"
  | "ESKALASI"
  | "KIRIM_RENCANA"
  | "JAWAB_PERMINTAAN"
  | "TUGAS_TERAKHIR_SELESAI"
  | "PERBARUI_INFORMASI"

type Transition = { dari: CaseStatus; aksi: CaseAction; oleh: Role; ke: CaseStatus }

/** Salinan langsung tabel di user-flow.md §3. Jangan tambah baris tanpa PM. */
export const TRANSITIONS: Transition[] = [
  { dari: "DRAFT", aksi: "KIRIM", oleh: "UMKM", ke: "MENUNGGU_TINJAUAN" },
  { dari: "MENUNGGU_TINJAUAN", aksi: "MINTA_INFO", oleh: "PETUGAS", ke: "MENUNGGU_UMKM" },
  { dari: "MENUNGGU_TINJAUAN", aksi: "ESKALASI", oleh: "PETUGAS", ke: "ESKALASI" },
  { dari: "MENUNGGU_TINJAUAN", aksi: "KIRIM_RENCANA", oleh: "PETUGAS", ke: "RENCANA_TERKIRIM" },
  { dari: "MENUNGGU_UMKM", aksi: "JAWAB_PERMINTAAN", oleh: "UMKM", ke: "MENUNGGU_TINJAUAN" },
  { dari: "ESKALASI", aksi: "MINTA_INFO", oleh: "PETUGAS", ke: "MENUNGGU_UMKM" },
  { dari: "ESKALASI", aksi: "KIRIM_RENCANA", oleh: "PETUGAS", ke: "RENCANA_TERKIRIM" },
  { dari: "RENCANA_TERKIRIM", aksi: "TUGAS_TERAKHIR_SELESAI", oleh: "UMKM", ke: "SELESAI" },
  { dari: "RENCANA_TERKIRIM", aksi: "PERBARUI_INFORMASI", oleh: "UMKM", ke: "MENUNGGU_TINJAUAN" },
]

const PESAN_TRANSISI: Record<CaseAction, string> = {
  KIRIM: "Kasus ini tidak bisa dikirim ulang.",
  MINTA_INFO: "Permintaan informasi hanya bisa dibuat saat kasus sedang ditinjau atau dieskalasi.",
  ESKALASI: "Kasus ini tidak bisa dieskalasi dari status saat ini.",
  KIRIM_RENCANA: "Rencana hanya bisa dikirim saat kasus sedang ditinjau atau dieskalasi.",
  JAWAB_PERMINTAAN: "Permintaan ini sudah tidak menunggu jawaban.",
  TUGAS_TERAKHIR_SELESAI: "Tugas hanya bisa diselesaikan setelah rencana dikirim.",
  PERBARUI_INFORMASI: "Informasi hanya bisa diperbarui setelah rencana dikirim.",
}

export function nextStatus(dari: CaseStatus, aksi: CaseAction, oleh: Role): CaseStatus | null {
  return TRANSITIONS.find((t) => t.dari === dari && t.aksi === aksi && t.oleh === oleh)?.ke ?? null
}

/** Melempar `409` kalau transisinya tidak ada di tabel. */
export function requireTransition(dari: CaseStatus, aksi: CaseAction, oleh: Role): CaseStatus {
  const ke = nextStatus(dari, aksi, oleh)
  if (!ke) {
    throw transisiTidakValid(PESAN_TRANSISI[aksi], { statusSaatIni: dari })
  }
  return ke
}

// ---------------------------------------------------------------------------
// Turunan status
// ---------------------------------------------------------------------------

/** `nextActionBy` DITURUNKAN dari status; tidak pernah disimpan terpisah. */
export function nextActionBy(status: CaseStatus): NextActionBy {
  switch (status) {
    case "DRAFT":
    case "MENUNGGU_UMKM":
    case "RENCANA_TERKIRIM":
      return "UMKM"
    case "MENUNGGU_TINJAUAN":
    case "ESKALASI":
      return "PETUGAS"
    case "SELESAI":
      return null
  }
}

/** Satu kalimat "apa yang harus dilakukan sekarang" untuk dashboard UMKM. */
export function aksiBerikutnya(status: CaseStatus): string {
  switch (status) {
    case "DRAFT":
      return "Lanjutkan assessment sampai selesai, lalu ajukan ke petugas."
    case "MENUNGGU_TINJAUAN":
      return "Petugas sedang meninjau kasusmu."
    case "MENUNGGU_UMKM":
      return "Petugas meminta informasi tambahan. Jawab sekarang supaya tinjauan bisa dilanjutkan."
    case "ESKALASI":
      return "Kasus sedang diperiksa spesialis. Belum ada yang perlu kamu lakukan."
    case "RENCANA_TERKIRIM":
      return "Kerjakan tugas pada rencana pendampingan yang sudah dikirim petugas."
    case "SELESAI":
      return "Semua tugas selesai. Rencana pendampingan tetap bisa dibuka kapan saja."
  }
}

/** Rencana hanya boleh terlihat UMKM di dua status ini (user-flow §3, aturan keras). */
export function rencanaTerlihat(status: CaseStatus): boolean {
  return status === "RENCANA_TERKIRIM" || status === "SELESAI"
}

/** Selisih hari penuh sampai sekarang. Dipakai `hariMenunggu`. */
export function hariSejak(waktu: Date | null | undefined, sekarang = new Date()): number {
  if (!waktu) return 0
  const selisih = sekarang.getTime() - waktu.getTime()
  return Math.max(0, Math.floor(selisih / 86_400_000))
}

/** "Terlambat" = giliran petugas DAN sudah menunggu lebih dari 5 hari (§6.1). */
export function terlambat(status: CaseStatus, hariMenunggu: number): boolean {
  return nextActionBy(status) === "PETUGAS" && hariMenunggu > 5
}
