/**
 * Pemetaan baris database → bentuk yang dijanjikan `docs/data-contract.md`.
 *
 * Semua tanggal-waktu keluar sebagai ISO 8601 UTC. Backend tidak pernah
 * mengirim tanggal yang sudah diformat — frontend yang memformat ke id-ID.
 * `targetEkspor` dan `targetSelesai` keluar sebagai ISO date `YYYY-MM-DD`.
 */

import type {
  CaseBlocker,
  CaseEvent,
  CaseListItem,
  Dimension,
  DimensionStatus,
  EvidenceFile,
  InfoRequestSummary,
  Role,
  Task,
  TaskOwner,
  TaskStatus,
} from "@/lib/types"
import { aksiBerikutnya, hariSejak, nextActionBy, terlambat } from "./case-state"
import { buildBlocker } from "./engine/blocker"

export const iso = (value: Date | null | undefined): string | null => value?.toISOString() ?? null

/** `YYYY-MM-DD` dari kolom `@db.Date`. */
export const isoDate = (value: Date | null | undefined): string | null =>
  value ? value.toISOString().slice(0, 10) : null

// ---------------------------------------------------------------------------
// Kasus
// ---------------------------------------------------------------------------

type CaseRow = {
  id: string
  kode: string
  produk: string
  tujuan: string
  status: string
  tahap: string
  targetEkspor: Date | null
  dikirimPada: Date | null
  dibuatPada: Date
  business: { nama: string }
}

type DimensionRow = { dimensi: string; status: string; alasan: string }

export function blockerFromRows(rows: DimensionRow[]): CaseBlocker | null {
  if (rows.length === 0) return null
  const statuses = {} as Record<Dimension, DimensionStatus>
  const alasan: Partial<Record<Dimension, string>> = {}
  for (const row of rows) {
    statuses[row.dimensi as Dimension] = row.status as DimensionStatus
    alasan[row.dimensi as Dimension] = row.alasan
  }
  // Dimensi yang belum pernah dihitung dianggap `idle`, bukan diabaikan.
  for (const dimensi of ["legalitas", "produk", "pasar", "hs-lartas", "dokumen", "eksekusi"] as Dimension[]) {
    if (!statuses[dimensi]) statuses[dimensi] = "idle"
  }
  return buildBlocker(statuses, alasan)
}

export function toCaseListItem(
  kasus: CaseRow,
  dimensiRows: DimensionRow[],
  permintaanInfoTerbukaId: string | null,
  sekarang = new Date(),
): CaseListItem {
  const status = kasus.status as CaseListItem["status"]
  const hariMenunggu = hariSejak(kasus.dikirimPada ?? kasus.dibuatPada, sekarang)

  return {
    id: kasus.id,
    kode: kasus.kode,
    namaUsaha: kasus.business.nama,
    produk: kasus.produk,
    tujuan: kasus.tujuan,
    status,
    nextActionBy: nextActionBy(status),
    tahap: kasus.tahap,
    blocker: blockerFromRows(dimensiRows),
    dikirimPada: iso(kasus.dikirimPada),
    hariMenunggu,
    targetEkspor: isoDate(kasus.targetEkspor),
    terlambat: terlambat(status, hariMenunggu),
    permintaanInfoTerbukaId,
    aksiBerikutnya: aksiBerikutnya(status),
  }
}

// ---------------------------------------------------------------------------
// Tugas & bukti
// ---------------------------------------------------------------------------

type EvidenceRow = {
  id: string
  namaBerkas: string
  tipe: string
  ukuranBytes: number
  diunggahPada: Date
  dikonfirmasi: boolean
}

export function toEvidenceFile(row: EvidenceRow, url: string): EvidenceFile {
  return {
    id: row.id,
    namaBerkas: row.namaBerkas,
    tipe: row.tipe,
    ukuranBytes: row.ukuranBytes,
    url,
    diunggahPada: row.diunggahPada.toISOString(),
    dikonfirmasi: row.dikonfirmasi,
  }
}

type TaskRow = {
  id: string
  urutan: number
  judul: string
  penjelasan: string
  owner: string
  buktiDibutuhkan: string
  targetSelesai: Date | null
  status: string
  versi: string
}

export function toTask(row: TaskRow, bukti: EvidenceFile[]): Task {
  return {
    id: row.id,
    urutan: row.urutan,
    judul: row.judul,
    penjelasan: row.penjelasan,
    owner: row.owner as TaskOwner,
    buktiDibutuhkan: row.buktiDibutuhkan,
    targetSelesai: isoDate(row.targetSelesai),
    status: row.status as TaskStatus,
    versi: row.versi,
    bukti,
  }
}

// ---------------------------------------------------------------------------
// Riwayat & permintaan informasi
// ---------------------------------------------------------------------------

type EventRow = {
  id: string
  tipe: string
  judul: string
  aktorLabel: string
  peranAktor: string
  ringkasan: string
  versi: string | null
  pada: Date
}

export function toCaseEvent(row: EventRow): CaseEvent {
  return {
    id: row.id,
    tipe: row.tipe as CaseEvent["tipe"],
    judul: row.judul,
    aktor: row.aktorLabel,
    peranAktor: row.peranAktor as Role | "SISTEM",
    ringkasan: row.ringkasan,
    versi: row.versi,
    pada: row.pada.toISOString(),
  }
}

type InfoRequestRow = {
  id: string
  judul: string
  pesan: string
  status: string
  dibuatPada: Date
  officer: { namaLengkap: string }
}

export function toInfoRequestSummary(row: InfoRequestRow): InfoRequestSummary {
  return {
    id: row.id,
    judul: row.judul,
    pesan: row.pesan,
    dariPetugas: row.officer.namaLengkap,
    dibuatPada: row.dibuatPada.toISOString(),
    status: row.status as InfoRequestSummary["status"],
  }
}
