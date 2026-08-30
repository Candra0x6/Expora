import { z } from "zod"
import type { CaseListItem, CaseListResponse, Dimension, QueueSummary } from "@/lib/types"
import { prisma } from "@/lib/server/db"
import { requireUser } from "@/lib/server/auth"
import { nextActionBy } from "@/lib/server/case-state"
import { recordEvent } from "@/lib/server/events"
import { toCaseListItem } from "@/lib/server/mappers"
import { ApiError, created, handle, ok, parseJson } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CASE_SELECT = {
  id: true,
  kode: true,
  produk: true,
  tujuan: true,
  status: true,
  tahap: true,
  targetEkspor: true,
  dikirimPada: true,
  dibuatPada: true,
  business: { select: { nama: true } },
} as const

/**
 * GET /api/kasus
 *
 * UMKM  → kasus miliknya sendiri.
 * PETUGAS → antrean (semua kasus yang SUDAH dikirim; `DRAFT` bukan milik antrean)
 *           dengan filter q / status / blocker / waiting / target.
 *
 * `ringkasan` dihitung atas SELURUH antrean dan sengaja tidak terpengaruh filter —
 * empat kartu statistik harus tetap menunjukkan beban kerja sebenarnya.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireUser()
    const url = new URL(request.url)

    const where =
      user.role === "PETUGAS"
        ? { status: { not: "DRAFT" as const } }
        : { businessId: { in: user.businessIds } }

    const semua = await prisma.case.findMany({
      where,
      select: CASE_SELECT,
      orderBy: { dibuatPada: "desc" },
    })

    const ids = semua.map((kasus) => kasus.id)
    const dimensiRows = await prisma.readinessDimension.findMany({
      where: { caseId: { in: ids } },
      select: { caseId: true, dimensi: true, status: true, alasan: true },
    })
    const permintaanTerbuka = await prisma.infoRequest.findMany({
      where: { caseId: { in: ids }, status: "TERBUKA" },
      select: { id: true, caseId: true },
      orderBy: { dibuatPada: "desc" },
    })

    const dimensiByCase = new Map<string, typeof dimensiRows>()
    for (const row of dimensiRows) {
      const list = dimensiByCase.get(row.caseId) ?? []
      list.push(row)
      dimensiByCase.set(row.caseId, list)
    }
    const permintaanByCase = new Map(permintaanTerbuka.map((row) => [row.caseId, row.id]))

    const sekarang = new Date()
    const items: CaseListItem[] = semua.map((kasus) =>
      toCaseListItem(kasus, dimensiByCase.get(kasus.id) ?? [], permintaanByCase.get(kasus.id) ?? null, sekarang),
    )

    const ringkasan: QueueSummary = {
      perluDitinjau: items.filter((item) => item.status === "MENUNGGU_TINJAUAN").length,
      menungguUmkm: items.filter((item) => item.status === "MENUNGGU_UMKM").length,
      eskalasi: items.filter((item) => item.status === "ESKALASI").length,
      terlambat: items.filter((item) => item.terlambat).length,
    }

    const kasus = user.role === "PETUGAS" ? urutkanAntrean(saring(items, url)) : items

    const hasil: CaseListResponse = { ringkasan, kasus }
    return ok(hasil)
  })
}

function saring(items: CaseListItem[], url: URL): CaseListItem[] {
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? ""
  const status = url.searchParams.get("status")?.trim() ?? ""
  const blocker = url.searchParams.get("blocker")?.trim() ?? ""
  const waiting = url.searchParams.get("waiting")?.trim() ?? ""
  const target = url.searchParams.get("target")?.trim() ?? ""

  return items.filter((item) => {
    if (q) {
      const haystack = [item.kode, item.namaUsaha, item.produk, item.tujuan, item.blocker?.ringkas ?? ""]
        .join(" ")
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (status && item.status !== status) return false
    if (blocker && item.blocker?.dimensi !== (blocker as Dimension)) return false
    if (waiting === "lt3" && item.hariMenunggu >= 3) return false
    if (waiting === "gte3" && item.hariMenunggu < 3) return false
    if (target === "ada" && !item.targetEkspor) return false
    if (target === "tanpa" && item.targetEkspor) return false
    return true
  })
}

/** Urutan default: giliran petugas dulu, lalu yang paling lama menunggu. */
function urutkanAntrean(items: CaseListItem[]): CaseListItem[] {
  return [...items].sort((a, b) => {
    const aPetugas = nextActionBy(a.status) === "PETUGAS" ? 0 : 1
    const bPetugas = nextActionBy(b.status) === "PETUGAS" ? 0 : 1
    if (aPetugas !== bPetugas) return aPetugas - bPetugas
    return b.hariMenunggu - a.hariMenunggu
  })
}

// ---------------------------------------------------------------------------
// POST /api/kasus
// ---------------------------------------------------------------------------

const Body = z.object({
  produk: z.string().trim().max(200).optional(),
  tujuan: z.string().trim().max(120).optional(),
})

/** Dua huruf pertama nama usaha. "Lereng Lawu Foods" → "LE". */
function prefixKode(namaUsaha: string): string {
  const bersih = namaUsaha.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
  return (bersih.slice(0, 2) || "JE").padEnd(2, "X")
}

async function kodeBerikutnya(namaUsaha: string): Promise<string> {
  const prefix = prefixKode(namaUsaha)
  const sudahAda = await prisma.case.findMany({
    where: { kode: { startsWith: `${prefix}-` } },
    select: { kode: true },
  })

  const tertinggi = sudahAda.reduce((maks, row) => {
    const angka = Number(row.kode.slice(prefix.length + 1))
    return Number.isFinite(angka) && angka > maks ? angka : maks
  }, 0)

  // Tabrakan (mis. dua permintaan berbarengan) → naikkan urutan sampai bebas.
  for (let urutan = tertinggi + 1; urutan < tertinggi + 100; urutan += 1) {
    const kandidat = `${prefix}-${String(urutan).padStart(4, "0")}`
    const bentrok = await prisma.case.findUnique({ where: { kode: kandidat }, select: { id: true } })
    if (!bentrok) return kandidat
  }
  throw new ApiError("KESALAHAN_SERVER", "Gagal membuat kode kasus baru. Coba lagi.")
}

/**
 * POST /api/kasus — mulai assessment baru.
 *
 * Menolak `409` kalau sudah ada kasus `DRAFT`: satu assessment yang belum
 * selesai sudah cukup, dan `details.kode` mengarahkan ke kasus itu.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser()
    if (user.role !== "UMKM" || !user.usaha) {
      throw new ApiError("AKSES_DITOLAK", "Hanya pemilik usaha yang bisa membuat kasus.")
    }
    const body = await parseJson(request, Body)

    const draft = await prisma.case.findFirst({
      where: { businessId: { in: user.businessIds }, status: "DRAFT" },
      select: { kode: true },
    })
    if (draft) {
      throw new ApiError(
        "TRANSISI_TIDAK_VALID",
        "Masih ada assessment yang belum dikirim. Selesaikan dulu kasus itu.",
        { kode: draft.kode, redirectTo: `/assessment/${draft.kode.toLowerCase()}` },
      )
    }

    const kode = await kodeBerikutnya(user.usaha.nama)
    const kasus = await prisma.case.create({
      data: {
        kode,
        businessId: user.usaha.id,
        produk: body.produk?.trim() || "Belum ditentukan",
        tujuan: body.tujuan?.trim() || "Belum ditentukan",
        status: "DRAFT",
      },
    })

    await recordEvent(prisma, {
      caseId: kasus.id,
      tipe: "KASUS_DIBUAT",
      ringkasan: `Assessment dimulai untuk ${user.usaha.nama}.`,
      aktorId: user.id,
      aktorLabel: user.usaha.nama,
      peranAktor: "UMKM",
    })

    return created({ kode, redirectTo: `/assessment/${kode.toLowerCase()}` })
  })
}
