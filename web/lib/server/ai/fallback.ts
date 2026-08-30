/**
 * Fallback deterministik + bahan yang TIDAK PERNAH ditulis LLM.
 *
 * Dua hal berbeda hidup di berkas ini:
 *
 * 1. `buildFallbackDraft()` — draft lengkap tanpa memanggil LLM sama sekali.
 *    Dipakai saat `ANTHROPIC_API_KEY` kosong, API mati, timeout 20 detik
 *    terlampaui, atau keluaran LLM tidak lolos validasi. Halaman tidak pernah
 *    kosong hanya karena LLM mati — ini titik gagal demo yang paling mungkin.
 *
 * 2. `buildFakta()` dan `buildSumberReferensi()` — dipakai OLEH KEDUA jalur.
 *    Fakta diturunkan dari jawaban assessment dan referensi diambil dari daftar
 *    kurasi di bawah. LLM tidak boleh mengarang keduanya; referensi karangan
 *    adalah bug kredibilitas yang langsung terlihat juri.
 */

import {
  DIMENSION_ORDER,
  type Confidence,
  type Dimension,
  type DimensionStatus,
  type SourceReference,
  type SupportingFact,
  type UnknownInformation,
} from "@/lib/types"
import type { AnswerMap } from "../engine/questions"
import { NOT_OWNED, UNKNOWN, asList, asNumber, asText } from "../engine/questions"
import type { DimensionStatusMap } from "../engine/readiness"
import type { SelectedAction } from "../engine/next-actions"
import { DIMENSION_LABEL } from "../engine/next-actions"
import { computeRingkasan, computeTahap, dimensionNarrative } from "../engine/narrative"

export type DimensionNarasi = { dimensi: Dimension; alasan: string; belumAda: string }

export type DraftPayload = {
  ringkasan: string
  tahap: string
  tahapPenjelasan: string
  isi: string
  alasanReview: string
  keyakinan: Confidence
  dimensi: DimensionNarasi[]
  fakta: SupportingFact[]
  belumDiketahui: UnknownInformation[]
  sumberReferensi: SourceReference[]
  /** `true` kalau LLM tidak dipakai. Ikut ditulis ke log, bukan ke respons API. */
  fallback: boolean
}

// ---------------------------------------------------------------------------
// Fakta pendukung (PRD #3) — label, nilai, asal, dikonfirmasi
// ---------------------------------------------------------------------------

const ASAL_ASSESSMENT = "Jawaban assessment"

export function buildFakta(answers: AnswerMap): SupportingFact[] {
  const fakta: SupportingFact[] = []
  const push = (label: string, nilai: string, dikonfirmasi: boolean, asal = ASAL_ASSESSMENT) => {
    if (nilai.trim() !== "") fakta.push({ label, nilai, asal, dikonfirmasi })
  }

  const legal = asText(answers["legal-entity"])
  push("Bentuk usaha", legal === NOT_OWNED ? "Belum ada badan usaha resmi" : legal, legal !== "" && legal !== NOT_OWNED)

  const usia = asNumber(answers["business-age"])
  push("Usia usaha", usia !== null ? `${usia} tahun` : "Belum diketahui", usia !== null)

  const produk = asText(answers["product-ready"])
  push("Produk utama", produk, produk !== "")

  const kapasitas = asNumber(answers["monthly-capacity"])
  push(
    "Kapasitas",
    kapasitas !== null ? `${kapasitas.toLocaleString("id-ID")} kemasan per bulan` : "Belum diketahui",
    kapasitas !== null,
  )

  const standar = asText(answers["has-standard"])
  const detail = asList(answers["standard-detail"])
  push(
    "Standar produk",
    standar === "Ya" ? (detail.length > 0 ? detail.join(", ") : "Ada, jenisnya belum disebutkan") : "Belum ada",
    standar === "Ya" && detail.length > 0,
  )

  const buyer = asText(answers["buyer-status"])
  push("Status buyer", buyer !== "" ? buyer : "Belum diisi", buyer === "Sudah ada PO / permintaan")

  const tujuan = asText(answers["target-market"])
  push("Negara tujuan", tujuan !== "" && tujuan !== UNKNOWN ? tujuan : "Belum ditentukan", tujuan !== "" && tujuan !== UNKNOWN && tujuan !== "Belum tahu")

  // HS Code selalu `dikonfirmasi: false` — dilaporkan sendiri oleh UMKM dan
  // wajib divalidasi petugas. PRD #3.
  const hs = asText(answers["hs-code"])
  const hsNilai = asText(answers["hs-code-value"])
  push(
    "HS Code",
    hs === "Ya" && hsNilai !== "" && hsNilai !== UNKNOWN
      ? `${hsNilai} — menurut UMKM, belum divalidasi`
      : "Belum diketahui",
    false,
  )

  const peb = asText(answers["peb-familiar"])
  push("Pengalaman ekspor", peb === "Ya" ? "Sudah pernah mengurus PEB" : "Belum pernah ekspor", peb === "Ya" || peb === "Tidak")

  const docs = asList(answers["export-docs"]).filter((item) => item !== NOT_OWNED)
  push("Dokumen ekspor", docs.length > 0 ? docs.join(", ") : "Belum ada", docs.length > 0)

  const kirim = asText(answers["shipping-method"])
  push(
    "Metode kirim",
    kirim !== "" && kirim !== UNKNOWN && kirim !== "Belum tahu" ? kirim : "Belum ditentukan",
    kirim !== "" && kirim !== UNKNOWN && kirim !== "Belum tahu",
  )

  const partner = asList(answers["export-partner"]).filter((item) => item !== NOT_OWNED)
  push("Mitra ekspor", partner.length > 0 ? partner.join(", ") : "Belum ada", partner.length > 0)

  return fakta
}

// ---------------------------------------------------------------------------
// Referensi sumber — daftar kurasi. LLM tidak pernah menambah entri di sini.
// ---------------------------------------------------------------------------

const SUMBER: Record<Dimension, SourceReference> = {
  legalitas: {
    judul: "Perizinan Berusaha Berbasis Risiko (OSS)",
    penerbit: "Kementerian Investasi / BKPM",
    tahun: 2026,
    mendukung: "Penerbitan NIB dan penetapan bentuk badan usaha.",
    url: null,
  },
  produk: {
    judul: "Panduan Sertifikasi Produk Pangan Olahan",
    penerbit: "Badan POM",
    tahun: 2026,
    mendukung: "Standar mutu, umur simpan, dan izin edar produk.",
    url: null,
  },
  pasar: {
    judul: "Layanan Informasi Pasar Ekspor",
    penerbit: "Ditjen PEN, Kementerian Perdagangan",
    tahun: 2026,
    mendukung: "Profil pasar tujuan dan penelusuran calon buyer.",
    url: null,
  },
  "hs-lartas": {
    judul: "Direktorat Teknis Kepabeanan",
    penerbit: "Bea Cukai",
    tahun: 2026,
    mendukung: "Pemeriksaan HS dan ketentuan lartas.",
    url: null,
  },
  dokumen: {
    judul: "Panduan Dokumen Ekspor untuk UMKM",
    penerbit: "Kementerian Perdagangan",
    tahun: 2026,
    mendukung: "Dokumen minimum untuk pengiriman ekspor pertama.",
    url: null,
  },
  eksekusi: {
    judul: "Daftar PPJK Terdaftar",
    penerbit: "Bea Cukai",
    tahun: 2026,
    mendukung: "Pemilihan mitra pengurusan jasa kepabeanan.",
    url: null,
  },
}

export function buildSumberReferensi(actions: SelectedAction[]): SourceReference[] {
  const dipakai = actions.length > 0 ? actions.map((action) => action.dimensi) : (["hs-lartas"] as Dimension[])
  return dipakai.map((dimensi) => SUMBER[dimensi])
}

// ---------------------------------------------------------------------------
// Turunan lain
// ---------------------------------------------------------------------------

export function dimensiBelumSiap(statuses: DimensionStatusMap): Dimension[] {
  return DIMENSION_ORDER.filter((dimensi) => statuses[dimensi] !== "ready")
}

export function defaultUnknownText(statuses: DimensionStatusMap, answers: AnswerMap): string {
  const belum = dimensiBelumSiap(statuses)
  if (belum.length === 0) return "Tidak ada informasi penting yang masih kosong."
  const potongan = belum.map((dimensi) => dimensionNarrative(dimensi, statuses[dimensi], answers).belumAda)
  return potongan.slice(0, 3).join(" ")
}

export function buildBelumDiketahui(statuses: DimensionStatusMap, answers: AnswerMap, teks?: string): UnknownInformation[] {
  const dimensiTerkait = dimensiBelumSiap(statuses)
  if (dimensiTerkait.length === 0) return []
  return [{ teks: teks?.trim() || defaultUnknownText(statuses, answers), dimensiTerkait }]
}

/**
 * Alasan kenapa draft ini wajib ditinjau petugas. Selalu ada — tidak ada draft
 * yang boleh tampil tanpa penjelasan kenapa ia belum final.
 */
export function buildAlasanReview(statuses: DimensionStatusMap): string {
  if (statuses["hs-lartas"] === "blocked") {
    return "Produk terindikasi termasuk barang yang dibatasi; keputusannya tidak boleh diambil sistem."
  }
  if (statuses["hs-lartas"] === "officer") {
    return "Klasifikasi HS belum cukup pasti untuk menjadi arahan final."
  }
  const adaBlocked = DIMENSION_ORDER.find((dimensi) => statuses[dimensi] === "blocked")
  if (adaBlocked) {
    return `Ada hambatan di dimensi ${DIMENSION_LABEL[adaBlocked]} yang perlu dipastikan petugas sebelum jadi rencana.`
  }
  return "Draft ini disusun dari jawaban mandiri UMKM dan belum diperiksa petugas."
}

/**
 * Keyakinan dihitung dari status dimensi, bukan diputuskan LLM.
 * Selama HS & Lartas belum divalidasi petugas, keyakinan tidak pernah "tinggi".
 */
export function batasKeyakinan(statuses: DimensionStatusMap): Confidence {
  const values = DIMENSION_ORDER.map((dimensi) => statuses[dimensi])
  if (values.includes("blocked") || values.includes("officer")) return "rendah"
  if (values.every((status) => status === "ready")) return "tinggi"
  return "sedang"
}

const URUTAN_KEYAKINAN: Record<Confidence, number> = { rendah: 0, sedang: 1, tinggi: 2 }

/** LLM boleh menurunkan keyakinan, tidak pernah menaikkannya di atas batas. */
export function clampKeyakinan(dariLlm: Confidence, statuses: DimensionStatusMap): Confidence {
  const batas = batasKeyakinan(statuses)
  return URUTAN_KEYAKINAN[dariLlm] <= URUTAN_KEYAKINAN[batas] ? dariLlm : batas
}

/** Teks rekomendasi deterministik dari tiga aksi terpilih. */
export function buildIsi(actions: SelectedAction[]): string {
  if (actions.length === 0) {
    return "Semua dimensi kesiapan sudah terisi. Langkah berikutnya adalah memastikan bukti pendukung lengkap bersama petugas sebelum pengiriman pertama."
  }
  const langkah = actions.map((action, index) => `${index + 1}. ${action.judul} — ${action.kenapa}`)
  return `Urutan yang disarankan untuk kasus ini:\n${langkah.join("\n")}\n\nSemua langkah di atas masih perlu diperiksa petugas sebelum dijadikan rencana pendampingan final.`
}

// ---------------------------------------------------------------------------
// Draft fallback penuh
// ---------------------------------------------------------------------------

export function buildFallbackDraft(
  answers: AnswerMap,
  statuses: DimensionStatusMap,
  actions: SelectedAction[],
): DraftPayload {
  const tahap = computeTahap(statuses)

  return {
    ringkasan: computeRingkasan(statuses, actions),
    tahap: tahap.tahap,
    tahapPenjelasan: tahap.tahapPenjelasan,
    isi: buildIsi(actions),
    alasanReview: buildAlasanReview(statuses),
    // Handoff §3.3: fallback SELALU keyakinan rendah.
    keyakinan: "rendah",
    dimensi: DIMENSION_ORDER.map((dimensi) => ({
      dimensi,
      ...dimensionNarrative(dimensi, statuses[dimensi] as DimensionStatus, answers),
    })),
    fakta: buildFakta(answers),
    belumDiketahui: buildBelumDiketahui(statuses, answers),
    sumberReferensi: buildSumberReferensi(actions),
    fallback: true,
  }
}
