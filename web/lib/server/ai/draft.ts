/**
 * Lapisan LLM — `docs/user-flow.md` §7.4.
 *
 * LLM HANYA MENULIS. Ia tidak menentukan status dimensi, tidak memilih next
 * action, tidak menyentuh transisi status. Semua itu sudah dihitung mesin
 * aturan sebelum berkas ini dipanggil, dan hasilnya dikirim sebagai fakta yang
 * tidak boleh dibantah.
 *
 * Tiga lapis pengaman, berurutan:
 *   1. Batasan keras di prompt (dilarang HS Code final, Lartas final, PEB disetujui).
 *   2. Validasi Zod atas keluaran.
 *   3. Penjaga kata terlarang atas teks yang lolos validasi.
 * Gagal di lapis mana pun → fallback deterministik. Tanpa kecuali.
 */

import { z } from "zod"
import { DIMENSION_ORDER, type Dimension } from "@/lib/types"
import type { AnswerMap } from "../engine/questions"
import { QUESTION_BY_ID } from "../engine/questions"
import type { DimensionStatusMap } from "../engine/readiness"
import type { SelectedAction } from "../engine/next-actions"
import { DIMENSION_LABEL } from "../engine/next-actions"
import { computeTahap } from "../engine/narrative"
import {
  buildAlasanReview,
  buildBelumDiketahui,
  buildFakta,
  buildFallbackDraft,
  buildSumberReferensi,
  clampKeyakinan,
  type DraftPayload,
} from "./fallback"

const TIMEOUT_MS = 20_000
const MODEL = process.env.OPENROUTER_MODEL || "minimax/minimax-m3:free"
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

// Model gratis sering gagal validasi (lihat `toleransiKeluaran` & lapis pengaman
// di bawah) tapi jarang gagal karena API itu sendiri mati. Daripada langsung
// jatuh ke fallback di percobaan pertama, ulangi sampai MAX_PERCOBAAN kali —
// baru pakai fallback deterministik kalau semuanya gagal. Jeda kecil antar
// percobaan supaya tidak membanjiri endpoint gratis dalam waktu singkat.
const MAX_PERCOBAAN = 10
const JEDA_ANTAR_PERCOBAAN_MS = 500

function tunggu(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Kontrak keluaran
// ---------------------------------------------------------------------------

const KeluaranSchema = z.object({
  ringkasan: z.string().min(10).max(400),
  isi: z.string().min(20).max(2000),
  dimensi: z
    .array(
      z.object({
        dimensi: z.enum(["legalitas", "produk", "pasar", "hs-lartas", "dokumen", "eksekusi"]),
        alasan: z.string().min(10).max(400),
        belumAda: z.string().min(5).max(400),
      }),
    )
    .length(6),
  belumDiketahui: z.string().min(5).max(400),
  keyakinan: z.enum(["rendah", "sedang", "tinggi"]),
})

// ---------------------------------------------------------------------------
// Penjaga kata terlarang (lapis 3)
// ---------------------------------------------------------------------------

const POLA_TERLARANG: { pola: RegExp; alasan: string }[] = [
  { pola: /\b\d{4}[.\s]?\d{2}(?:[.\s]?\d{2})?\b/, alasan: "menyebut nomor HS Code sebagai kesimpulan" },
  { pola: /peb\s+(?:sudah\s+)?(?:disetujui|diterima|lolos)/i, alasan: "menyatakan PEB disetujui" },
  { pola: /(?:tidak\s+)?termasuk\s+lartas\s*(?:\.|,|$)/i, alasan: "menyatakan status Lartas final" },
  { pola: /(?:dipastikan|sudah\s+pasti|final)\s+(?:tidak\s+)?(?:termasuk\s+)?lartas/i, alasan: "menyatakan status Lartas final" },
  { pola: /bebas\s+(?:dari\s+)?lartas/i, alasan: "menyatakan status Lartas final" },
]

export function periksaLarangan(teks: string): string | null {
  for (const { pola, alasan } of POLA_TERLARANG) {
    if (pola.test(teks)) return alasan
  }
  return null
}

// ---------------------------------------------------------------------------
// Toleransi bentuk keluaran model gratis
//
// Model kecil/gratis sering menaati MAKNA skema tapi bukan BENTUKnya persis:
// diverifikasi lewat pengujian nyata bahwa minimax-m3:free menulis "nama"
// alih-alih "dimensi" per elemen, dan mengirim array untuk field yang
// seharusnya string tunggal (`belumDiketahui`, `keyakinan`). Normalisasi ini
// TIDAK melonggarkan validasi Zod di bawahnya — ia cuma memetakan bentuk yang
// secara makna sama ke bentuk yang Zod harapkan sebelum divalidasi.
// ---------------------------------------------------------------------------

function ambilString(nilai: unknown): unknown {
  if (Array.isArray(nilai)) return nilai.filter((v) => typeof v === "string").join(" ")
  return nilai
}

function toleransiKeluaran(mentah: unknown): unknown {
  if (typeof mentah !== "object" || mentah === null) return mentah
  const obj = mentah as Record<string, unknown>
  const hasil: Record<string, unknown> = { ...obj }

  if (Array.isArray(obj.dimensi)) {
    hasil.dimensi = obj.dimensi.map((item) => {
      if (typeof item !== "object" || item === null) return item
      const i = item as Record<string, unknown>
      return { ...i, dimensi: i.dimensi ?? i.nama ?? i.dimension ?? i.name }
    })
  } else if (typeof obj.dimensi === "object" && obj.dimensi !== null) {
    // Kadang dikirim sebagai object berkunci nama dimensi, bukan array.
    hasil.dimensi = Object.entries(obj.dimensi as Record<string, unknown>).map(([kunci, nilai]) => {
      if (typeof nilai !== "object" || nilai === null) return { dimensi: kunci }
      const i = nilai as Record<string, unknown>
      return { ...i, dimensi: i.dimensi ?? i.nama ?? i.dimension ?? i.name ?? kunci }
    })
  }

  if ("belumDiketahui" in obj) hasil.belumDiketahui = ambilString(obj.belumDiketahui)

  const keyakinanMentah = ambilString(obj.keyakinan)
  if (typeof keyakinanMentah === "string" && !["rendah", "sedang", "tinggi"].includes(keyakinanMentah)) {
    const cocok = /tinggi/i.test(keyakinanMentah) ? "tinggi" : /sedang/i.test(keyakinanMentah) ? "sedang" : "rendah"
    hasil.keyakinan = cocok
  } else {
    hasil.keyakinan = keyakinanMentah
  }

  return hasil
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Kamu penulis narasi untuk JalurEkspor, aplikasi pendampingan ekspor UMKM Indonesia.

TUGASMU HANYA MENULIS. Status enam dimensi kesiapan dan tiga langkah prioritas SUDAH ditentukan oleh mesin aturan dan dikirim kepadamu sebagai fakta. Kamu tidak boleh mengubah, membantah, atau menambah status maupun langkah. Kamu hanya menjelaskan kenapa statusnya begitu, dengan bahasa yang dimengerti pemilik warung.

BATASAN KERAS — melanggar salah satu berarti keluaranmu dibuang:
1. DILARANG menyebut nomor HS Code apa pun sebagai kesimpulan. Kalau perlu menyinggung HS Code, sebut sebagai "klasifikasi barang yang masih perlu diperiksa petugas".
2. DILARANG menyatakan status Lartas final ("termasuk lartas", "tidak termasuk lartas", "bebas lartas"). Selalu tulis bahwa ketentuannya masih perlu dicek petugas.
3. DILARANG menyatakan PEB sudah disetujui, diterima, atau lolos.
4. DILARANG memberi kesan bahwa ini keputusan resmi kepabeanan. Ini draft pendampingan.
5. DILARANG memakai istilah teknis tanpa penjelasan singkat di kalimat yang sama. Contoh benar: "PEB, yaitu laporan ke Bea Cukai sebelum barang dikirim".

GAYA:
- Bahasa Indonesia sehari-hari, kalimat pendek, tanpa jargon konsultan.
- "ringkasan" maksimal DUA kalimat.
- "alasan" per dimensi satu kalimat, menjelaskan kenapa statusnya seperti itu.
- "belumAda" per dimensi satu kalimat, menyebut informasi atau bukti yang masih kosong.
- Jangan menyebut angka atau nama yang tidak ada di data yang dikirim.
- Jangan memakai skor, persentase, bintang, atau nilai kesiapan tunggal. Itu dilarang produk.

Balas HANYA JSON sesuai skema. Tanpa penjelasan tambahan, tanpa markdown.`

function ringkasJawaban(answers: AnswerMap): string {
  return DIMENSION_ORDER.flatMap((dimensi) =>
    Object.entries(answers)
      .filter(([id]) => QUESTION_BY_ID[id]?.dimensi === dimensi)
      .map(([id, nilai]) => {
        const teks = Array.isArray(nilai) ? nilai.join(", ") : nilai
        return `- [${dimensi}] ${QUESTION_BY_ID[id]?.title ?? id}: ${teks}`
      }),
  ).join("\n")
}

function buildUserPrompt(
  answers: AnswerMap,
  statuses: DimensionStatusMap,
  actions: SelectedAction[],
  konteks: { namaUsaha: string; produk: string; tujuan: string },
): string {
  const statusList = DIMENSION_ORDER.map(
    (dimensi) => `- ${dimensi} (${DIMENSION_LABEL[dimensi]}): ${statuses[dimensi]}`,
  ).join("\n")

  const aksiList =
    actions.length === 0
      ? "(tidak ada — semua dimensi sudah siap)"
      : actions.map((action) => `${action.urutan}. [${action.dimensi}] ${action.judul} — pemilik: ${action.owner}`).join("\n")

  return `USAHA: ${konteks.namaUsaha}
PRODUK: ${konteks.produk}
NEGARA TUJUAN: ${konteks.tujuan}

JAWABAN ASSESSMENT (satu-satunya sumber fakta; jangan menambah apa pun):
${ringkasJawaban(answers)}

STATUS ENAM DIMENSI — SUDAH FINAL, JANGAN DIUBAH:
${statusList}

Arti status: ready = siap ditinjau, pending = perlu dilengkapi, working = sedang dikerjakan, officer = perlu petugas, blocked = ada hambatan, idle = belum dimulai.

TIGA LANGKAH PRIORITAS — SUDAH DIPILIH MESIN ATURAN, JANGAN DIUBAH:
${aksiList}

Tulis JSON dengan: ringkasan, isi, dimensi (enam, urutan persis seperti daftar status di atas), belumDiketahui, keyakinan.
"isi" ditujukan untuk petugas: jelaskan urutan langkah di atas dan kenapa kasus ini perlu ditinjau manusia.`
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export type DraftContext = { namaUsaha: string; produk: string; tujuan: string }

/**
 * Satu percobaan pemanggilan OpenRouter. Tidak pernah melempar — kegagalan
 * di lapis mana pun (HTTP, parsing, Zod, kata terlarang) mengembalikan `null`
 * supaya pemanggil (`generateDraft`) bisa mencoba lagi.
 */
async function cobaSekaliDraft(
  apiKey: string,
  answers: AnswerMap,
  statuses: DimensionStatusMap,
  actions: SelectedAction[],
  konteks: DraftContext,
  fallback: DraftPayload,
): Promise<DraftPayload | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(OPENROUTER_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 4000,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserPrompt(answers, statuses, actions, konteks) },
          ],
          // `json_schema` strict mode terbukti tidak ditegakkan oleh model gratis
          // ini (skema diabaikan, keluaran dibungkus markdown, terpotong). `json_object`
          // dikombinasikan dengan instruksi skema di SYSTEM_PROMPT jauh lebih
          // andal — diverifikasi manual sebelum dipakai di sini.
          response_format: { type: "json_object" },
        }),
      })
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      console.warn(`[ai] OpenRouter HTTP ${response.status}, coba lagi`)
      return null
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: string | null }; finish_reason?: string }[]
    }
    const choice = body.choices?.[0]

    if (choice?.finish_reason === "content_filter") {
      console.warn("[ai] draft ditolak model, coba lagi")
      return null
    }

    const teks = choice?.message?.content
    if (!teks) {
      console.warn("[ai] OpenRouter tidak mengembalikan teks, coba lagi")
      return null
    }

    // Model gratis kadang membungkus JSON dalam pagar markdown walau diminta tidak.
    const bersih = teks.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "")
    const mentah = toleransiKeluaran(JSON.parse(bersih))
    const hasil = KeluaranSchema.safeParse(mentah)
    if (!hasil.success) {
      console.warn("[ai] keluaran LLM tidak lolos Zod, coba lagi:", hasil.error.issues[0]?.message)
      return null
    }

    // Lapis 3: penjaga kata terlarang atas seluruh teks yang akan tampil.
    const semuaTeks = [
      hasil.data.ringkasan,
      hasil.data.isi,
      hasil.data.belumDiketahui,
      ...hasil.data.dimensi.flatMap((item) => [item.alasan, item.belumAda]),
    ].join("\n")
    const pelanggaran = periksaLarangan(semuaTeks)
    if (pelanggaran) {
      console.warn(`[ai] keluaran LLM ${pelanggaran}, coba lagi`)
      return null
    }

    // Enam dimensi wajib lengkap; kalau ada yang hilang pakai versi fallback
    // untuk dimensi itu supaya respons tetap enam elemen urutan kanonis.
    const dariLlm = new Map<Dimension, { alasan: string; belumAda: string }>(
      hasil.data.dimensi.map((item) => [item.dimensi, { alasan: item.alasan, belumAda: item.belumAda }]),
    )
    const dimensi = DIMENSION_ORDER.map((d) => {
      const llm = dariLlm.get(d)
      const cadangan = fallback.dimensi.find((item) => item.dimensi === d)!
      return { dimensi: d, alasan: llm?.alasan ?? cadangan.alasan, belumAda: llm?.belumAda ?? cadangan.belumAda }
    })

    const tahap = computeTahap(statuses)

    return {
      ringkasan: hasil.data.ringkasan,
      // Tahap, fakta, referensi, dan alasan review TIDAK berasal dari LLM.
      tahap: tahap.tahap,
      tahapPenjelasan: tahap.tahapPenjelasan,
      isi: hasil.data.isi,
      alasanReview: buildAlasanReview(statuses),
      keyakinan: clampKeyakinan(hasil.data.keyakinan, statuses),
      dimensi,
      fakta: buildFakta(answers),
      belumDiketahui: buildBelumDiketahui(statuses, answers, hasil.data.belumDiketahui),
      sumberReferensi: buildSumberReferensi(actions),
      fallback: false,
    }
  } catch (error) {
    console.warn("[ai] pemanggilan LLM gagal, coba lagi:", error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Selalu mengembalikan draft yang bisa dipakai. Tidak pernah melempar.
 * Mengulang sampai `MAX_PERCOBAAN` kali kalau OpenRouter gagal (HTTP, parsing,
 * Zod, atau kata terlarang) — baru pakai fallback deterministik kalau semua
 * percobaan habis.
 */
export async function generateDraft(
  answers: AnswerMap,
  statuses: DimensionStatusMap,
  actions: SelectedAction[],
  konteks: DraftContext,
): Promise<DraftPayload> {
  const fallback = buildFallbackDraft(answers, statuses, actions)

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || process.env.JALUREKSPOR_DISABLE_LLM === "true") {
    return fallback
  }

  for (let percobaan = 1; percobaan <= MAX_PERCOBAAN; percobaan += 1) {
    const hasil = await cobaSekaliDraft(apiKey, answers, statuses, actions, konteks, fallback)
    if (hasil) return hasil
    console.warn(`[ai] percobaan ${percobaan}/${MAX_PERCOBAAN} gagal`)
    if (percobaan < MAX_PERCOBAAN) await tunggu(JEDA_ANTAR_PERCOBAAN_MS)
  }

  console.warn(`[ai] semua ${MAX_PERCOBAAN} percobaan OpenRouter gagal, memakai fallback`)
  return fallback
}
