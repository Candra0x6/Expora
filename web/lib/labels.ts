/**
 * JalurEkspor — satu-satunya tempat label Bahasa Indonesia dan pemformatan tanggal.
 *
 * Backend mengirim kode enum (`"ready"`, `"MENUNGGU_TINJAUAN"`) dan ISO 8601 UTC.
 * Semua penerjemahan ke teks tampilan terjadi di berkas ini — jangan menyebar
 * string label ke dalam komponen.
 */

import type {
  CaseStatus,
  Confidence,
  Dimension,
  DimensionStatus,
  NextActionBy,
  Role,
  TaskOwner,
  TaskStatus,
} from "@/lib/types"

// ---------------------------------------------------------------------------
// Dimensi
// ---------------------------------------------------------------------------

export const DIMENSION_LABEL: Record<Dimension, string> = {
  legalitas: "Legalitas Usaha",
  produk: "Produk & Kapasitas",
  pasar: "Pasar Tujuan",
  "hs-lartas": "HS & Lartas",
  dokumen: "Dokumen Ekspor",
  eksekusi: "Eksekusi Ekspor",
}

export const DIMENSION_STATUS_LABEL: Record<DimensionStatus, string> = {
  ready: "Siap Ditinjau",
  pending: "Perlu Dilengkapi",
  working: "Sedang Dikerjakan",
  officer: "Perlu Petugas",
  blocked: "Ada Hambatan",
  idle: "Belum Dimulai",
}

/** Dipindahkan dari `statusStyles` di jalurekspor-result.tsx. */
export const DIMENSION_STATUS_STYLE: Record<DimensionStatus, string> = {
  ready: "bg-[#e4eee2] text-[#4c674f]",
  pending: "bg-[#f1ead9] text-[#856d3e]",
  working: "bg-[#e5eaf0] text-[#4d637b]",
  officer: "bg-[#ece5f0] text-[#715b7f]",
  blocked: "bg-[#f2e2de] text-[#915b4f]",
  idle: "bg-[#ecece8] text-black/50",
}

/** Titik penanda ringkas (dipakai daftar area di layar kirim). */
export const DIMENSION_STATUS_DOT: Record<DimensionStatus, string> = {
  ready: "bg-[#55715e]",
  pending: "bg-[#c47743]",
  working: "bg-[#4d637b]",
  officer: "bg-[#715b7f]",
  blocked: "bg-[#a75128]",
  idle: "bg-[#18251f]/25",
}

// ---------------------------------------------------------------------------
// Kasus
// ---------------------------------------------------------------------------

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  DRAFT: "Draft",
  MENUNGGU_TINJAUAN: "Menunggu Tinjauan",
  MENUNGGU_UMKM: "Menunggu UMKM",
  ESKALASI: "Eskalasi",
  RENCANA_TERKIRIM: "Rencana Terkirim",
  SELESAI: "Selesai",
}

export const CASE_STATUS_STYLE: Record<CaseStatus, string> = {
  DRAFT: "bg-[#ecece8] text-[#18251f]/60",
  MENUNGGU_TINJAUAN: "bg-[#f0e6d7] text-[#8d572e]",
  MENUNGGU_UMKM: "bg-[#e5eaf0] text-[#4d637b]",
  ESKALASI: "bg-[#f3e3dc] text-[#a75128]",
  RENCANA_TERKIRIM: "bg-[#e7ebe3] text-[#4c674f]",
  SELESAI: "bg-[#e4eee2] text-[#3e5730]",
}

export const ROLE_LABEL: Record<Role, string> = {
  UMKM: "Pemilik usaha",
  PETUGAS: "Petugas",
}

/**
 * Badge "siapa yang harus bertindak sekarang" (PRD #5). Teksnya netral supaya
 * label yang sama benar di dashboard UMKM maupun di antrean petugas.
 */
export function nextActionByLabel(value: NextActionBy): string {
  if (value === "UMKM") return "Giliran UMKM"
  if (value === "PETUGAS") return "Giliran petugas"
  return "Tidak ada aksi tertunda"
}

export function nextActionByStyle(value: NextActionBy): string {
  if (value === "UMKM") return "bg-[#f0e6d7] text-[#8d572e]"
  if (value === "PETUGAS") return "bg-[#e5eaf0] text-[#4d637b]"
  return "bg-[#e4eee2] text-[#3e5730]"
}

/** Aktor pada timeline kasus. */
export function actorRoleLabel(value: Role | "SISTEM"): string {
  if (value === "SISTEM") return "Sistem"
  return ROLE_LABEL[value]
}

// ---------------------------------------------------------------------------
// Tugas
// ---------------------------------------------------------------------------

/** Dipindahkan dari `statusLabel` di jalurekspor-umkm-plan.tsx. */
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  OPEN: "Terbuka",
  IN_PROGRESS: "Sedang dikerjakan",
  READY_FOR_REVIEW: "Siap ditinjau",
  COMPLETED: "Selesai",
}

export const TASK_STATUS_STYLE: Record<TaskStatus, string> = {
  OPEN: "bg-black/[0.06] text-black/55",
  IN_PROGRESS: "bg-[#f4e6cc] text-[#8a6123]",
  READY_FOR_REVIEW: "bg-[#e5eaf0] text-[#4d637b]",
  COMPLETED: "bg-[#dcebdc] text-[#477047]",
}

export const TASK_OWNER_LABEL: Record<TaskOwner, string> = {
  UMKM: "Pemilik usaha",
  PETUGAS: "Petugas / pendamping",
  UMKM_DAN_PENDAMPING: "UMKM + Pendamping",
}

// ---------------------------------------------------------------------------
// Draft AI
// ---------------------------------------------------------------------------

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  rendah: "Keyakinan rendah",
  sedang: "Keyakinan sedang",
  tinggi: "Keyakinan tinggi",
}

export const CONFIDENCE_STYLE: Record<Confidence, string> = {
  rendah: "bg-[#f3e3dc] text-[#a75128]",
  sedang: "bg-[#f0e6d7] text-[#8d572e]",
  tinggi: "bg-[#e4eee2] text-[#4c674f]",
}

// ---------------------------------------------------------------------------
// Tanggal & waktu — semua pemformatan id-ID terjadi di sini
// ---------------------------------------------------------------------------

const ZONA = "Asia/Jakarta"

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

/** `2026-08-30T09:14:00.000Z` → `30 Agu 2026`. */
export function formatTanggal(iso: string | null | undefined, kosong = "—"): string {
  const date = parse(iso)
  if (!date) return kosong
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: ZONA,
  }).format(date)
}

/** `2026-08-30T09:14:00.000Z` → `30 Agustus 2026`. */
export function formatTanggalPanjang(iso: string | null | undefined, kosong = "—"): string {
  const date = parse(iso)
  if (!date) return kosong
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: ZONA,
  }).format(date)
}

/** `2026-08-30T09:14:00.000Z` → `09.14`. */
export function formatWaktu(iso: string | null | undefined, kosong = "—"): string {
  const date = parse(iso)
  if (!date) return kosong
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONA,
  }).format(date)
}

/** `2026-08-30T09:14:00.000Z` → `30 Agu 2026, 09.14`. */
export function formatTanggalWaktu(iso: string | null | undefined, kosong = "—"): string {
  if (!parse(iso)) return kosong
  return `${formatTanggal(iso)}, ${formatWaktu(iso)}`
}

/** `1048576` → `1,0 MB`. */
export function formatUkuran(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`
}

/** `6` → `Menunggu 6 hari`. */
export function formatMenunggu(hari: number): string {
  return `Menunggu ${hari.toLocaleString("id-ID")} hari`
}
