"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, CalendarDays, Clock3, Inbox, Plus, Sparkles } from "lucide-react"
import { api, ApiClientError } from "@/lib/api-client"
import { useResource } from "@/hooks/use-resource"
import { SiteHeader, LogoutButton } from "@/components/site-header"
import { EmptyBlock, ErrorBlock, FormError, LoadingBlock } from "@/components/state-blocks"
import {
  CASE_STATUS_LABEL,
  CASE_STATUS_STYLE,
  formatTanggal,
  formatTanggalWaktu,
  nextActionByLabel,
  nextActionByStyle,
} from "@/lib/labels"
import type { CaseListItem, CaseStatus } from "@/lib/types"

/** Tombol utama per status — tabel di user-flow.md §5.2. */
function aksiUtama(item: CaseListItem): { label: string; href: string } | null {
  const kode = item.kode.toLowerCase()
  const peta: Record<CaseStatus, { label: string; href: string } | null> = {
    DRAFT: { label: "Lanjutkan assessment", href: `/assessment/${kode}` },
    MENUNGGU_TINJAUAN: { label: "Lihat hasil kesiapan", href: `/hasil/${kode}` },
    MENUNGGU_UMKM: item.permintaanInfoTerbukaId
      ? { label: "Jawab permintaan petugas", href: `/umkm/permintaan/${item.permintaanInfoTerbukaId}` }
      : { label: "Lihat hasil kesiapan", href: `/hasil/${kode}` },
    ESKALASI: { label: "Lihat hasil kesiapan", href: `/hasil/${kode}` },
    RENCANA_TERKIRIM: { label: "Buka rencana pendampingan", href: `/umkm/plan/${kode}` },
    SELESAI: { label: "Lihat rencana", href: `/umkm/plan/${kode}` },
  }
  return peta[item.status]
}

export function JalurEksporUmkmDashboard() {
  const router = useRouter()
  const sesi = useResource(() => api.saya(), [])
  const daftar = useResource(() => api.daftarKasus(), [])

  const [membuat, setMembuat] = useState(false)
  const [errorBuat, setErrorBuat] = useState<string | null>(null)
  const [kodeDraft, setKodeDraft] = useState<string | null>(null)

  async function mulaiKasusBaru() {
    setMembuat(true)
    setErrorBuat(null)
    setKodeDraft(null)
    try {
      const hasil = await api.buatKasus()
      router.push(hasil.redirectTo)
    } catch (gagal) {
      if (gagal instanceof ApiClientError) {
        setErrorBuat(gagal.message)
        const kode = gagal.details?.kode
        if (typeof kode === "string") setKodeDraft(kode)
      }
      setMembuat(false)
    }
  }

  const kasus = daftar.data?.kasus ?? []
  const perluDijawab = kasus.filter((item) => item.status === "MENUNGGU_UMKM")

  return (
    <main className="min-h-screen bg-[#f5f4f0] text-[#18251f]">
      <SiteHeader
        logoHref="/umkm"
        right={
          <>
            <span className="hidden sm:inline">Ruang UMKM</span>
            <LogoutButton />
          </>
        }
      />

      <div className="mx-auto max-w-6xl px-6 pb-20 lg:px-10">
        <section className="mb-8">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-[#a75128]">Dashboard</p>
          {sesi.loading ? (
            <div className="h-12 w-72 animate-pulse rounded-lg bg-[#18251f]/8" />
          ) : sesi.error ? (
            <ErrorBlock error={sesi.error} onRetry={sesi.reload} title="Profil tidak dapat dimuat" />
          ) : (
            <>
              <h1 className="font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
                Halo, {sesi.data?.namaLengkap}.
              </h1>
              <p className="mt-3 text-sm text-[#18251f]/55">
                {sesi.data?.usaha?.nama ?? "Usaha belum terdaftar"} · perjalanan pendampingan ekspor
              </p>
            </>
          )}
        </section>

        {/* Banner menonjol: tanpa ini UMKM menggantung tanpa tahu harus apa. */}
        {perluDijawab.length > 0 && (
          <section className="mb-8 rounded-2xl border border-[#c47743]/35 bg-[#f0e6d7] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <Inbox className="mt-0.5 size-5 shrink-0 text-[#a75128]" />
                <div>
                  <p className="font-medium">Petugas menunggu jawabanmu</p>
                  <p className="mt-1 text-sm leading-6 text-[#18251f]/65">
                    {perluDijawab.length === 1
                      ? `Kasus ${perluDijawab[0].kode} membutuhkan informasi tambahan sebelum peninjauan dilanjutkan.`
                      : `${perluDijawab.length} kasus membutuhkan informasi tambahan sebelum peninjauan dilanjutkan.`}
                  </p>
                </div>
              </div>
              {perluDijawab[0].permintaanInfoTerbukaId && (
                <Link
                  href={`/umkm/permintaan/${perluDijawab[0].permintaanInfoTerbukaId}`}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#a75128] px-4 py-2.5 text-sm text-white"
                >
                  Jawab sekarang <ArrowRight className="size-4" />
                </Link>
              )}
            </div>
          </section>
        )}

        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-t border-[#18251f]/10 pt-8">
          <div>
            <h2 className="font-serif text-2xl">Kasus pendampingan</h2>
            <p className="mt-1 text-sm text-[#18251f]/50">
              Setiap kasus menunjukkan statusnya dan siapa yang harus bertindak sekarang.
            </p>
          </div>
          {kasus.length > 0 && (
            <button
              type="button"
              onClick={mulaiKasusBaru}
              disabled={membuat}
              className="inline-flex items-center gap-2 rounded-full border border-[#18251f]/15 px-4 py-2.5 text-sm transition-colors hover:bg-white/70 disabled:opacity-60"
            >
              <Plus className="size-4" /> {membuat ? "Membuat…" : "Kasus baru"}
            </button>
          )}
        </div>

        {errorBuat && (
          <div className="mb-5">
            <FormError message={errorBuat} />
            {kodeDraft && (
              <Link
                href={`/assessment/${kodeDraft.toLowerCase()}`}
                className="mt-2 inline-flex items-center gap-2 text-xs text-[#a75128] underline underline-offset-4"
              >
                Lanjutkan kasus {kodeDraft} <ArrowRight className="size-3.5" />
              </Link>
            )}
          </div>
        )}

        {daftar.loading && <LoadingBlock rows={2} />}

        {!daftar.loading && daftar.error && (
          <ErrorBlock error={daftar.error} onRetry={daftar.reload} title="Daftar kasus tidak dapat dimuat" />
        )}

        {!daftar.loading && !daftar.error && kasus.length === 0 && (
          <EmptyBlock
            icon={<Sparkles className="size-5" />}
            title="Belum ada kasus"
            description="Mulai assessment pertama untuk memetakan kesiapan ekspor usahamu dalam enam area."
            action={{ label: "Mulai assessment pertama", onClick: mulaiKasusBaru, pending: membuat }}
          />
        )}

        {!daftar.loading && !daftar.error && kasus.length > 0 && (
          <div className="flex flex-col gap-4">
            {kasus.map((item) => {
              const aksi = aksiUtama(item)
              return (
                <article key={item.id} className="rounded-2xl border border-[#18251f]/10 bg-white/55 p-5 sm:p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-[#18251f]/40">{item.kode}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] ${CASE_STATUS_STYLE[item.status]}`}>
                          {CASE_STATUS_LABEL[item.status]}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] ${nextActionByStyle(item.nextActionBy)}`}
                        >
                          {nextActionByLabel(item.nextActionBy)}
                        </span>
                        {item.terlambat && (
                          <span className="rounded-full bg-[#f3e3dc] px-2.5 py-1 text-[11px] text-[#a75128]">
                            Terlambat
                          </span>
                        )}
                      </div>
                      <h3 className="mt-3 font-serif text-2xl">{item.produk || "Produk belum ditentukan"}</h3>
                      <p className="mt-1 text-sm text-[#18251f]/55">
                        {item.namaUsaha} <span className="px-1 text-[#18251f]/25">→</span>{" "}
                        {item.tujuan || "Tujuan belum ditentukan"}
                      </p>
                      {/* Kalimat "apa yang harus dilakukan sekarang" datang dari server. */}
                      <p className="mt-4 rounded-xl bg-[#e7ebe3]/70 px-4 py-3 text-sm leading-6 text-[#18251f]/70">
                        {item.aksiBerikutnya}
                      </p>
                    </div>
                    {aksi && (
                      <Link
                        href={aksi.href}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#18251f] px-4 py-2.5 text-sm text-[#f5f4f0] transition-transform hover:translate-x-0.5"
                      >
                        {aksi.label} <ArrowRight className="size-4" />
                      </Link>
                    )}
                  </div>

                  <div className="mt-5 grid gap-4 border-t border-[#18251f]/8 pt-5 text-xs sm:grid-cols-3">
                    <div>
                      <p className="uppercase tracking-[0.14em] text-[#18251f]/35">Tahap</p>
                      <p className="mt-1 text-sm">{item.tahap}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.14em] text-[#18251f]/35">Dikirim</p>
                      <p className="mt-1 text-sm">
                        {item.dikirimPada ? formatTanggalWaktu(item.dikirimPada) : "Belum dikirim"}
                      </p>
                      {item.dikirimPada && (
                        <p className="mt-1 flex items-center gap-1 text-[#a75128]">
                          <Clock3 className="size-3" /> {item.hariMenunggu} hari
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.14em] text-[#18251f]/35">Target ekspor</p>
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

                  {item.blocker && (
                    <div className="mt-4 rounded-xl border border-[#18251f]/8 bg-[#f5f4f0]/70 p-4">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#18251f]/35">
                        Perhatian utama · {item.blocker.ringkas}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#18251f]/60">{item.blocker.alasan}</p>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
