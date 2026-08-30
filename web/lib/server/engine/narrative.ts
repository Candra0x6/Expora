/**
 * Narasi deterministik: alasan, fakta pendukung, "belum ada", tahap, ringkasan.
 *
 * Ini yang dipakai kalau LLM tidak dipanggil, gagal, timeout, atau keluarannya
 * tidak lolos validasi. Semua kalimat sudah dalam Bahasa Indonesia awam dan
 * layak tampil apa adanya — bukan placeholder.
 *
 * Tidak ada satu pun kalimat di sini yang menyatakan HS Code final, status
 * Lartas final, atau PEB disetujui. Itu batasan PRD #3.
 */

import { DIMENSION_ORDER, type Dimension, type DimensionStatus } from "@/lib/types"
import {
  NOT_OWNED,
  UNKNOWN,
  asList,
  asNumber,
  asText,
  includesOption,
  isFilled,
  type AnswerMap,
} from "./questions"
import type { DimensionStatusMap } from "./readiness"
import type { SelectedAction } from "./next-actions"

// ---------------------------------------------------------------------------
// Fakta pendukung per dimensi — diturunkan dari jawaban, bukan dikarang.
// ---------------------------------------------------------------------------

function factsLegalitas(a: AnswerMap): string[] {
  const out: string[] = []
  const legal = asText(a["legal-entity"])
  if (legal === NOT_OWNED) out.push("Belum ada badan usaha resmi")
  else if (legal !== "") out.push(legal)

  const usia = asNumber(a["business-age"])
  if (usia !== null) out.push(`Usaha berjalan ${usia} tahun`)
  else if (asText(a["business-age"]) === UNKNOWN) out.push("Usia usaha belum diketahui")

  const npwp = asText(a["npwp"])
  if (npwp === "Ya") out.push("NPWP sudah dimiliki")
  else if (npwp === "Tidak") out.push("NPWP belum dimiliki")

  return out
}

function factsProduk(a: AnswerMap): string[] {
  const out: string[] = []
  const produk = asText(a["product-ready"])
  if (produk !== "") out.push(produk)

  const kapasitas = asNumber(a["monthly-capacity"])
  if (kapasitas !== null) out.push(`Kapasitas ${kapasitas.toLocaleString("id-ID")} kemasan / bulan`)
  else if (asText(a["monthly-capacity"]) === UNKNOWN) out.push("Kapasitas produksi belum diketahui")

  if (asText(a["has-standard"]) === "Ya") {
    const detail = asList(a["standard-detail"])
    out.push(detail.length > 0 ? `Standar dimiliki: ${detail.join(", ")}` : "Standar kualitas sudah ada")
  }

  return out
}

function factsPasar(a: AnswerMap): string[] {
  const out: string[] = []
  const tujuan = asText(a["target-market"])
  if (tujuan !== "" && tujuan !== UNKNOWN) out.push(`Tujuan: ${tujuan}`)

  const buyer = asText(a["buyer-status"])
  const buyerLabel: Record<string, string> = {
    "Sudah ada PO / permintaan": "Sudah ada PO / permintaan dari buyer",
    "Sudah ada percakapan": "Sudah ada percakapan dengan calon buyer",
    "Baru riset calon buyer": "Masih tahap riset calon buyer",
    [NOT_OWNED]: "Belum ada calon buyer",
  }
  if (buyerLabel[buyer]) out.push(buyerLabel[buyer])

  const target = asText(a["target-date"])
  if (target !== "" && target !== UNKNOWN) out.push(`Target pengiriman: ${target}`)

  return out
}

function factsHsLartas(a: AnswerMap): string[] {
  const out: string[] = []
  const hs = asText(a["hs-code"])
  const nilai = asText(a["hs-code-value"])
  if (hs === "Ya" && nilai !== "" && nilai !== UNKNOWN) {
    // Dilaporkan sendiri oleh UMKM — tidak pernah disajikan sebagai kesimpulan.
    out.push(`HS Code menurut UMKM: ${nilai} (belum divalidasi)`)
  } else if (hs === "Ya") {
    out.push("HS Code diklaim sudah diketahui, nomornya belum disebutkan")
  } else {
    out.push("HS Code belum diketahui")
  }

  const lartas = asText(a["lartas-check"])
  const detail = asText(a["lartas-detail"])
  if (lartas === "Ya" && detail !== "") out.push(`Hasil pengecekan mandiri: ${detail}`)
  else out.push("Status barang belum dicek")

  return out
}

function factsDokumen(a: AnswerMap): string[] {
  const out: string[] = []
  const peb = asText(a["peb-familiar"])
  if (peb === "Ya") {
    const metode = asText(a["peb-method"])
    out.push(metode !== "" ? `Pernah membuat PEB — ${metode}` : "Sudah pernah membuat PEB")
  } else {
    out.push("Belum pernah membuat PEB")
  }

  const docs = asList(a["export-docs"]).filter((item) => item !== NOT_OWNED)
  out.push(docs.length > 0 ? `Dokumen tersedia: ${docs.join(", ")}` : "Dokumen ekspor belum tersedia")

  return out
}

function factsEksekusi(a: AnswerMap): string[] {
  const out: string[] = []
  const kirim = asText(a["shipping-method"])
  if (kirim === "" || kirim === UNKNOWN || kirim === "Belum tahu") out.push("Metode pengiriman belum dipilih")
  else out.push(`Rencana kirim: ${kirim}`)

  const partner = asList(a["export-partner"]).filter((item) => item !== NOT_OWNED)
  if (partner.length === 0) {
    out.push("Belum punya partner ekspor")
  } else {
    const nama = asText(a["forwarder-name"])
    const suffix = includesOption(a["export-partner"], "PPJK / forwarder") && nama !== "" && nama !== UNKNOWN ? ` (${nama})` : ""
    out.push(`Mitra: ${partner.join(", ")}${suffix}`)
  }

  return out
}

const FACT_BUILDERS: Record<Dimension, (a: AnswerMap) => string[]> = {
  legalitas: factsLegalitas,
  produk: factsProduk,
  pasar: factsPasar,
  "hs-lartas": factsHsLartas,
  dokumen: factsDokumen,
  eksekusi: factsEksekusi,
}

export function dimensionFacts(dimensi: Dimension, answers: AnswerMap): string[] {
  return FACT_BUILDERS[dimensi](answers)
}

// ---------------------------------------------------------------------------
// Alasan + "belum ada" per (dimensi, status)
// ---------------------------------------------------------------------------

type Narasi = { alasan: string; belumAda: string }
type NarasiTable = Record<Dimension, Record<DimensionStatus, Narasi>>

function tujuanOf(a: AnswerMap): string {
  const tujuan = asText(a["target-market"])
  return tujuan !== "" && tujuan !== UNKNOWN ? tujuan : "Negara tujuan"
}

function narasiTable(a: AnswerMap): NarasiTable {
  const tujuan = tujuanOf(a)

  return {
    legalitas: {
      ready: {
        alasan: "Bentuk usaha sudah teridentifikasi dan dapat menjadi dasar pemeriksaan dokumen.",
        belumAda: "NPWP dan dokumen legal pendukung belum dikonfirmasi.",
      },
      pending: {
        alasan: "Bentuk usaha sudah disebutkan, tetapi data pendukungnya belum lengkap.",
        belumAda: "Lama usaha berjalan dan salinan dokumen legalitas.",
      },
      working: {
        alasan: "Pengurusan legalitas sedang berjalan dan belum tuntas.",
        belumAda: "Nomor atau dokumen hasil pengurusan yang sudah terbit.",
      },
      officer: {
        alasan: "Dokumen legalitas perlu dicocokkan langsung oleh petugas.",
        belumAda: "Salinan dokumen legalitas yang bisa diperiksa keasliannya.",
      },
      blocked: {
        alasan: "Usaha belum memiliki badan atau izin usaha yang tercatat.",
        belumAda: "NIB atau bentuk badan usaha resmi.",
      },
      idle: {
        alasan: "Bagian legalitas usaha belum diisi sama sekali.",
        belumAda: "Bentuk badan usaha dan lama usaha berjalan.",
      },
    },

    produk: {
      ready: {
        alasan: "Produk utama dan kapasitas produksinya sudah jelas dan saling konsisten.",
        belumAda: "Salinan dokumen standar mutu masih perlu dilampirkan.",
      },
      pending: {
        alasan: "Produk utama sudah jelas, namun kesiapan mutu dan kapasitas ekspor masih perlu bukti.",
        belumAda: "Standar kualitas dan umur simpan belum tersedia.",
      },
      working: {
        alasan: "Sertifikasi produk sedang diproses dan belum terbit.",
        belumAda: "Nomor pengajuan dan perkiraan tanggal terbit sertifikat.",
      },
      officer: {
        alasan: "Kesiapan mutu produk perlu ditinjau bersama pendamping.",
        belumAda: "Hasil uji laboratorium dan keterangan umur simpan produk.",
      },
      blocked: {
        alasan: "Produk yang akan diekspor belum ditetapkan.",
        belumAda: "Nama produk utama beserta ukuran kemasannya.",
      },
      idle: {
        alasan: "Bagian produk dan kapasitas belum diisi sama sekali.",
        belumAda: "Produk utama dan kapasitas produksi per bulan.",
      },
    },

    pasar: {
      ready: {
        alasan: `${tujuan} sudah dipilih dan calon buyer sudah mengirim permintaan tertulis.`,
        belumAda: "Kesepakatan volume, harga, dan jadwal pengiriman.",
      },
      pending: {
        alasan: `${tujuan} sudah dipilih, tetapi hubungan dengan calon buyer masih di tahap awal.`,
        belumAda: "Calon buyer yang bersedia melanjutkan pembicaraan.",
      },
      working: {
        alasan: `${tujuan} dipilih sebagai pasar awal dengan percakapan buyer yang sudah berjalan.`,
        belumAda: "PO atau permintaan tertulis belum tersedia.",
      },
      officer: {
        alasan: "Pemilihan pasar tujuan perlu dibahas bersama pendamping.",
        belumAda: "Profil calon buyer dan perkiraan volume permintaan.",
      },
      blocked: {
        alasan: "Negara tujuan ekspor belum bisa ditetapkan.",
        belumAda: "Satu negara tujuan beserta alasan pemilihannya.",
      },
      idle: {
        alasan: "Negara tujuan ekspor belum dipilih.",
        belumAda: "Negara tujuan pertama dan calon buyer yang sedang didekati.",
      },
    },

    "hs-lartas": {
      ready: {
        alasan: "Klasifikasi barang sudah diperiksa dan dicatat petugas.",
        belumAda: "Catatan pemeriksaan terbaru kalau produk berubah.",
      },
      pending: {
        alasan: "Keterangan produk belum cukup untuk mulai memeriksa klasifikasi barang.",
        belumAda: "Komposisi bahan, proses produksi, dan foto kemasan.",
      },
      working: {
        alasan: "Pemeriksaan klasifikasi barang sedang berjalan dan belum selesai.",
        belumAda: "Hasil akhir pemeriksaan dari petugas.",
      },
      officer: {
        alasan: "Klasifikasi dan ketentuan komoditas membutuhkan validasi oleh petugas atau pendamping.",
        belumAda: "HS Code dan hasil pengecekan ketentuan barang.",
      },
      blocked: {
        alasan: "Produk terindikasi termasuk barang yang dibatasi sehingga memerlukan izin tambahan.",
        belumAda: "Izin dari instansi terkait sebelum barang boleh dikirim.",
      },
      idle: {
        alasan: "Bagian HS Code dan ketentuan barang belum diisi sama sekali.",
        belumAda: "Informasi awal HS Code dan hasil pengecekan ketentuan barang.",
      },
    },

    dokumen: {
      ready: {
        alasan: "Dokumen inti sudah tersedia dan pemberitahuan ekspor pernah diurus sebelumnya.",
        belumAda: "Kesesuaian isi antar dokumen belum diperiksa petugas.",
      },
      pending: {
        alasan: "Sebagian dokumen ekspor sudah ada, tetapi paketnya belum lengkap.",
        belumAda: "Dokumen yang masih kurang beserta salinannya.",
      },
      working: {
        alasan: "Dokumen ekspor sedang disiapkan dan belum selesai dirapikan.",
        belumAda: "Draft invoice dan packing list versi final.",
      },
      officer: {
        alasan: "Isi antar dokumen perlu dicocokkan oleh petugas sebelum dipakai.",
        belumAda: "Salinan dokumen yang akan dicocokkan satu per satu.",
      },
      blocked: {
        alasan: "Dokumen transaksi dan kepabeanan belum pernah disiapkan untuk pengiriman ekspor.",
        belumAda: "Invoice, packing list, COO / SKA, dan dokumen pendukung produk.",
      },
      idle: {
        alasan: "Bagian dokumen ekspor belum diisi sama sekali.",
        belumAda: "Daftar dokumen yang sudah dimiliki saat ini.",
      },
    },

    eksekusi: {
      ready: {
        alasan: "Moda pengiriman dan mitra ekspor sudah ditentukan.",
        belumAda: "Penawaran biaya dan jadwal keberangkatan belum dilampirkan.",
      },
      pending: {
        alasan: "Rencana pengiriman baru sebagian dan belum bisa dihitung biayanya.",
        belumAda: "Moda pengiriman pilihan dan calon mitra pengiriman.",
      },
      working: {
        alasan: "Sebagian keputusan pengiriman sudah diambil, sebagian lagi masih terbuka.",
        belumAda: "Mitra pengiriman atau moda kirim yang belum ditetapkan.",
      },
      officer: {
        alasan: "Alur pengiriman pertama perlu dibahas bersama pendamping.",
        belumAda: "Perkiraan volume, berat, dan target tanggal kirim.",
      },
      blocked: {
        alasan: "Belum ada pihak yang bisa menjalankan pengiriman ekspor pertama.",
        belumAda: "Daftar PPJK / forwarder yang dihubungi beserta penawarannya.",
      },
      idle: {
        alasan: "Rencana pengiriman belum diputuskan dan peran mitra ekspor masih perlu ditetapkan.",
        belumAda: "Pilihan forwarder / PPJK dan alur pengiriman pertama.",
      },
    },
  }
}

export function dimensionNarrative(
  dimensi: Dimension,
  status: DimensionStatus,
  answers: AnswerMap,
): Narasi {
  return narasiTable(answers)[dimensi][status]
}

// ---------------------------------------------------------------------------
// Tahap pendampingan
// ---------------------------------------------------------------------------

export type Tahap = { tahap: string; tahapPenjelasan: string }

/**
 * Diturunkan dari enam status, dievaluasi berurutan. Bukan skor, bukan rata-rata.
 */
export function computeTahap(statuses: DimensionStatusMap): Tahap {
  const values = DIMENSION_ORDER.map((dimensi) => statuses[dimensi])

  if (values.every((status) => status === "ready")) {
    return {
      tahap: "Siap eksekusi",
      tahapPenjelasan: "Dokumen dan mitra sudah siap; tinggal menjalankan pengiriman pertama.",
    }
  }
  if (values.includes("blocked")) {
    return {
      tahap: "Pemetaan hambatan",
      tahapPenjelasan: "Mengurai hambatan yang menahan proses sebelum melangkah lebih jauh.",
    }
  }
  if (values.includes("officer")) {
    return {
      tahap: "Validasi bersama petugas",
      tahapPenjelasan: "Menunggu pemeriksaan petugas pada bagian yang tidak bisa diputuskan sendiri.",
    }
  }
  if (values.includes("pending") || values.includes("working")) {
    return {
      tahap: "Pengumpulan bukti",
      tahapPenjelasan: "Melengkapi data dan bukti pendukung sebelum ditinjau petugas.",
    }
  }
  return {
    tahap: "Persiapan dasar",
    tahapPenjelasan: "Menata data dan bukti sebelum validasi bersama petugas.",
  }
}

// ---------------------------------------------------------------------------
// Ringkasan — maksimal dua kalimat (user-flow §7.4)
// ---------------------------------------------------------------------------

const FOKUS: Record<Dimension, string> = {
  legalitas: "membereskan legalitas usaha",
  produk: "melengkapi bukti produk",
  pasar: "menguatkan hubungan dengan buyer",
  "hs-lartas": "memvalidasi klasifikasi",
  dokumen: "menyiapkan dokumen dasar",
  eksekusi: "menyusun rencana pengiriman",
}

export function computeRingkasan(statuses: DimensionStatusMap, actions: SelectedAction[]): string {
  const siap = DIMENSION_ORDER.filter((dimensi) => statuses[dimensi] === "ready").length
  const belumMulai = DIMENSION_ORDER.every((dimensi) => statuses[dimensi] === "idle")

  const kalimatSatu = belumMulai
    ? "Assessment baru dimulai, jadi gambaran kesiapannya masih terbuka."
    : siap > 0
      ? "Fondasi usaha sudah ada."
      : "Beberapa bagian dasar masih perlu dibereskan lebih dulu."

  if (actions.length === 0) {
    return `${kalimatSatu} Semua dimensi sudah siap ditinjau petugas.`
  }

  const daftar = actions.map((action) => FOKUS[action.dimensi])
  const gabung =
    daftar.length === 1
      ? daftar[0]
      : `${daftar.slice(0, -1).join(", ")}, dan ${daftar[daftar.length - 1]}`

  return `${kalimatSatu} Fokus berikutnya adalah ${gabung}.`
}

// ---------------------------------------------------------------------------
// Konteks kasus untuk ruang review petugas
// ---------------------------------------------------------------------------

export function caseContext(a: AnswerMap) {
  const buyer = asText(a["buyer-status"])
  const kirim = asText(a["shipping-method"])
  const target = asText(a["target-date"])
  const peb = asText(a["peb-familiar"])

  return {
    statusBuyer: buyer !== "" ? buyer : "Belum diisi",
    pengalamanEkspor:
      peb === "Ya" ? "Sudah pernah mengurus pemberitahuan ekspor" : "Belum pernah ekspor",
    metodePengiriman: kirim !== "" && kirim !== UNKNOWN ? kirim : "Belum ditentukan",
    targetTanggal: target !== "" && target !== UNKNOWN ? target : null,
  }
}

export function hasAnyAnswer(a: AnswerMap): boolean {
  return Object.values(a).some((value) => isFilled(value))
}
