/**
 * Data skenario seed — satu versi kebenaran (`docs/user-flow.md` §8).
 *
 * Dipakai oleh `prisma/seed.ts` DAN `scripts/verify-engine.ts`. Berkas ini
 * sengaja tidak mengimpor Prisma atau Supabase supaya skrip verifikasi mesin
 * aturan bisa dijalankan tanpa database.
 */

import type { AnswerMap } from "./engine/questions"

export const SEED_PASSWORD = "Demo1234!"

export type SeedAccount = {
  key: "petugas" | "lereng" | "kriya" | "batik"
  email: string
  namaLengkap: string
  role: "UMKM" | "PETUGAS"
  namaUsaha?: string
  bentukLegal?: string
  usiaTahun?: number
}

export const SEED_ACCOUNTS: SeedAccount[] = [
  {
    key: "petugas",
    email: "petugas@jalurekspor.id",
    namaLengkap: "Rina Kartika",
    role: "PETUGAS",
  },
  {
    key: "lereng",
    email: "umkm@jalurekspor.id",
    namaLengkap: "Budi Santoso",
    role: "UMKM",
    namaUsaha: "Lereng Lawu Foods",
    bentukLegal: "NIB + perorangan",
    usiaTahun: 3,
  },
  {
    key: "kriya",
    email: "kriya@jalurekspor.id",
    namaLengkap: "Aruna Wibowo",
    role: "UMKM",
    namaUsaha: "Kriya Aruna Solo",
    usiaTahun: 2,
  },
  {
    key: "batik",
    email: "batik@jalurekspor.id",
    namaLengkap: "Sekar Ayu",
    role: "UMKM",
    namaUsaha: "Batik Sembada",
    bentukLegal: "CV",
    usiaTahun: 6,
  },
]

export type SeedCase = {
  kode: string
  ownerKey: SeedAccount["key"]
  produk: string
  tujuan: string
  /** Status akhir setelah seed selesai. */
  status: "DRAFT" | "MENUNGGU_TINJAUAN" | "ESKALASI"
  /** Berapa hari lalu kasus dikirim. `null` untuk DRAFT. */
  dikirimHariLalu: number | null
  /** ISO date. */
  targetEkspor: string | null
  jawaban: AnswerMap
}

/**
 * LE-0248 — jawaban PERSIS dari `docs/user-flow.md` §8.
 * Dibiarkan DRAFT supaya demo bisa dimulai dari langkah pertama (§9).
 */
export const LERENG_ANSWERS: AnswerMap = {
  "legal-entity": "NIB + perorangan",
  "business-age": "3",
  npwp: "Saya belum tahu",
  "product-ready": "Keripik singkong original 100 g",
  "monthly-capacity": "1000",
  "has-standard": "Tidak",
  "target-market": "Singapura",
  "buyer-status": "Sudah ada percakapan",
  "target-date": "18 September 2026",
  "hs-code": "Saya belum tahu",
  "lartas-check": "Tidak",
  "export-docs": ["Belum punya"],
  "peb-familiar": "Tidak",
  "shipping-method": "Belum tahu",
  "export-partner": ["Belum punya"],
}

/** KA-0172 — dirancang supaya mesin aturan menghasilkan blocker `legalitas`. */
export const KRIYA_ANSWERS: AnswerMap = {
  "legal-entity": "Belum punya",
  "business-age": "2",
  "product-ready": "Tas anyaman pandan ukuran sedang",
  "monthly-capacity": "300",
  "has-standard": "Tidak",
  "target-market": "Jepang",
  "buyer-status": "Baru riset calon buyer",
  "hs-code": "Saya belum tahu",
  "lartas-check": "Saya belum tahu",
  "export-docs": ["Invoice"],
  "peb-familiar": "Tidak",
  "shipping-method": "Kargo laut",
  "export-partner": ["Belum punya"],
}

/** BS-0311 — dirancang supaya mesin aturan menghasilkan blocker `dokumen`. */
export const BATIK_ANSWERS: AnswerMap = {
  "legal-entity": "CV",
  "business-age": "6",
  npwp: "Ya",
  "product-ready": "Kain batik tulis 2,5 meter",
  "monthly-capacity": "400",
  "has-standard": "Ya",
  "standard-detail": ["Lainnya"],
  "target-market": "Malaysia",
  "buyer-status": "Sudah ada PO / permintaan",
  "target-date": "12 September 2026",
  "hs-code": "Ya",
  "hs-code-value": "5208.52.00",
  "lartas-check": "Tidak",
  "export-docs": ["Belum punya"],
  "peb-familiar": "Tidak",
  "shipping-method": "Kargo udara",
  "export-partner": ["PPJK / forwarder"],
  "forwarder-name": "PT Sekar Logistik",
}

export const SEED_CASES: SeedCase[] = [
  {
    kode: "LE-0248",
    ownerKey: "lereng",
    produk: "Keripik Singkong Original 100 g",
    tujuan: "Singapura",
    status: "DRAFT",
    dikirimHariLalu: null,
    targetEkspor: "2026-09-18",
    jawaban: LERENG_ANSWERS,
  },
  {
    kode: "KA-0172",
    ownerKey: "kriya",
    produk: "Tas Anyaman Pandan",
    tujuan: "Jepang",
    status: "MENUNGGU_TINJAUAN",
    dikirimHariLalu: 2,
    targetEkspor: null,
    jawaban: KRIYA_ANSWERS,
  },
  {
    kode: "BS-0311",
    ownerKey: "batik",
    produk: "Kain Batik Tulis",
    tujuan: "Malaysia",
    status: "ESKALASI",
    dikirimHariLalu: 4,
    targetEkspor: "2026-09-12",
    jawaban: BATIK_ANSWERS,
  },
]
