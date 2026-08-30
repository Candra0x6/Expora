/**
 * Pemilihan next action — `docs/user-flow.md` §7.3.
 *
 * Maksimal TIGA, dijaga oleh kode (`.slice(0, MAX_ACTIONS)`), bukan oleh niat baik.
 * Tidak ada skor tunggal yang dikirim ke mana pun; bobot keparahan hanya dipakai
 * di dalam modul ini untuk memilih dan tidak pernah bocor ke respons API.
 */

import {
  DIMENSION_ORDER,
  SEVERITY_WEIGHT,
  type Dimension,
  type DimensionStatus,
  type TaskOwner,
} from "@/lib/types"
import type { DimensionStatusMap } from "./readiness"

export const MAX_ACTIONS = 3

/** Label panjang, dipakai di kalimat prioritas dan di ringkas blocker. */
export const DIMENSION_LABEL: Record<Dimension, string> = {
  legalitas: "Legalitas Usaha",
  produk: "Produk & Kapasitas",
  pasar: "Pasar Tujuan",
  "hs-lartas": "HS & Lartas",
  dokumen: "Dokumen Ekspor",
  eksekusi: "Eksekusi Ekspor",
}

/** Label pendek, dipakai di kalimat "… saat ini menjadi hambatan eksekusi". */
const DIMENSION_SHORT: Record<Dimension, string> = {
  legalitas: "Legalitas",
  produk: "Produk",
  pasar: "Pasar tujuan",
  "hs-lartas": "HS & Lartas",
  dokumen: "Dokumen",
  eksekusi: "Eksekusi",
}

export type ActionTemplate = {
  judul: string
  kenapa: string
  owner: TaskOwner
  buktiDibutuhkan: string
}

export type SelectedAction = ActionTemplate & {
  dimensi: Dimension
  status: DimensionStatus
  urutan: number
  prioritas: string
}

/**
 * Kalimat prioritas diturunkan dari status, bukan dari angka bobot.
 * "Alasan perhatian" harus dapat dibaca petugas — bukan skor buram.
 */
function prioritasFor(dimensi: Dimension, status: DimensionStatus): string {
  switch (status) {
    case "blocked":
      return `${DIMENSION_SHORT[dimensi]} saat ini menjadi hambatan eksekusi`
    case "officer":
      return "Membutuhkan peninjauan petugas sebelum melangkah lebih jauh"
    case "pending":
      return `Menutup informasi paling penting di dimensi ${DIMENSION_LABEL[dimensi]}`
    case "working":
      return `${DIMENSION_SHORT[dimensi]} sudah berjalan dan tinggal dituntaskan agar tidak menggantung`
    case "idle":
      return `${DIMENSION_SHORT[dimensi]} belum tersentuh, jadi langkah kecil di sini paling cepat terasa`
    case "ready":
      return "Sudah siap ditinjau"
  }
}

// ---------------------------------------------------------------------------
// Tabel template (dimensi, status). Lengkap 6 × 5 — status `ready` tidak pernah
// terpilih jadi tidak punya template.
// ---------------------------------------------------------------------------

type TemplateTable = Record<Dimension, Partial<Record<DimensionStatus, ActionTemplate>>>

export const ACTION_TEMPLATES: TemplateTable = {
  legalitas: {
    blocked: {
      judul: "Urus legalitas dasar usaha",
      kenapa:
        "Selama usaha belum tercatat resmi, dokumen ekspor tidak bisa diterbitkan atas nama usaha dan buyer sulit melakukan pembayaran.",
      owner: "UMKM",
      buktiDibutuhkan: "NIB dari sistem OSS, KTP pemilik, dan alamat usaha",
    },
    officer: {
      judul: "Validasi dokumen legalitas bersama petugas",
      kenapa:
        "Bentuk usaha yang tercatat perlu dicocokkan dengan dokumen aslinya sebelum dipakai sebagai dasar dokumen ekspor.",
      owner: "PETUGAS",
      buktiDibutuhkan: "Salinan NIB, akta atau surat keterangan usaha, dan NPWP",
    },
    pending: {
      judul: "Lengkapi data legalitas usaha",
      kenapa:
        "Data bentuk usaha dan lama berjalan dipakai untuk menentukan dokumen mana yang wajib disiapkan.",
      owner: "UMKM",
      buktiDibutuhkan: "NIB, NPWP, dan catatan tahun usaha mulai beroperasi",
    },
    working: {
      judul: "Tuntaskan pengurusan dokumen legalitas",
      kenapa:
        "Dokumen yang setengah jadi membuat pemeriksaan berhenti di tengah jalan dan harus diulang.",
      owner: "UMKM",
      buktiDibutuhkan: "Bukti pengajuan atau nomor registrasi yang sedang diproses",
    },
    idle: {
      judul: "Mulai isi bagian legalitas usaha",
      kenapa:
        "Legalitas adalah pintu masuk semua dokumen ekspor. Tanpa ini, langkah berikutnya tidak bisa dinilai.",
      owner: "UMKM",
      buktiDibutuhkan: "Bentuk usaha saat ini dan tahun usaha mulai berjalan",
    },
  },

  produk: {
    blocked: {
      judul: "Tetapkan satu produk utama untuk diekspor",
      kenapa:
        "Tanpa satu produk yang jelas, klasifikasi barang dan dokumen pendukung tidak bisa disiapkan.",
      owner: "UMKM",
      buktiDibutuhkan: "Nama produk, ukuran kemasan, dan komposisi",
    },
    officer: {
      judul: "Periksa kesiapan mutu produk bersama pendamping",
      kenapa:
        "Standar mutu dan umur simpan menentukan sertifikat apa yang diminta negara tujuan.",
      owner: "PETUGAS",
      buktiDibutuhkan: "Hasil uji laboratorium, umur simpan, dan foto kemasan",
    },
    pending: {
      judul: "Lengkapi bukti kesiapan produk",
      kenapa:
        "Buyer perlu melihat bahwa kualitas dan pasokan bisa konsisten sebelum membahas pengiriman.",
      owner: "UMKM",
      buktiDibutuhkan: "Spesifikasi produk, umur simpan, kapasitas bulanan",
    },
    working: {
      judul: "Tuntaskan sertifikasi produk yang sedang diproses",
      kenapa:
        "Sertifikat yang belum terbit sering menjadi penyebab pengiriman pertama tertunda.",
      owner: "UMKM",
      buktiDibutuhkan: "Nomor pengajuan sertifikat dan perkiraan tanggal terbit",
    },
    idle: {
      judul: "Pilih produk yang paling siap diekspor",
      kenapa:
        "Menentukan satu produk lebih dulu membuat seluruh persiapan berikutnya jauh lebih fokus.",
      owner: "UMKM",
      buktiDibutuhkan: "Nama produk utama dan kapasitas produksi per bulan",
    },
  },

  pasar: {
    blocked: {
      judul: "Tentukan ulang negara tujuan ekspor",
      kenapa:
        "Aturan impor berbeda di tiap negara. Tanpa tujuan yang pasti, dokumen tidak bisa dipetakan.",
      owner: "UMKM",
      buktiDibutuhkan: "Negara tujuan dan alasan pemilihannya",
    },
    officer: {
      judul: "Bahas strategi pasar tujuan bersama pendamping",
      kenapa:
        "Pemilihan pasar perlu dicocokkan dengan kapasitas produksi dan aturan impor negara tujuan.",
      owner: "PETUGAS",
      buktiDibutuhkan: "Profil calon buyer dan perkiraan volume permintaan",
    },
    pending: {
      judul: "Kuatkan hubungan dengan calon buyer",
      kenapa:
        "Permintaan tertulis dari buyer membuat semua persiapan dokumen punya tenggat yang nyata.",
      owner: "UMKM",
      buktiDibutuhkan: "Email, chat, atau surat permintaan dari calon buyer",
    },
    working: {
      judul: "Ubah percakapan buyer menjadi permintaan tertulis",
      kenapa:
        "Percakapan yang sudah berjalan perlu dikunci menjadi PO atau permintaan resmi agar target pengiriman bisa ditetapkan.",
      owner: "UMKM",
      buktiDibutuhkan: "Rekap percakapan buyer dan draft penawaran harga",
    },
    idle: {
      judul: "Pilih satu negara tujuan ekspor pertama",
      kenapa:
        "Satu negara tujuan lebih dulu membuat aturan yang harus dipenuhi menjadi jelas dan terbatas.",
      owner: "UMKM",
      buktiDibutuhkan: "Negara tujuan dan calon buyer yang sedang didekati",
    },
  },

  "hs-lartas": {
    blocked: {
      judul: "Urus izin untuk barang yang termasuk Lartas",
      kenapa:
        "Produk yang termasuk barang dibatasi memerlukan izin dari instansi terkait sebelum boleh dikirim.",
      owner: "PETUGAS",
      buktiDibutuhkan: "Komposisi produk, foto kemasan, dan surat permohonan izin",
    },
    officer: {
      judul: "Jadwalkan validasi HS Code & Lartas",
      kenapa:
        "Klasifikasi yang tepat membantu menentukan aturan dan dokumen yang harus disiapkan.",
      owner: "PETUGAS",
      buktiDibutuhkan: "Nama produk, komposisi, foto kemasan, negara tujuan",
    },
    pending: {
      judul: "Kumpulkan data untuk klasifikasi barang",
      kenapa:
        "Petugas butuh keterangan produk yang lengkap sebelum dapat memeriksa klasifikasi dan ketentuannya.",
      owner: "UMKM",
      buktiDibutuhkan: "Komposisi bahan, proses produksi, dan foto kemasan",
    },
    working: {
      judul: "Lanjutkan pemeriksaan klasifikasi barang",
      kenapa:
        "Pemeriksaan yang sudah dimulai perlu diselesaikan supaya dokumen ekspor tidak salah isi.",
      owner: "PETUGAS",
      buktiDibutuhkan: "Catatan pemeriksaan sementara dan pertanyaan yang tersisa",
    },
    idle: {
      judul: "Isi bagian HS Code & Lartas pada assessment",
      kenapa:
        "HS Code menentukan tarif dan aturan impor. Tanpa informasi awal, petugas tidak bisa mulai memeriksa.",
      owner: "UMKM",
      buktiDibutuhkan: "Keterangan produk dan hasil pengecekan awal, kalau ada",
    },
  },

  dokumen: {
    blocked: {
      judul: "Siapkan paket dokumen ekspor dasar",
      kenapa:
        "Dokumen dasar membuat percakapan dengan buyer dan forwarder lebih konkret.",
      owner: "UMKM",
      buktiDibutuhkan: "Invoice, packing list, sertifikat pendukung",
    },
    officer: {
      judul: "Periksa kelengkapan dokumen bersama petugas",
      kenapa:
        "Dokumen yang tidak konsisten satu sama lain sering menjadi penyebab pengiriman tertahan.",
      owner: "PETUGAS",
      buktiDibutuhkan: "Invoice, packing list, dan dokumen legalitas untuk dicocokkan",
    },
    pending: {
      judul: "Lengkapi dokumen ekspor yang masih kurang",
      kenapa:
        "Dokumen yang lengkap sejak awal memperkecil kemungkinan pengiriman pertama tertunda.",
      owner: "UMKM",
      buktiDibutuhkan: "Invoice, packing list, COO / SKA, dan sertifikat produk",
    },
    working: {
      judul: "Rapikan dokumen ekspor yang sedang disiapkan",
      kenapa:
        "Dokumen yang sedang dibuat perlu diperiksa formatnya sebelum dipakai untuk pemberitahuan ekspor.",
      owner: "UMKM_DAN_PENDAMPING",
      buktiDibutuhkan: "Draft invoice dan packing list terbaru",
    },
    idle: {
      judul: "Daftar dokumen ekspor yang sudah dimiliki",
      kenapa:
        "Mengetahui apa yang sudah ada membuat daftar kekurangannya jauh lebih pendek dan tidak menakutkan.",
      owner: "UMKM",
      buktiDibutuhkan: "Dokumen apa pun yang pernah dipakai untuk penjualan",
    },
  },

  eksekusi: {
    blocked: {
      judul: "Cari mitra pengiriman untuk ekspor pertama",
      kenapa:
        "Tanpa mitra pengiriman, dokumen yang sudah siap tidak bisa diteruskan menjadi pengiriman nyata.",
      owner: "UMKM_DAN_PENDAMPING",
      buktiDibutuhkan: "Daftar PPJK / forwarder yang dihubungi dan penawarannya",
    },
    officer: {
      judul: "Bahas alur pengiriman bersama pendamping",
      kenapa:
        "Pemilihan moda dan mitra pengiriman memengaruhi biaya serta dokumen yang wajib disiapkan.",
      owner: "PETUGAS",
      buktiDibutuhkan: "Perkiraan volume, berat, dan target tanggal kirim",
    },
    pending: {
      judul: "Lengkapi rencana pengiriman ekspor",
      kenapa:
        "Rencana pengiriman yang jelas membuat perhitungan biaya dan tenggat menjadi masuk akal.",
      owner: "UMKM",
      buktiDibutuhkan: "Moda pengiriman pilihan dan calon mitra pengiriman",
    },
    working: {
      judul: "Kunci pilihan mitra dan moda pengiriman",
      kenapa:
        "Pilihan yang masih terbuka membuat biaya dan jadwal pengiriman sulit diperkirakan.",
      owner: "UMKM_DAN_PENDAMPING",
      buktiDibutuhkan: "Penawaran biaya dari forwarder dan jadwal keberangkatan",
    },
    idle: {
      judul: "Tentukan cara pengiriman ekspor pertama",
      kenapa:
        "Memilih cara kirim lebih awal membantu menghitung biaya dan menyiapkan dokumen yang tepat.",
      owner: "UMKM",
      buktiDibutuhkan: "Perkiraan volume kiriman dan pilihan moda pengiriman",
    },
  },
}

// ---------------------------------------------------------------------------
// Pemilihan
// ---------------------------------------------------------------------------

const CANONICAL_INDEX: Record<Dimension, number> = Object.fromEntries(
  DIMENSION_ORDER.map((dimensi, index) => [dimensi, index]),
) as Record<Dimension, number>

/**
 * 1. Bobot tertinggi menang; bobot 0 (`ready`) tidak pernah terpilih.
 * 2. Seri diputus dengan urutan kanonis.
 * 3. Tiga yang terpilih diurutkan ulang dengan urutan kanonis yang sama.
 */
export function selectNextActions(statuses: DimensionStatusMap): SelectedAction[] {
  const kandidat = DIMENSION_ORDER.filter((dimensi) => SEVERITY_WEIGHT[statuses[dimensi]] > 0)

  const terpilih = [...kandidat]
    .sort((a, b) => {
      const selisih = SEVERITY_WEIGHT[statuses[b]] - SEVERITY_WEIGHT[statuses[a]]
      if (selisih !== 0) return selisih
      return CANONICAL_INDEX[a] - CANONICAL_INDEX[b]
    })
    .slice(0, MAX_ACTIONS)
    .sort((a, b) => CANONICAL_INDEX[a] - CANONICAL_INDEX[b])

  return terpilih.map((dimensi, index) => {
    const status = statuses[dimensi]
    const template = ACTION_TEMPLATES[dimensi][status]
    if (!template) {
      // Tidak mungkin tercapai: status `ready` sudah disaring di atas dan tabel
      // di berkas ini lengkap untuk lima status sisanya.
      throw new Error(`Template aksi hilang untuk ${dimensi}/${status}`)
    }
    return {
      ...template,
      dimensi,
      status,
      urutan: index + 1,
      prioritas: prioritasFor(dimensi, status),
    }
  })
}
