/**
 * Uji sanitasi mesin aturan — `docs/handoff-backend.md` §3.2.
 *
 * Jalankan TANPA database:
 *   pnpm tsx scripts/verify-engine.ts
 *
 * Kalau keluarannya tidak cocok dengan `docs/user-flow.md`, aturannya yang
 * salah — bukan dokumennya.
 */

import { DIMENSION_ORDER, type Dimension, type DimensionStatus } from "../lib/types"
import { computeReadiness } from "../lib/server/engine/readiness"
import { selectNextActions } from "../lib/server/engine/next-actions"
import { selectBlockerDimension } from "../lib/server/engine/blocker"
import {
  visibleQuestionIds,
  unansweredRequired,
  buildAssessmentState,
} from "../lib/server/engine/visible-questions"
import { computeTahap, computeRingkasan, dimensionFacts, dimensionNarrative } from "../lib/server/engine/narrative"
import { QUESTIONS, type AnswerMap } from "../lib/server/engine/questions"
import { LERENG_ANSWERS, KRIYA_ANSWERS, BATIK_ANSWERS } from "../lib/server/seed-data"

let gagal = 0
let total = 0

function check(nama: string, aktual: unknown, harapan: unknown) {
  total += 1
  const a = JSON.stringify(aktual)
  const h = JSON.stringify(harapan)
  if (a === h) {
    console.log(`  PASS  ${nama}`)
  } else {
    gagal += 1
    console.log(`  FAIL  ${nama}`)
    console.log(`        harapan : ${h}`)
    console.log(`        aktual  : ${a}`)
  }
}

function statusLine(statuses: Record<Dimension, DimensionStatus>): string {
  return DIMENSION_ORDER.map((d) => `${d}=${statuses[d]}`).join(", ")
}

function section(judul: string) {
  console.log(`\n${judul}`)
  console.log("-".repeat(judul.length))
}

// ===========================================================================
console.log("JalurEkspor — verifikasi mesin aturan (deterministik, tanpa LLM, tanpa DB)")
console.log(`Bank pertanyaan: ${QUESTIONS.length} pertanyaan (13 dasar + 7 bersyarat)`)

// ---------------------------------------------------------------------------
section("1. Skenario seed LE-0248 — user-flow.md §7.2 & §7.3")

const statuses = computeReadiness(LERENG_ANSWERS)
console.log(`  status  : ${statusLine(statuses)}`)

check("enam status dimensi", statuses, {
  legalitas: "ready",
  produk: "pending",
  pasar: "working",
  "hs-lartas": "officer",
  dokumen: "blocked",
  eksekusi: "idle",
})

const actions = selectNextActions(statuses)
console.log(`  aksi    : ${actions.map((a) => `${a.urutan}. ${a.dimensi}`).join(" → ")}`)
check(
  "urutan next action",
  actions.map((a) => a.dimensi),
  ["produk", "hs-lartas", "dokumen"],
)
check("maksimal tiga aksi", actions.length <= 3, true)
check(
  "judul aksi cocok dengan layar /hasil",
  actions.map((a) => a.judul),
  [
    "Lengkapi bukti kesiapan produk",
    "Jadwalkan validasi HS Code & Lartas",
    "Siapkan paket dokumen ekspor dasar",
  ],
)
check(
  "owner aksi",
  actions.map((a) => a.owner),
  ["UMKM", "PETUGAS", "UMKM"],
)
check(
  "kalimat prioritas",
  actions.map((a) => a.prioritas),
  [
    "Menutup informasi paling penting di dimensi Produk & Kapasitas",
    "Membutuhkan peninjauan petugas sebelum melangkah lebih jauh",
    "Dokumen saat ini menjadi hambatan eksekusi",
  ],
)

// ---------------------------------------------------------------------------
section("2. Pertanyaan adaptif — user-flow.md §7.1")

const visibleSeed = visibleQuestionIds(LERENG_ANSWERS)
console.log(`  terlihat: ${visibleSeed.length} pertanyaan`)
check("jumlah pertanyaan terlihat untuk seed", visibleSeed.length, 15)
check(
  "pertanyaan lanjutan yang muncul",
  visibleSeed.filter((id) =>
    ["npwp", "standard-detail", "target-date", "hs-code-value", "lartas-detail", "peb-method", "forwarder-name"].includes(id),
  ),
  ["npwp", "target-date"],
)
check("semua pertanyaan wajib terjawab", unansweredRequired(LERENG_ANSWERS), [])

// Demo langkah 2: hs-code "Saya belum tahu" → "Ya" memunculkan hs-code-value.
const dgnHs: AnswerMap = { ...LERENG_ANSWERS, "hs-code": "Ya" }
check("hs-code = Ya memunculkan hs-code-value", visibleQuestionIds(dgnHs).includes("hs-code-value"), true)
check("jumlah pertanyaan naik jadi 16", visibleQuestionIds(dgnHs).length, 16)
check("hs-code-value jadi wajib yang belum terjawab", unansweredRequired(dgnHs), ["hs-code-value"])

// Dan kembali menghilang saat jawaban diubah lagi.
const balik: AnswerMap = { ...dgnHs, "hs-code": "Saya belum tahu", "hs-code-value": "2005.20.00" }
check("hs-code-value hilang lagi", visibleQuestionIds(balik).includes("hs-code-value"), false)
check("jawaban lama tidak ikut dihitung", buildAssessmentState(balik, null).jawaban["hs-code-value"], undefined)
check("progress kembali 15/15", buildAssessmentState(balik, null).progress, { terjawab: 15, total: 15 })

// Dua UMKM berbeda melihat assessment berbeda (PRD #1).
console.log(`  LE-0248 : ${visibleQuestionIds(LERENG_ANSWERS).length} pertanyaan`)
console.log(`  KA-0172 : ${visibleQuestionIds(KRIYA_ANSWERS).length} pertanyaan`)
console.log(`  BS-0311 : ${visibleQuestionIds(BATIK_ANSWERS).length} pertanyaan`)
check(
  "tiga UMKM melihat jumlah pertanyaan yang berbeda",
  new Set([
    visibleQuestionIds(LERENG_ANSWERS).length,
    visibleQuestionIds(KRIYA_ANSWERS).length,
    visibleQuestionIds(BATIK_ANSWERS).length,
  ]).size >= 2,
  true,
)

// ---------------------------------------------------------------------------
section("3. Blocker antrean petugas — user-flow.md §7.3")

check("blocker LE-0248 (bobot tertinggi = dokumen/blocked)", selectBlockerDimension(statuses), "dokumen")

const kriyaStatus = computeReadiness(KRIYA_ANSWERS)
console.log(`  KA-0172 : ${statusLine(kriyaStatus)}`)
check("blocker KA-0172 = legalitas (§8)", selectBlockerDimension(kriyaStatus), "legalitas")

const batikStatus = computeReadiness(BATIK_ANSWERS)
console.log(`  BS-0311 : ${statusLine(batikStatus)}`)
check("blocker BS-0311 = dokumen (§8)", selectBlockerDimension(batikStatus), "dokumen")

check(
  "BS-0311 hanya menghasilkan dua aksi (empat dimensi sudah ready)",
  selectNextActions(batikStatus).map((a) => a.dimensi),
  ["hs-lartas", "dokumen"],
)

// ---------------------------------------------------------------------------
section("4. Tabel template lengkap — tidak ada (dimensi, status) yang kosong")

const semuaStatus: DimensionStatus[] = ["blocked", "officer", "pending", "working", "idle"]
let templateHilang = 0
for (const dimensi of DIMENSION_ORDER) {
  for (const status of semuaStatus) {
    const palsu = Object.fromEntries(DIMENSION_ORDER.map((d) => [d, "ready"])) as Record<Dimension, DimensionStatus>
    palsu[dimensi] = status
    try {
      const hasil = selectNextActions(palsu)
      if (hasil.length !== 1 || hasil[0].dimensi !== dimensi) templateHilang += 1
      dimensionNarrative(dimensi, status, LERENG_ANSWERS)
    } catch {
      templateHilang += 1
    }
  }
}
check("30 kombinasi (dimensi, status) punya template aksi + narasi", templateHilang, 0)

// ---------------------------------------------------------------------------
section("5. Narasi deterministik (fallback tanpa LLM)")

const tahap = computeTahap(statuses)
console.log(`  tahap    : ${tahap.tahap}`)
console.log(`  ringkasan: ${computeRingkasan(statuses, actions)}`)
check("tahap LE-0248", tahap.tahap, "Pemetaan hambatan")
check(
  "ringkasan LE-0248",
  computeRingkasan(statuses, actions),
  "Fondasi usaha sudah ada. Fokus berikutnya adalah melengkapi bukti produk, memvalidasi klasifikasi, dan menyiapkan dokumen dasar.",
)
check("fakta legalitas", dimensionFacts("legalitas", LERENG_ANSWERS), [
  "NIB + perorangan",
  "Usaha berjalan 3 tahun",
])
check("fakta hs-lartas", dimensionFacts("hs-lartas", LERENG_ANSWERS), [
  "HS Code belum diketahui",
  "Status barang belum dicek",
])
check(
  "alasan dokumen/blocked",
  dimensionNarrative("dokumen", "blocked", LERENG_ANSWERS).alasan,
  "Dokumen transaksi dan kepabeanan belum pernah disiapkan untuk pengiriman ekspor.",
)

// ---------------------------------------------------------------------------
section("6. Invarian yang tidak boleh dilanggar")

// hs-lartas tidak pernah `ready` hanya dari jawaban UMKM (PRD #3).
let pernahReady = false
const nilaiUji = ["Ya", "Tidak", "Saya belum tahu", ""]
for (const hs of nilaiUji) {
  for (const lartas of nilaiUji) {
    for (const detail of ["", "Tidak termasuk Lartas", "Termasuk — perlu izin", "Belum jelas"]) {
      const a: AnswerMap = { "hs-code": hs, "lartas-check": lartas, "lartas-detail": detail, "hs-code-value": "2005.20.00" }
      if (computeReadiness(a)["hs-lartas"] === "ready") pernahReady = true
    }
  }
}
check("hs-lartas tidak pernah `ready` dari jawaban UMKM saja", pernahReady, false)

// Tidak pernah lebih dari tiga aksi, apa pun kombinasi statusnya.
let terlaluBanyak = 0
const kombinasi: DimensionStatus[] = ["blocked", "officer", "pending", "working", "idle", "ready"]
for (let i = 0; i < 400; i += 1) {
  const palsu = Object.fromEntries(
    DIMENSION_ORDER.map((d) => [d, kombinasi[Math.floor(Math.random() * kombinasi.length)]]),
  ) as Record<Dimension, DimensionStatus>
  if (selectNextActions(palsu).length > 3) terlaluBanyak += 1
}
check("400 kombinasi acak: tidak pernah > 3 aksi", terlaluBanyak, 0)

// Assessment kosong → semua idle kecuali yang aturannya memang beda.
check("assessment kosong → semua idle", computeReadiness({}), {
  legalitas: "idle",
  produk: "idle",
  pasar: "idle",
  "hs-lartas": "idle",
  dokumen: "idle",
  eksekusi: "idle",
})

// ===========================================================================
console.log("")
console.log("=".repeat(60))
if (gagal === 0) {
  console.log(`LOLOS — ${total}/${total} pemeriksaan.`)
  process.exit(0)
} else {
  console.log(`GAGAL — ${gagal} dari ${total} pemeriksaan tidak lolos.`)
  process.exit(1)
}
