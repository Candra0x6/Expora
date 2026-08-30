/**
 * JalurEkspor — pembungkus fetch tunggal untuk seluruh aplikasi.
 *
 * Aturan (docs/data-contract.md §1):
 * - selalu `credentials: "include"`, tidak pernah mengirim header Authorization
 * - amplop error `{ error: { code, message, details } }` di-parse jadi ApiClientError
 * - `message` dari server dipakai APA ADANYA. Frontend tidak menyusun teks error sendiri.
 * - `401` → arahkan ke /masuk?next=<path saat ini>
 */

import type {
  ApiError,
  ApiErrorCode,
  AssessmentState,
  AuthResult,
  CaseDetail,
  CaseEvent,
  CaseListResponse,
  Dimension,
  InfoRequestDetail,
  ReadinessResult,
  RecommendationDraft,
  RecommendationSource,
  SaveAnswerRequest,
  SessionUser,
  Task,
  TaskOwner,
  TaskStatus,
  CaseStatus,
  ReviewedBy,
} from "@/lib/types"

const BASE = "/api"

/** Error yang membawa amplop server apa adanya. */
export class ApiClientError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly details?: Record<string, unknown>

  constructor(status: number, code: ApiErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = "ApiClientError"
    this.status = status
    this.code = code
    this.details = details
  }
}

/**
 * Satu-satunya tempat teks fallback boleh muncul: ketika server sama sekali tidak
 * menjawab (jaringan mati / backend belum mendarat), sehingga tidak ada `message`
 * dari server yang bisa ditampilkan.
 */
export const PESAN_JARINGAN = "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi."

function isApiError(value: unknown): value is ApiError {
  if (typeof value !== "object" || value === null) return false
  const candidate = (value as { error?: unknown }).error
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof (candidate as { message?: unknown }).message === "string" &&
    typeof (candidate as { code?: unknown }).code === "string"
  )
}

function currentPath(): string {
  if (typeof window === "undefined") return "/"
  return window.location.pathname + window.location.search
}

function redirectToLogin() {
  if (typeof window === "undefined") return
  const path = window.location.pathname
  // Jangan memantul di layar publik — di sana 401 memang wajar.
  if (path === "/" || path.startsWith("/masuk") || path.startsWith("/daftar")) return
  window.location.assign(`/masuk?next=${encodeURIComponent(currentPath())}`)
}

async function toError(response: Response): Promise<ApiClientError> {
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (isApiError(payload)) {
    return new ApiClientError(response.status, payload.error.code, payload.error.message, payload.error.details)
  }
  // Server menjawab tapi bukan dengan amplop kontrak — tidak ada `message` yang bisa dipakai.
  return new ApiClientError(
    response.status,
    "KESALAHAN_SERVER",
    `Server menjawab dengan status ${response.status} di luar format yang disepakati.`,
  )
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, { credentials: "include", ...init })
  } catch {
    throw new ApiClientError(0, "KESALAHAN_SERVER", PESAN_JARINGAN)
  }

  if (!response.ok) {
    const error = await toError(response)
    if (error.status === 401) redirectToLogin()
    throw error
  }

  if (response.status === 204) return undefined as T
  const text = await response.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

function json<T>(path: string, method: "POST" | "PUT" | "PATCH", body: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function multipart<T>(path: string, form: FormData): Promise<T> {
  // Content-Type sengaja tidak diset — browser yang menuliskan boundary.
  return request<T>(path, { method: "POST", body: form })
}

function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  const text = search.toString()
  return text ? `?${text}` : ""
}

// ---------------------------------------------------------------------------
// Bentuk respons yang tidak punya tipe sendiri di lib/types.ts
// ---------------------------------------------------------------------------

export type CreateCaseResult = { kode: string; redirectTo: string }
export type SubmitCaseResult = { status: CaseStatus; dikirimPada: string }
export type InfoRequestCreated = { id: string; statusKasus: CaseStatus }
export type RecommendationSaved = { versi: string; sumber: RecommendationSource }
export type EscalationResult = { statusKasus: CaseStatus }
export type PlanSentResult = { statusKasus: CaseStatus; versi: string; ditinjauOleh: ReviewedBy }
export type AnswerInfoResult = { statusKasus: CaseStatus; redirectTo: string }
export type TaskPatchResult = { status: TaskStatus; statusKasus: CaseStatus }

export type QueueFilters = {
  q?: string
  status?: string
  blocker?: string
  waiting?: string
  target?: string
}

export type PlanTaskInput = {
  judul: string
  penjelasan: string
  owner: TaskOwner
  buktiDibutuhkan: string
  targetSelesai: string | null
}

// ---------------------------------------------------------------------------
// Endpoint
// ---------------------------------------------------------------------------

export const api = {
  // 3.1 Autentikasi
  daftar: (body: { namaPemilik: string; namaUsaha: string; email: string; password: string }) =>
    json<AuthResult>("/auth/daftar", "POST", body),
  masuk: (body: { email: string; password: string }) => json<AuthResult>("/auth/masuk", "POST", body),
  keluar: () => request<void>("/auth/keluar", { method: "POST" }),
  saya: () => request<SessionUser>("/saya"),

  // 3.2 Kasus
  daftarKasus: (filters: QueueFilters = {}) => request<CaseListResponse>(`/kasus${qs(filters)}`),
  buatKasus: (body: { produk?: string; tujuan?: string } = {}) => json<CreateCaseResult>("/kasus", "POST", body),
  kasus: (kode: string) => request<CaseDetail>(`/kasus/${encodeURIComponent(kode)}`),
  kirimKasus: (kode: string) => json<SubmitCaseResult>(`/kasus/${encodeURIComponent(kode)}/kirim`, "POST", {}),

  // 3.3 Assessment
  assessment: (kode: string) => request<AssessmentState>(`/kasus/${encodeURIComponent(kode)}/assessment`),
  simpanJawaban: (kode: string, body: SaveAnswerRequest) =>
    json<AssessmentState>(`/kasus/${encodeURIComponent(kode)}/assessment/jawaban`, "PUT", body),

  // 3.4 Kesiapan
  kesiapan: (kode: string) => request<ReadinessResult>(`/kasus/${encodeURIComponent(kode)}/kesiapan`),

  // 3.5 Aksi petugas
  draft: (kode: string) => request<RecommendationDraft>(`/kasus/${encodeURIComponent(kode)}/draft`),
  simpanCatatan: (kode: string, isi: string) =>
    json<unknown>(`/kasus/${encodeURIComponent(kode)}/catatan`, "POST", { isi }),
  mintaInfo: (kode: string, body: { judul: string; pesan: string }) =>
    json<InfoRequestCreated>(`/kasus/${encodeURIComponent(kode)}/permintaan-info`, "POST", body),
  simpanRekomendasi: (kode: string, body: { isi: string; alasanPerubahan: string }) =>
    json<RecommendationSaved>(`/kasus/${encodeURIComponent(kode)}/rekomendasi`, "PUT", body),
  eskalasi: (kode: string, body: { kategori: Dimension; alasan: string }) =>
    json<EscalationResult>(`/kasus/${encodeURIComponent(kode)}/eskalasi`, "POST", body),
  kirimRencana: (kode: string, body: { ringkasanPetugas: string; tugas: PlanTaskInput[] }) =>
    json<PlanSentResult>(`/kasus/${encodeURIComponent(kode)}/rencana`, "POST", body),

  // 3.6 Permintaan informasi (sisi UMKM)
  permintaan: (id: string) => request<InfoRequestDetail>(`/permintaan/${encodeURIComponent(id)}`),
  jawabPermintaan: (id: string, form: FormData) =>
    multipart<AnswerInfoResult>(`/permintaan/${encodeURIComponent(id)}/jawab`, form),

  // 3.7 Tugas, bukti, riwayat
  tugas: (kode: string) => request<Task[]>(`/kasus/${encodeURIComponent(kode)}/tugas`),
  ubahStatusTugas: (id: string, status: TaskStatus) =>
    json<TaskPatchResult>(`/tugas/${encodeURIComponent(id)}`, "PATCH", { status }),
  unggahBuktiTugas: (id: string, form: FormData) =>
    multipart<unknown>(`/tugas/${encodeURIComponent(id)}/bukti`, form),
  riwayat: (kode: string) => request<CaseEvent[]>(`/kasus/${encodeURIComponent(kode)}/riwayat`),
}
