"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, CalendarDays, Clock3, Search, SlidersHorizontal, UserRound } from "lucide-react"
import { api, type QueueFilters } from "@/lib/api-client"
import { useDebounced, useResource } from "@/hooks/use-resource"
import { LogoutButton } from "@/components/site-header"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/state-blocks"
import {
  CASE_STATUS_LABEL,
  CASE_STATUS_STYLE,
  DIMENSION_LABEL,
  formatTanggal,
  formatTanggalWaktu,
  nextActionByLabel,
  nextActionByStyle,
} from "@/lib/labels"
import { DIMENSION_ORDER } from "@/lib/types"
import type { CaseStatus, QueueSummary } from "@/lib/types"

const STATUS_PILIHAN: CaseStatus[] = [
  "MENUNGGU_TINJAUAN",
  "MENUNGGU_UMKM",
  "ESKALASI",
  "RENCANA_TERKIRIM",
  "SELESAI",
  "DRAFT",
]

const KARTU: { kunci: keyof QueueSummary; label: string; style: string }[] = [
  { kunci: "perluDitinjau", label: "Perlu Ditinjau", style: "border-[#c47743]/30 bg-[#f0e6d7]" },
  { kunci: "menungguUmkm", label: "Menunggu UMKM", style: "border-[#18251f]/10 bg-white/55" },
  { kunci: "eskalasi", label: "Eskalasi", style: "border-[#a75128]/30 bg-[#f3e3dc]" },
  { kunci: "terlambat", label: "Terlambat", style: "border-[#18251f]/10 bg-white/55" },
]

export function JalurEksporOfficerQueue() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const filterUrl: QueueFilters = {
    q: params.get("q") ?? undefined,
    status: params.get("status") ?? undefined,
    blocker: params.get("blocker") ?? undefined,
    waiting: params.get("waiting") ?? undefined,
    target: params.get("target") ?? undefined,
  }

  const [query, setQuery] = useState(filterUrl.q ?? "")
  const queryTertunda = useDebounced(query, 300)

  // Filter disimpan di URL supaya bisa di-refresh dan dibagikan.
  useEffect(() => {
    const berikutnya = new URLSearchParams(params.toString())
    if (queryTertunda) berikutnya.set("q", queryTertunda)
    else berikutnya.delete("q")
    const teks = berikutnya.toString()
    if (teks !== params.toString()) router.replace(teks ? `${pathname}?${teks}` : pathname, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryTertunda])

  function setFilter(kunci: string, nilai: string) {
    const berikutnya = new URLSearchParams(params.toString())
    if (nilai) berikutnya.set(kunci, nilai)
    else berikutnya.delete(kunci)
    const teks = berikutnya.toString()
    router.replace(teks ? `${pathname}?${teks}` : pathname, { scroll: false })
  }

  // Penyaringan dilakukan server — antrean nyata bisa ratusan kasus.
  const antrean = useResource(() => api.daftarKasus(filterUrl), [
    filterUrl.q,
    filterUrl.status,
    filterUrl.blocker,
    filterUrl.waiting,
    filterUrl.target,
  ])

  const kasus = antrean.data?.kasus ?? []
  const ringkasan = antrean.data?.ringkasan
  const adaFilter = Boolean(
    filterUrl.q || filterUrl.status || filterUrl.blocker || filterUrl.waiting || filterUrl.target,
  )

  return (
    <main className="min-h-screen bg-[#f5f4f0] text-[#18251f]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/petugas/antrian" className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-lg bg-[#18251f] text-sm font-semibold text-[#f5f4f0]">
            J
          </span>
          <span className="font-serif text-lg">JalurEkspor</span>
        </Link>
        <div className="flex items-center gap-3 text-xs text-[#18251f]/50">
          <span className="hidden sm:inline">Ruang petugas</span>
          <span className="grid size-8 place-items-center rounded-full bg-[#e7ebe3]">
            <UserRound className="size-4" />
          </span>
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 pb-16 lg:px-10">
        <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-[#a75128]">Antrean review</p>
            <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Kasus yang perlu perhatian.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#18251f]/55">
              Buka kasus berdasarkan konteks dan alasan yang transparan, bukan skor prioritas yang tidak dapat
              dijelaskan.
            </p>
          </div>
          <span className="flex items-center gap-2 text-xs text-[#18251f]/45">
            <Clock3 className="size-3.5" /> Urutan: giliran petugas dulu, lalu waktu tunggu terlama
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KARTU.map((kartu) => (
            <div key={kartu.kunci} className={`rounded-2xl border p-5 ${kartu.style}`}>
              <p className="text-xs text-[#18251f]/50">{kartu.label}</p>
              {antrean.loading || !ringkasan ? (
                <div className="mt-2 h-8 w-10 animate-pulse rounded bg-[#18251f]/8" />
              ) : (
                <p className="mt-2 font-serif text-3xl">{ringkasan[kartu.kunci]}</p>
              )}
            </div>
          ))}
        </div>

        <section className="mt-8 rounded-2xl border border-[#18251f]/10 bg-white/55 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row">
            <label className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#18251f]/35" />
              <span className="sr-only">Cari kasus</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari kode, nama UMKM, produk, atau tujuan"
                className="h-11 w-full rounded-xl border border-[#18251f]/10 bg-[#f5f4f0]/70 pl-10 pr-3 text-sm outline-none placeholder:text-[#18251f]/35 focus:border-[#18251f]/30"
              />
            </label>
            <div className="flex items-center gap-2 text-xs text-[#18251f]/40">
              <SlidersHorizontal className="size-4" /> Filter
            </div>
            <select
              value={filterUrl.status ?? ""}
              onChange={(event) => setFilter("status", event.target.value)}
              className="h-11 rounded-xl border border-[#18251f]/10 bg-[#f5f4f0]/70 px-3 text-sm"
            >
              <option value="">Semua status</option>
              {STATUS_PILIHAN.map((status) => (
                <option key={status} value={status}>
                  {CASE_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
            <select
              value={filterUrl.blocker ?? ""}
              onChange={(event) => setFilter("blocker", event.target.value)}
              className="h-11 rounded-xl border border-[#18251f]/10 bg-[#f5f4f0]/70 px-3 text-sm"
            >
              <option value="">Semua blocker</option>
              {DIMENSION_ORDER.map((dimensi) => (
                <option key={dimensi} value={dimensi}>
                  {DIMENSION_LABEL[dimensi]}
                </option>
              ))}
            </select>
            <select
              value={filterUrl.waiting ?? ""}
              onChange={(event) => setFilter("waiting", event.target.value)}
              className="h-11 rounded-xl border border-[#18251f]/10 bg-[#f5f4f0]/70 px-3 text-sm"
            >
              <option value="">Semua durasi</option>
              <option value="lt3">&lt; 3 hari</option>
              <option value="gte3">≥ 3 hari</option>
            </select>
            <select
              value={filterUrl.target ?? ""}
              onChange={(event) => setFilter("target", event.target.value)}
              className="h-11 rounded-xl border border-[#18251f]/10 bg-[#f5f4f0]/70 px-3 text-sm"
            >
              <option value="">Semua target</option>
              <option value="ada">Ada target</option>
              <option value="tanpa">Tanpa target</option>
            </select>
          </div>
        </section>

        <div className="mt-5 flex items-center justify-between">
          <p className="text-sm text-[#18251f]/50">
            <strong className="font-medium text-[#18251f]">{antrean.loading ? "…" : kasus.length}</strong> kasus
            ditemukan
          </p>
          {adaFilter && (
            <button
              type="button"
              onClick={() => router.replace(pathname, { scroll: false })}
              className="text-xs text-[#a75128] underline underline-offset-4"
            >
              Bersihkan filter
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-4">
          {antrean.loading && <LoadingBlock rows={3} />}

          {!antrean.loading && antrean.error && (
            <ErrorBlock error={antrean.error} onRetry={antrean.reload} title="Antrean tidak dapat dimuat" />
          )}

          {!antrean.loading && !antrean.error && kasus.length === 0 && (
            <EmptyBlock
              title={adaFilter ? "Tidak ada kasus yang cocok" : "Antrean kosong"}
              description={
                adaFilter
                  ? "Tidak ada kasus yang cocok dengan filter saat ini. Longgarkan filter untuk melihat kasus lain."
                  : "Belum ada kasus yang masuk antrean peninjauan."
              }
              action={adaFilter ? { label: "Bersihkan filter", onClick: () => router.replace(pathname) } : undefined}
            />
          )}

          {!antrean.loading &&
            !antrean.error &&
            kasus.map((item) => (
              <article key={item.id} className="rounded-2xl border border-[#18251f]/10 bg-white/55 p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-[#18251f]/40">{item.kode}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] ${CASE_STATUS_STYLE[item.status]}`}>
                        {CASE_STATUS_LABEL[item.status]}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] ${nextActionByStyle(item.nextActionBy)}`}>
                        {nextActionByLabel(item.nextActionBy)}
                      </span>
                      <span className="rounded-full bg-[#e7ebe3] px-2.5 py-1 text-[11px] text-[#55715e]">
                        {item.tahap}
                      </span>
                      {item.terlambat && (
                        <span className="rounded-full bg-[#f3e3dc] px-2.5 py-1 text-[11px] text-[#a75128]">
                          Terlambat
                        </span>
                      )}
                    </div>
                    <h2 className="mt-3 font-serif text-2xl">{item.namaUsaha}</h2>
                    <p className="mt-1 text-sm text-[#18251f]/55">
                      {item.produk || "Produk belum ditentukan"}
                      <span className="px-1 text-[#18251f]/25">→</span>
                      {item.tujuan || "Tujuan belum ditentukan"}
                    </p>
                  </div>
                  <Link
                    href={`/petugas/kasus/${item.kode.toLowerCase()}`}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#18251f] px-4 py-2.5 text-sm text-[#f5f4f0]"
                  >
                    Buka kasus <ArrowRight className="size-4" />
                  </Link>
                </div>

                <div className="mt-5 grid gap-4 border-t border-[#18251f]/8 pt-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#18251f]/35">Blocker utama</p>
                    <p className="mt-1 text-sm font-medium">{item.blocker?.ringkas ?? "Belum teridentifikasi"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#18251f]/35">Alasan perhatian</p>
                    <p className="mt-1 text-sm leading-5 text-[#18251f]/60">
                      {item.blocker?.alasan ?? item.aksiBerikutnya}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#18251f]/35">Dikirim / menunggu</p>
                    <p className="mt-1 text-sm">
                      {item.dikirimPada ? formatTanggalWaktu(item.dikirimPada) : "Belum dikirim"}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-[#a75128]">
                      <Clock3 className="size-3" /> {item.hariMenunggu} hari
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#18251f]/35">Target ekspor</p>
                    <p className="mt-1 flex items-center gap-1 text-sm">
                      {item.targetEkspor ? (
                        <>
                          <CalendarDays className="size-3.5 text-[#18251f]/40" />
                          {formatTanggal(item.targetEkspor)}
                        </>
                      ) : (
                        <span className="text-[#18251f]/35">Belum ditentukan</span>
                      )}
                    </p>
                  </div>
                </div>
              </article>
            ))}
        </div>
      </div>
    </main>
  )
}
