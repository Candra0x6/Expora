/**
 * Bank pertanyaan assessment.
 *
 * 13 pertanyaan dasar disalin PERSIS dari `components/jalurekspor-assessment.tsx`
 * (baris 37–51) — id, title, type, options, glossary, placeholder, description,
 * supportsUnknown, supportsNotOwned dipertahankan apa adanya.
 *
 * 7 pertanyaan lanjutan bersyarat dari `docs/user-flow.md` §7.1. Predikat
 * `condition` dievaluasi di SERVER dan tidak pernah dikirim ke klien
 * (lihat `Question` di lib/types.ts yang memang tidak punya field itu).
 *
 * Urutan array ini adalah urutan tampil: dimensi kanonis, lalu urutan definisi.
 */

import type { Dimension, Question } from "@/lib/types"

export type AnswerValue = string | string[]
export type AnswerMap = Record<string, AnswerValue>

export type ServerQuestion = Question & {
  /** Hanya ada pada pertanyaan lanjutan. Tidak pernah diserialisasi. */
  condition?: (answers: AnswerMap) => boolean
}

export const ASSESSMENT_VERSION = "v1.0"

export const UNKNOWN = "Saya belum tahu"
export const NOT_OWNED = "Belum punya"

// ---------------------------------------------------------------------------
// Helper pembacaan jawaban — dipakai juga oleh readiness.ts
// ---------------------------------------------------------------------------

/** Jawaban dianggap kosong kalau tidak ada, string kosong, atau array kosong. */
export function isEmpty(value: AnswerValue | undefined | null): boolean {
  if (value === undefined || value === null) return true
  if (Array.isArray(value)) return value.length === 0
  return value.trim() === ""
}

export function isFilled(value: AnswerValue | undefined | null): boolean {
  return !isEmpty(value)
}

/** Nilai skalar; array dikembalikan sebagai string kosong. */
export function asText(value: AnswerValue | undefined | null): string {
  if (typeof value === "string") return value.trim()
  return ""
}

export function asList(value: AnswerValue | undefined | null): string[] {
  if (Array.isArray(value)) return value
  if (typeof value === "string" && value.trim() !== "") return [value]
  return []
}

/** `true` kalau jawaban (skalar atau multi) memuat opsi tersebut. */
export function includesOption(value: AnswerValue | undefined | null, option: string): boolean {
  if (Array.isArray(value)) return value.includes(option)
  return asText(value) === option
}

/** `true` kalau jawaban terisi dan bukan salah satu jawaban "tidak tahu / belum punya". */
export function isConcrete(value: AnswerValue | undefined | null): boolean {
  if (isEmpty(value)) return false
  const list = asList(value).filter((item) => item !== UNKNOWN && item !== NOT_OWNED)
  return list.length > 0
}

/** Angka positif dari jawaban number/text. `null` kalau bukan angka. */
export function asNumber(value: AnswerValue | undefined | null): number | null {
  const text = asText(value).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".")
  if (text === "") return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

// ---------------------------------------------------------------------------
// Pertanyaan
// ---------------------------------------------------------------------------

const q = (input: Partial<ServerQuestion> & Pick<ServerQuestion, "id" | "dimensi" | "section" | "title" | "type">): ServerQuestion => ({
  description: null,
  options: null,
  placeholder: null,
  glossary: null,
  supportsUnknown: false,
  supportsNotOwned: false,
  wajib: true,
  ...input,
})

export const QUESTIONS: ServerQuestion[] = [
  // --- legalitas ----------------------------------------------------------
  q({
    id: "legal-entity",
    dimensi: "legalitas",
    section: "Legalitas usaha",
    title: "Apa bentuk legalitas usaha yang saat ini dimiliki?",
    type: "select",
    options: ["NIB + perorangan", "CV", "PT", "Koperasi"],
    supportsNotOwned: true,
  }),
  q({
    id: "business-age",
    dimensi: "legalitas",
    section: "Legalitas usaha",
    title: "Berapa lama usaha ini sudah berjalan?",
    description: "Masukkan usia usaha dalam tahun. Jawab berdasarkan operasional komersial pertama.",
    type: "number",
    placeholder: "Contoh: 3",
    supportsUnknown: true,
  }),
  q({
    id: "npwp",
    dimensi: "legalitas",
    section: "Legalitas usaha",
    title: "Apakah usaha sudah memiliki NPWP?",
    type: "yesno",
    glossary: [
      {
        term: "NPWP",
        definition:
          "Nomor Pokok Wajib Pajak, identitas pajak usaha. Sering diminta saat mengurus dokumen ekspor dan pembayaran dari buyer luar negeri.",
      },
    ],
    supportsUnknown: true,
    condition: (a) => isFilled(a["legal-entity"]) && !includesOption(a["legal-entity"], NOT_OWNED),
  }),

  // --- produk -------------------------------------------------------------
  q({
    id: "product-ready",
    dimensi: "produk",
    section: "Produk & kapasitas",
    title: "Produk mana yang paling siap untuk diekspor?",
    description: "Pilih satu produk utama dulu. Produk lain dapat dipetakan setelah assessment selesai.",
    type: "text",
    placeholder: "Contoh: Keripik singkong original 100 g",
  }),
  q({
    id: "monthly-capacity",
    dimensi: "produk",
    section: "Produk & kapasitas",
    title: "Berapa kapasitas produksi per bulan?",
    description: "Gunakan satuan kemasan produk utama.",
    type: "number",
    placeholder: "Contoh: 1000",
    supportsUnknown: true,
  }),
  q({
    id: "has-standard",
    dimensi: "produk",
    section: "Produk & kapasitas",
    title: "Apakah produk sudah memiliki standar kualitas dan umur simpan?",
    type: "yesno",
    supportsUnknown: true,
  }),
  q({
    id: "standard-detail",
    dimensi: "produk",
    section: "Produk & kapasitas",
    title: "Standar atau sertifikasi apa yang sudah dimiliki?",
    type: "multi",
    options: ["BPOM / PIRT", "Halal", "HACCP", "ISO 22000", "Uji umur simpan", "Lainnya"],
    condition: (a) => asText(a["has-standard"]) === "Ya",
  }),

  // --- pasar --------------------------------------------------------------
  q({
    id: "target-market",
    dimensi: "pasar",
    section: "Pasar tujuan",
    title: "Negara mana yang ingin menjadi tujuan ekspor pertama?",
    type: "select",
    options: ["Singapura", "Malaysia", "Jepang", "Australia", "Uni Eropa", "Belum tahu"],
    supportsUnknown: true,
  }),
  q({
    id: "buyer-status",
    dimensi: "pasar",
    section: "Pasar tujuan",
    title: "Seberapa jauh hubungan dengan calon pembeli di negara tujuan?",
    type: "select",
    options: ["Sudah ada PO / permintaan", "Sudah ada percakapan", "Baru riset calon buyer", "Belum punya"],
    supportsNotOwned: true,
  }),
  q({
    id: "target-date",
    dimensi: "pasar",
    section: "Pasar tujuan",
    title: "Kapan target pengiriman pertama?",
    description: "Perkiraan saja tidak masalah. Tanggal ini dipakai petugas untuk menilai urgensi.",
    type: "text",
    placeholder: "Contoh: 18 September 2026",
    supportsUnknown: true,
    condition: (a) => {
      const status = asText(a["buyer-status"])
      return status === "Sudah ada PO / permintaan" || status === "Sudah ada percakapan"
    },
  }),

  // --- hs-lartas ----------------------------------------------------------
  q({
    id: "hs-code",
    dimensi: "hs-lartas",
    section: "HS Code & Lartas",
    title: "Apakah sudah mengetahui HS Code produk?",
    type: "yesno",
    glossary: [
      {
        term: "HS Code",
        definition:
          "Kode klasifikasi barang yang dipakai secara internasional untuk menentukan tarif dan aturan impor.",
      },
    ],
    supportsUnknown: true,
  }),
  q({
    id: "hs-code-value",
    dimensi: "hs-lartas",
    section: "HS Code & Lartas",
    title: "Berapa HS Code produknya?",
    description: "Tulis apa adanya. Nomor ini tetap akan diperiksa ulang oleh petugas.",
    type: "text",
    placeholder: "Contoh: 2005.20.00",
    supportsUnknown: true,
    condition: (a) => asText(a["hs-code"]) === "Ya",
  }),
  q({
    id: "lartas-check",
    dimensi: "hs-lartas",
    section: "HS Code & Lartas",
    title: "Apakah sudah mengecek apakah produk termasuk barang Lartas?",
    type: "yesno",
    glossary: [
      {
        term: "Lartas",
        definition:
          "Barang yang dilarang dan/atau dibatasi untuk diekspor atau diimpor, sehingga memerlukan aturan atau izin tambahan.",
      },
    ],
    supportsUnknown: true,
  }),
  q({
    id: "lartas-detail",
    dimensi: "hs-lartas",
    section: "HS Code & Lartas",
    title: "Apa hasil pengecekan ketentuan Lartas?",
    type: "select",
    options: ["Tidak termasuk Lartas", "Termasuk — perlu izin", "Belum jelas"],
    condition: (a) => asText(a["lartas-check"]) === "Ya",
  }),

  // --- dokumen ------------------------------------------------------------
  q({
    id: "export-docs",
    dimensi: "dokumen",
    section: "Dokumen ekspor",
    title: "Dokumen ekspor apa yang sudah tersedia?",
    type: "multi",
    options: ["Invoice", "Packing list", "COO / SKA", "Sertifikat halal", "Sertifikat kesehatan", "Belum punya"],
    supportsNotOwned: true,
  }),
  q({
    id: "peb-familiar",
    dimensi: "dokumen",
    section: "Dokumen ekspor",
    title: "Apakah sudah pernah membuat PEB?",
    type: "yesno",
    glossary: [
      {
        term: "PEB",
        definition:
          "Pemberitahuan Ekspor Barang, yaitu dokumen kepabeanan yang disampaikan kepada Bea Cukai sebelum barang diekspor.",
      },
    ],
    supportsUnknown: true,
  }),
  q({
    id: "peb-method",
    dimensi: "dokumen",
    section: "Dokumen ekspor",
    title: "Bagaimana PEB sebelumnya diurus?",
    type: "select",
    options: ["Sendiri via CEISA", "Melalui PPJK atau forwarder", "Melalui pihak lain"],
    glossary: [
      {
        term: "CEISA",
        definition:
          "Sistem daring Bea Cukai tempat dokumen kepabeanan seperti PEB disampaikan secara elektronik.",
      },
    ],
    condition: (a) => asText(a["peb-familiar"]) === "Ya",
  }),

  // --- eksekusi -----------------------------------------------------------
  q({
    id: "shipping-method",
    dimensi: "eksekusi",
    section: "Eksekusi ekspor",
    title: "Bagaimana rencana pengiriman ekspor pertama?",
    type: "select",
    options: ["Kurir / parcel", "Kargo udara", "Kargo laut", "Belum tahu"],
    supportsUnknown: true,
  }),
  q({
    id: "export-partner",
    dimensi: "eksekusi",
    section: "Eksekusi ekspor",
    title: "Siapa yang akan membantu proses ekspor?",
    type: "multi",
    options: ["PPJK / forwarder", "Konsultan ekspor", "Buyer mengurus impor", "Tim internal", "Belum punya"],
    supportsNotOwned: true,
  }),
  q({
    id: "forwarder-name",
    dimensi: "eksekusi",
    section: "Eksekusi ekspor",
    title: "Siapa nama PPJK / forwarder-nya?",
    type: "text",
    placeholder: "Contoh: PT Cakra Logistik",
    supportsUnknown: true,
    condition: (a) => includesOption(a["export-partner"], "PPJK / forwarder"),
  }),
]

export const QUESTION_BY_ID: Record<string, ServerQuestion> = Object.fromEntries(
  QUESTIONS.map((question) => [question.id, question]),
)

export function dimensiOf(questionId: string): Dimension | null {
  return QUESTION_BY_ID[questionId]?.dimensi ?? null
}
