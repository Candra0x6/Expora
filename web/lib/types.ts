/**
 * JalurEkspor — kontrak data bersama frontend & backend.
 *
 * BEKU. Dimiliki PM. Jangan disunting oleh agent frontend maupun backend.
 * Kalau ada tipe yang terasa salah atau kurang, hentikan pekerjaan dan laporkan
 * ke PM — jangan tambal sendiri, karena sisi lain sedang menulis kode terhadap
 * bentuk yang sama.
 *
 * Turunan dari docs/data-contract.md · v1.0 · 30 Agustus 2026
 */

// ---------------------------------------------------------------------------
// Enum
// ---------------------------------------------------------------------------

export type Role = "UMKM" | "PETUGAS"

export type CaseStatus =
  | "DRAFT"
  | "MENUNGGU_TINJAUAN"
  | "MENUNGGU_UMKM"
  | "ESKALASI"
  | "RENCANA_TERKIRIM"
  | "SELESAI"

export type NextActionBy = "UMKM" | "PETUGAS" | null

export type Dimension = "legalitas" | "produk" | "pasar" | "hs-lartas" | "dokumen" | "eksekusi"

/** Urutan kanonis. Dipakai untuk mengurutkan dimensi dan memutus seri next action. */
export const DIMENSION_ORDER: readonly Dimension[] = [
  "legalitas",
  "produk",
  "pasar",
  "hs-lartas",
  "dokumen",
  "eksekusi",
] as const

export type DimensionStatus = "ready" | "pending" | "working" | "officer" | "blocked" | "idle"

/** Bobot keparahan untuk memilih next action dan dimensi blocker. */
export const SEVERITY_WEIGHT: Record<DimensionStatus, number> = {
  blocked: 5,
  officer: 4,
  pending: 3,
  working: 2,
  idle: 1,
  ready: 0,
}

export type QuestionType = "text" | "number" | "select" | "yesno" | "multi"

export type TaskStatus = "OPEN" | "IN_PROGRESS" | "READY_FOR_REVIEW" | "COMPLETED"

export type TaskOwner = "UMKM" | "PETUGAS" | "UMKM_DAN_PENDAMPING"

export type RecommendationSource = "AI" | "OFFICER"

export type Confidence = "rendah" | "sedang" | "tinggi"

export type InfoRequestStatus = "TERBUKA" | "DIJAWAB"

export type CaseEventType =
  | "KASUS_DIBUAT"
  | "ASSESSMENT_SELESAI"
  | "DIKIRIM_TINJAUAN"
  | "DRAFT_AI_DIBUAT"
  | "CATATAN_PETUGAS"
  | "INFO_DIMINTA"
  | "INFO_DIJAWAB"
  | "REKOMENDASI_DIEDIT"
  | "KASUS_DIESKALASI"
  | "RENCANA_DIKIRIM"
  | "TUGAS_SELESAI"
  | "BUKTI_DIUNGGAH"

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  | "VALIDASI_GAGAL"
  | "BELUM_MASUK"
  | "AKSES_DITOLAK"
  | "TIDAK_DITEMUKAN"
  | "TRANSISI_TIDAK_VALID"
  | "ATURAN_BISNIS"
  | "KREDENSIAL_SALAH"
  | "EMAIL_SUDAH_DIPAKAI"
  | "KESALAHAN_SERVER"

/** `message` selalu Bahasa Indonesia dan layak ditampilkan apa adanya ke pengguna. */
export type ApiError = {
  error: {
    code: ApiErrorCode
    message: string
    details?: Record<string, unknown>
  }
}

// ---------------------------------------------------------------------------
// Sesi
// ---------------------------------------------------------------------------

export type SessionUser = {
  id: string
  email: string
  role: Role
  namaLengkap: string
  /** null untuk PETUGAS. */
  usaha: { id: string; nama: string } | null
}

export type AuthResult = {
  role: Role
  redirectTo: string
}

// ---------------------------------------------------------------------------
// Kasus
// ---------------------------------------------------------------------------

export type CaseBlocker = {
  dimensi: Dimension
  ringkas: string
  alasan: string
}

export type CaseListItem = {
  id: string
  kode: string
  namaUsaha: string
  produk: string
  tujuan: string
  status: CaseStatus
  nextActionBy: NextActionBy
  tahap: string
  blocker: CaseBlocker | null
  /** ISO 8601 UTC. null selama DRAFT. */
  dikirimPada: string | null
  hariMenunggu: number
  /** ISO date (YYYY-MM-DD). null kalau belum ditentukan. */
  targetEkspor: string | null
  terlambat: boolean
  /** Diisi saat status MENUNGGU_UMKM, untuk deep-link ke inbox. */
  permintaanInfoTerbukaId: string | null
  /** Satu kalimat "apa yang harus dilakukan sekarang" untuk dashboard UMKM. */
  aksiBerikutnya: string
}

export type QueueSummary = {
  perluDitinjau: number
  menungguUmkm: number
  eskalasi: number
  terlambat: number
}

export type CaseListResponse = {
  ringkasan: QueueSummary
  kasus: CaseListItem[]
}

export type CaseContext = {
  statusBuyer: string
  pengalamanEkspor: string
  metodePengiriman: string
  targetTanggal: string | null
}

export type ReviewedBy = {
  nama: string
  /** ISO 8601 UTC. */
  pada: string
}

export type CaseDetail = {
  id: string
  kode: string
  namaUsaha: string
  produk: string
  tujuan: string
  status: CaseStatus
  nextActionBy: NextActionBy
  tahap: string
  versiAssessment: string
  dibuatPada: string
  dikirimPada: string | null
  targetEkspor: string | null
  hariMenunggu: number
  konteks: CaseContext
  ditinjauOleh: ReviewedBy | null
  /** Hanya PETUGAS. Dihapus server dari respons UMKM. */
  catatanInternal?: OfficerNote[]
  /** Hanya PETUGAS. */
  eskalasi?: Escalation | null
  /** Hanya UMKM, dan hanya saat RENCANA_TERKIRIM / SELESAI. */
  rencana?: MentoringPlan | null
  /**
   * Semua bukti yang sudah diunggah untuk kasus ini — gabungan dari jawaban
   * permintaan info dan tugas rencana, urut waktu unggah menaik. Ditambahkan
   * belakangan (bukan di v1.0 awal) supaya petugas punya satu tempat melihat
   * bukti sebelum mengirim rencana; lihat data-contract.md §6.
   */
  bukti: EvidenceFile[]
}

// ---------------------------------------------------------------------------
// Assessment
// ---------------------------------------------------------------------------

export type GlossaryEntry = {
  term: string
  definition: string
}

/**
 * Cerminan pertanyaan yang sudah dipakai UI, minus `condition` — percabangan
 * dievaluasi di server dan tidak pernah dikirim ke klien.
 */
export type Question = {
  id: string
  dimensi: Dimension
  section: string
  title: string
  description: string | null
  type: QuestionType
  options: string[] | null
  placeholder: string | null
  glossary: GlossaryEntry[] | null
  supportsUnknown: boolean
  supportsNotOwned: boolean
  wajib: boolean
}

export type AnswerValue = string | string[]

export type AssessmentState = {
  versi: string
  /** HANYA pertanyaan yang lolos syarat, dalam urutan tampil. */
  pertanyaan: Question[]
  jawaban: Record<string, AnswerValue>
  progress: { terjawab: number; total: number }
  /** Pertanyaan wajib yang terlihat tapi belum terjawab. Dipakai untuk "sisa N wajib". */
  sisaWajib: number
  /** Indeks pertanyaan belum terjawab pertama; -1 kalau semua selesai. */
  indeksBerikutnya: number
  bolehLihatHasil: boolean
  /** ISO 8601 UTC. null kalau belum pernah tersimpan. */
  disimpanPada: string | null
}

export type SaveAnswerRequest = {
  questionId: string
  jawaban: AnswerValue
}

// ---------------------------------------------------------------------------
// Kesiapan & next action
// ---------------------------------------------------------------------------

export type ReadinessDimension = {
  dimensi: Dimension
  status: DimensionStatus
  alasan: string
  fakta: string[]
  belumAda: string
}

export type NextAction = {
  id: string
  urutan: number
  dimensi: Dimension
  judul: string
  kenapa: string
  owner: TaskOwner
  buktiDibutuhkan: string
  prioritas: string
  status: TaskStatus
}

export type ReadinessResult = {
  ringkasan: string
  tahap: string
  tahapPenjelasan: string
  sumber: RecommendationSource
  ditinjauOleh: ReviewedBy | null
  dihitungPada: string
  /** Selalu enam elemen, selalu urutan kanonis DIMENSION_ORDER. */
  dimensi: ReadinessDimension[]
  /** Maksimal tiga. Tidak pernah lebih. */
  nextActions: NextAction[]
}

// ---------------------------------------------------------------------------
// Draft AI & explainability (PRD #3)
// ---------------------------------------------------------------------------

export type SupportingFact = {
  label: string
  nilai: string
  asal: string
  dikonfirmasi: boolean
}

export type UnknownInformation = {
  teks: string
  dimensiTerkait: Dimension[]
}

export type SourceReference = {
  judul: string
  penerbit: string
  tahun: number
  mendukung: string
  url: string | null
}

export type RecommendationVersion = {
  versi: string
  sumber: RecommendationSource
  dibuatPada: string
}

export type RecommendationDraft = {
  versi: string
  sumber: RecommendationSource
  isi: string
  keyakinan: Confidence
  alasanReview: string
  dibuatPada: string
  fakta: SupportingFact[]
  belumDiketahui: UnknownInformation[]
  sumberReferensi: SourceReference[]
  versiSebelumnya: RecommendationVersion[]
}

// ---------------------------------------------------------------------------
// Aksi petugas
// ---------------------------------------------------------------------------

export type OfficerNote = {
  id: string
  isi: string
  olehNama: string
  dibuatPada: string
}

export type Escalation = {
  id: string
  kategori: Dimension
  alasan: string
  olehNama: string
  dibuatPada: string
}

export type InfoRequestSummary = {
  id: string
  judul: string
  pesan: string
  dariPetugas: string
  dibuatPada: string
  status: InfoRequestStatus
}

export type InfoResponse = {
  pesan: string
  dijawabPada: string
  bukti: EvidenceFile[]
}

export type InfoRequestDetail = InfoRequestSummary & {
  kodeKasus: string
  jawaban: InfoResponse | null
}

// ---------------------------------------------------------------------------
// Rencana, tugas, bukti
// ---------------------------------------------------------------------------

export type EvidenceFile = {
  id: string
  namaBerkas: string
  tipe: string
  ukuranBytes: number
  /** Signed URL, berumur 1 jam. */
  url: string
  diunggahPada: string
  dikonfirmasi: boolean
}

export type Task = {
  id: string
  urutan: number
  judul: string
  penjelasan: string
  owner: TaskOwner
  buktiDibutuhkan: string
  /** ISO date (YYYY-MM-DD). */
  targetSelesai: string | null
  status: TaskStatus
  versi: string
  bukti: EvidenceFile[]
}

export type MentoringPlan = {
  versi: string
  ringkasanPetugas: string
  ditinjauOleh: ReviewedBy
  dikirimPada: string
  tugas: Task[]
}

// ---------------------------------------------------------------------------
// Riwayat (PRD #5)
// ---------------------------------------------------------------------------

export type CaseEvent = {
  id: string
  tipe: CaseEventType
  judul: string
  aktor: string
  peranAktor: Role | "SISTEM"
  ringkasan: string
  versi: string | null
  pada: string
}
