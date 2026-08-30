/**
 * Riwayat kasus (PRD #5).
 *
 * "Setiap aksi yang mengubah keadaan menulis satu `caseEvent`." Tanpa ini
 * timeline kosong dan PRD #5 tidak terbukti. Semua penulis event lewat sini
 * supaya judul dan peran aktor konsisten.
 *
 * `internal = true` hanya untuk CATATAN_PETUGAS — disaring keluar dari timeline
 * UMKM di lapisan API, bukan disembunyikan di UI.
 */

import type { Prisma } from "@prisma/client"
import type { CaseEventType, Role } from "@/lib/types"

export const JUDUL_EVENT: Record<CaseEventType, string> = {
  KASUS_DIBUAT: "Kasus dibuat",
  ASSESSMENT_SELESAI: "Assessment diselesaikan",
  DIKIRIM_TINJAUAN: "Kasus dikirim untuk ditinjau",
  DRAFT_AI_DIBUAT: "Draft AI dibuat",
  CATATAN_PETUGAS: "Catatan internal petugas",
  INFO_DIMINTA: "Petugas meminta informasi tambahan",
  INFO_DIJAWAB: "Permintaan informasi dijawab",
  REKOMENDASI_DIEDIT: "Rekomendasi diedit petugas",
  KASUS_DIESKALASI: "Kasus dieskalasi",
  RENCANA_DIKIRIM: "Rencana pendampingan dikirim",
  TUGAS_SELESAI: "Tugas ditandai selesai",
  BUKTI_DIUNGGAH: "Bukti diunggah",
}

export type EventInput = {
  caseId: string
  tipe: CaseEventType
  ringkasan: string
  judul?: string
  aktorId?: string | null
  aktorLabel?: string
  peranAktor?: Role | "SISTEM"
  versi?: string | null
  pada?: Date
}

type DbClient = Prisma.TransactionClient | { caseEvent: Prisma.CaseEventDelegate }

export async function recordEvent(db: DbClient, input: EventInput) {
  return db.caseEvent.create({
    data: {
      caseId: input.caseId,
      tipe: input.tipe,
      judul: input.judul ?? JUDUL_EVENT[input.tipe],
      aktorId: input.aktorId ?? null,
      aktorLabel: input.aktorLabel ?? "Sistem",
      peranAktor: input.peranAktor ?? "SISTEM",
      ringkasan: input.ringkasan,
      versi: input.versi ?? null,
      internal: input.tipe === "CATATAN_PETUGAS",
      ...(input.pada ? { pada: input.pada } : {}),
    },
  })
}
