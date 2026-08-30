/**
 * Mesin status enam dimensi — `docs/user-flow.md` §7.2.
 *
 * DETERMINISTIK. Tidak ada LLM di sini, tidak ada skor, tidak ada rata-rata.
 * Aturan dievaluasi berurutan; yang pertama cocok menang. Setiap cabang bisa
 * ditunjuk baris per baris ke dokumen — itu memang tujuannya.
 */

import { DIMENSION_ORDER, type Dimension, type DimensionStatus } from "@/lib/types"
import {
  NOT_OWNED,
  UNKNOWN,
  asNumber,
  asText,
  asList,
  includesOption,
  isEmpty,
  isFilled,
  type AnswerMap,
} from "./questions"

const TIDAK_TAHU = new Set([UNKNOWN, "Belum tahu"])

/** Terisi dengan nilai nyata (bukan "Belum tahu" / "Saya belum tahu" / "Belum punya"). */
function concreteText(value: unknown): boolean {
  const text = typeof value === "string" ? value.trim() : Array.isArray(value) ? "" : ""
  if (text === "") return false
  return !TIDAK_TAHU.has(text) && text !== NOT_OWNED
}

// ---------------------------------------------------------------------------
// §7.2 — satu fungsi per dimensi
// ---------------------------------------------------------------------------

export function statusLegalitas(a: AnswerMap): DimensionStatus {
  const legal = a["legal-entity"]
  const usia = a["business-age"]

  if (includesOption(legal, NOT_OWNED)) return "blocked"
  if (isFilled(legal) && isFilled(usia) && asText(usia) !== UNKNOWN) return "ready"
  if (isFilled(legal)) return "pending"
  return "idle"
}

export function statusProduk(a: AnswerMap): DimensionStatus {
  const produk = a["product-ready"]
  const standar = asText(a["has-standard"])
  const kapasitas = asNumber(a["monthly-capacity"])

  if (isEmpty(produk)) return "idle"
  if (standar === "Ya" && kapasitas !== null) return "ready"
  return "pending"
}

export function statusPasar(a: AnswerMap): DimensionStatus {
  const pasar = asText(a["target-market"])
  const buyer = asText(a["buyer-status"])

  // Dokumen menulis "Belum tahu"; pertanyaan ini juga mengizinkan
  // "Saya belum tahu" lewat supportsUnknown. Keduanya berarti sama.
  if (pasar === "" || TIDAK_TAHU.has(pasar)) return "idle"
  if (buyer === "Sudah ada PO / permintaan") return "ready"
  if (buyer === "Sudah ada percakapan") return "working"
  return "pending"
}

export function statusHsLartas(a: AnswerMap): DimensionStatus {
  const hs = a["hs-code"]
  const lartas = a["lartas-check"]
  const detail = asText(a["lartas-detail"])

  if (isEmpty(hs) && isEmpty(lartas)) return "idle"
  if (detail === "Termasuk — perlu izin") return "blocked"

  // Tidak pernah `ready` dari jawaban UMKM saja. HS Code dan status Lartas yang
  // dilaporkan sendiri tetap wajib divalidasi petugas — PRD #3.
  return "officer"
}

export function statusDokumen(a: AnswerMap): DimensionStatus {
  const docs = a["export-docs"]
  const peb = asText(a["peb-familiar"])

  if (isEmpty(docs)) return "idle"
  if (includesOption(docs, NOT_OWNED) && peb !== "Ya") return "blocked"

  const dokumenNyata = asList(docs).filter((item) => item !== NOT_OWNED)
  if (dokumenNyata.length >= 3 && peb === "Ya") return "ready"
  return "pending"
}

export function statusEksekusi(a: AnswerMap): DimensionStatus {
  const kirim = a["shipping-method"]
  const partner = a["export-partner"]

  if (isEmpty(kirim) && isEmpty(partner)) return "idle"

  const kirimText = asText(kirim)
  const partnerNyata = asList(partner).filter((item) => item !== NOT_OWNED && item !== UNKNOWN)

  if (TIDAK_TAHU.has(kirimText) && includesOption(partner, NOT_OWNED)) return "idle"
  if (concreteText(kirimText) && partnerNyata.length > 0) return "ready"
  return "working"
}

// ---------------------------------------------------------------------------
// Agregat
// ---------------------------------------------------------------------------

const RULES: Record<Dimension, (a: AnswerMap) => DimensionStatus> = {
  legalitas: statusLegalitas,
  produk: statusProduk,
  pasar: statusPasar,
  "hs-lartas": statusHsLartas,
  dokumen: statusDokumen,
  eksekusi: statusEksekusi,
}

export type DimensionStatusMap = Record<Dimension, DimensionStatus>

/** Selalu enam dimensi, selalu urutan kanonis. */
export function computeReadiness(answers: AnswerMap): DimensionStatusMap {
  const result = {} as DimensionStatusMap
  for (const dimensi of DIMENSION_ORDER) result[dimensi] = RULES[dimensi](answers)
  return result
}
