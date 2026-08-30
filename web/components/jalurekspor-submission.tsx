"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Check, Clock3, LayoutDashboard, Send, ShieldAlert, Sparkles } from "lucide-react"
import { api, ApiClientError } from "@/lib/api-client"
import { useResource } from "@/hooks/use-resource"
import { ErrorBlock, LoadingBlock } from "@/components/state-blocks"
import { Logo } from "@/components/site-header"
import {
  CASE_STATUS_LABEL,
  DIMENSION_LABEL,
  DIMENSION_STATUS_DOT,
  DIMENSION_STATUS_LABEL,
  formatTanggalWaktu,
  nextActionByLabel,
} from "@/lib/labels"
import type { CaseDetail, ReadinessResult } from "@/lib/types"

const YANG_DIKIRIM = [
  "Jawaban assessment",
  "Temuan readiness per dimensi",
  "Draft rekomendasi AI",
  "Informasi yang belum diketahui",
  "Bukti yang tersedia",
  "Referensi sumber",
]

export function JalurEksporSubmission({ kode }: { kode: string }) {
  const kasus = useResource(() => api.kasus(kode), [kode])
  const kesiapan = useResource(() => api.kesiapan(kode), [kode])

  const [dikirimPada, setDikirimPada] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiClientError | null>(null)

  async function kirim() {
    setPending(true)
    setError(null)
    try {
      const hasil = await api.kirimKasus(kode)
      setDikirimPada(hasil.dikirimPada)
      kasus.reload()
    } catch (gagal) {
      if (gagal instanceof ApiClientError) setError(gagal)
      setPending(false)
    }
  }

  const memuat = kasus.loading || kesiapan.loading
  const errorMuat = kasus.error ?? kesiapan.error
  // Status bukan DRAFT → halaman langsung menampilkan keadaan "sudah dikirim".
  const sudahDikirim = Boolean(dikirimPada) || (kasus.data ? kasus.data.status !== "DRAFT" : false)

  return (
    <main className="min-h-screen bg-[#f5f4f0] text-[#18251f]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-10">
        <Logo href="/umkm" />
        <span className="rounded-full border border-[#18251f]/10 px-3 py-1.5 text-xs text-[#18251f]/55">
          {kasus.data ? `Kasus ${kasus.data.kode}` : `Kasus ${kode.toUpperCase()}`}
        </span>
      </header>

      <div className="mx-auto max-w-6xl px-6 pb-16 lg:px-10">
        <div className="mb-10 flex flex-wrap items-center gap-3 text-sm text-[#18251f]/45">
          <Link href={`/hasil/${kode.toLowerCase()}`} className="flex items-center gap-2 hover:text-[#18251f]">
            <ArrowLeft className="size-4" />
            Hasil kesiapan
          </Link>
          <span>/</span>
          <span className="text-[#18251f]/70">Kirim untuk ditinjau</span>
        </div>

        {memuat && <LoadingBlock rows={3} />}

        {!memuat && errorMuat && (
          <ErrorBlock
            error={errorMuat}
            onRetry={() => {
              kasus.reload()
              kesiapan.reload()
            }}
            title="Ringkasan kasus tidak dapat dimuat"
          >
            <Link
              href="/umkm"
              className="mt-4 inline-flex items-center gap-2 text-xs text-[#a75128] underline underline-offset-4"
            >
              Kembali ke dashboard <ArrowRight className="size-3.5" />
            </Link>
          </ErrorBlock>
        )}

        {!memuat && !errorMuat && kasus.data && kesiapan.data && (
          <>
            {sudahDikirim ? (
              <AfterSubmission kasus={kasus.data} dikirimPada={dikirimPada ?? kasus.data.dikirimPada} />
            ) : (
              <BeforeSubmission
                kasus={kasus.data}
                kesiapan={kesiapan.data}
                kode={kode}
                pending={pending}
                error={error}
                onSubmit={kirim}
              />
            )}
          </>
        )}
      </div>
    </main>
  )
}

function BeforeSubmission({
  kasus,
  kesiapan,
  kode,
  pending,
  error,
  onSubmit,
}: {
  kasus: CaseDetail
  kesiapan: ReadinessResult
  kode: string
  pending: boolean
  error: ApiClientError | null
  onSubmit: () => void
}) {
  const areaSelesai = kesiapan.dimensi.filter((item) => item.status === "ready").length
  const belumLengkap = kesiapan.dimensi.filter(
    (item) => item.status === "pending" || item.status === "blocked" || item.status === "officer",
  ).length
  const aksiDisarankan = kesiapan.nextActions.length

  const ringkasan: [string, string][] = [
    ["UMKM", kasus.namaUsaha],
    ["Produk", kasus.produk || "Belum ditentukan"],
    ["Tujuan", kasus.tujuan || "Belum ditentukan"],
    ["Versi assessment", kasus.versiAssessment],
    ["Kode kasus", kasus.kode],
    ["Tahap", kasus.tahap],
  ]

  const belumTerjawab = Array.isArray(error?.details?.belumTerjawab)
    ? (error?.details?.belumTerjawab as string[])
    : []

  return (
    <>
      <div className="mb-10 max-w-3xl">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-[#a75128]">Review pengiriman</p>
        <h1 className="font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
          Pastikan informasi sudah siap dikirim.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[#18251f]/55">
          Petugas akan meninjau ringkasan kasus dan rekomendasi draft sebelum memberikan arahan resmi.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-[#18251f]/10 bg-white/55 p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-serif text-2xl">Ringkasan kasus</h2>
            <span className="rounded-full bg-[#e7ebe3] px-3 py-1 text-xs text-[#18251f]/65">
              {CASE_STATUS_LABEL[kasus.status]}
            </span>
          </div>
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {ringkasan.map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-[#18251f]/40">{label}</p>
                <p className="mt-1 text-sm font-medium">{value}</p>
              </div>
            ))}
          </div>
          <div className="my-7 h-px bg-[#18251f]/10" />
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-[#e7ebe3] p-4">
              <p className="font-serif text-2xl">{areaSelesai}</p>
              <p className="mt-1 text-xs text-[#18251f]/50">Area selesai</p>
            </div>
            <div className="rounded-xl bg-[#f0e6d7] p-4">
              <p className="font-serif text-2xl">{belumLengkap}</p>
              <p className="mt-1 text-xs text-[#18251f]/50">Belum lengkap</p>
            </div>
            <div className="rounded-xl bg-[#eeeee9] p-4">
              <p className="font-serif text-2xl">{aksiDisarankan}</p>
              <p className="mt-1 text-xs text-[#18251f]/50">Aksi disarankan</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#18251f]/10 bg-[#18251f] p-6 text-[#f5f4f0] sm:p-8">
          <Sparkles className="mb-8 size-5 text-[#d48651]" />
          <h2 className="font-serif text-2xl">Yang akan dikirim</h2>
          <ul className="mt-6 flex flex-col gap-4 text-sm text-[#f5f4f0]/65">
            {YANG_DIKIRIM.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <Check className="size-4 shrink-0 text-[#d48651]" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-8 rounded-xl border border-[#f5f4f0]/15 p-4 text-xs leading-5 text-[#f5f4f0]/55">
            Tidak ada keputusan kepabeanan resmi yang dibuat oleh sistem ini.
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-[#18251f]/10 bg-white/55 p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl">Profil kesiapan</h2>
            <p className="mt-1 text-sm text-[#18251f]/50">
              Informasi ringkas yang akan membantu petugas memulai peninjauan.
            </p>
          </div>
          <Link
            href={`/hasil/${kode.toLowerCase()}`}
            className="hidden items-center gap-2 text-sm text-[#a75128] sm:flex"
          >
            Lihat hasil <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {kesiapan.dimensi.map((item) => (
            <div
              key={item.dimensi}
              className="flex gap-3 rounded-xl border border-[#18251f]/8 bg-[#f5f4f0]/65 p-4"
            >
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${DIMENSION_STATUS_DOT[item.status]}`} />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium">{DIMENSION_LABEL[item.dimensi]}</h3>
                  <span className="text-[11px] text-[#18251f]/40">{DIMENSION_STATUS_LABEL[item.status]}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[#18251f]/50">{item.alasan}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[#c47743]/30 bg-[#f0e6d7]/50 p-6 sm:p-8">
        <div className="flex gap-4">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-[#a75128]" />
          <div>
            <h2 className="font-medium">Penting sebelum mengirim</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#18251f]/65">
              Draft rekomendasi ini dibuat untuk membantu persiapan dan{" "}
              <strong className="font-medium text-[#18251f]">bukan keputusan resmi kepabeanan</strong>. Petugas harus
              meninjau informasi, bukti, dan konteks kasus sebelum memberikan arahan lebih lanjut.
            </p>
          </div>
        </div>
      </section>

      {error && (
        <section className="mt-6 rounded-2xl border border-[#a75128]/30 bg-[#f3e3dc]/70 p-6">
          <p className="font-medium text-[#a75128]">Kasus belum bisa dikirim</p>
          {/* Teks dari server, apa adanya. */}
          <p className="mt-2 text-sm leading-6 text-[#18251f]/70">{error.message}</p>
          {belumTerjawab.length > 0 && (
            <>
              <p className="mt-4 text-xs uppercase tracking-[0.14em] text-[#a75128]/70">
                Pertanyaan yang belum terjawab
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {belumTerjawab.map((id) => (
                  <li key={id} className="rounded-full bg-white/70 px-3 py-1 font-mono text-[11px] text-[#18251f]/65">
                    {id}
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link
            href={`/assessment/${kode.toLowerCase()}`}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#a75128] px-4 py-2.5 text-sm text-white"
          >
            Kembali ke assessment <ArrowRight className="size-4" />
          </Link>
        </section>
      )}

      <div className="mt-8 flex flex-col-reverse items-stretch justify-between gap-4 sm:flex-row sm:items-center">
        <Link
          href={`/assessment/${kode.toLowerCase()}`}
          className="text-center text-sm text-[#18251f]/55 hover:text-[#18251f] sm:text-left"
        >
          Perbarui informasi
        </Link>
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending}
          className="flex items-center justify-center gap-2 rounded-full bg-[#18251f] px-6 py-3 text-sm text-[#f5f4f0] transition-transform hover:translate-x-0.5 disabled:opacity-60"
        >
          {pending ? "Mengirim…" : "Kirim untuk ditinjau"} <Send className="size-4" />
        </button>
      </div>
    </>
  )
}

function AfterSubmission({ kasus, dikirimPada }: { kasus: CaseDetail; dikirimPada: string | null }) {
  const rencanaSiap = kasus.status === "RENCANA_TERKIRIM" || kasus.status === "SELESAI"
  const judul = rencanaSiap
    ? "Rencana pendampingan sudah tersedia"
    : kasus.status === "MENUNGGU_UMKM"
      ? "Petugas menunggu informasi tambahan"
      : "Menunggu tinjauan petugas"
  const penjelasan = rencanaSiap
    ? `Kasus ${kasus.namaUsaha} sudah ditinjau petugas dan rencana pendampingannya bisa dibuka.`
    : kasus.status === "MENUNGGU_UMKM"
      ? `Kasus ${kasus.namaUsaha} sudah dikirim, tetapi petugas meminta informasi tambahan sebelum melanjutkan.`
      : `Kasus ${kasus.namaUsaha} sudah masuk ke antrean peninjauan. Belum ada rekomendasi yang ditinjau petugas pada tahap ini.`

  return (
    <div className="mx-auto max-w-2xl py-10 text-center sm:py-20">
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-[#e7ebe3]">
        <Clock3 className="size-7 text-[#55715e]" />
      </div>
      <p className="mt-8 text-xs font-medium uppercase tracking-[0.22em] text-[#a75128]">Kasus sudah dikirim</p>
      <h1 className="mt-3 font-serif text-4xl leading-tight tracking-tight sm:text-5xl">{judul}</h1>
      <p className="mx-auto mt-5 max-w-lg text-base leading-7 text-[#18251f]/55">{penjelasan}</p>

      <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
        <div className="rounded-xl border border-[#18251f]/10 bg-white/55 p-4">
          <p className="text-xs text-[#18251f]/40">Dikirim pada</p>
          <p className="mt-1 text-sm font-medium">{formatTanggalWaktu(dikirimPada)}</p>
        </div>
        <div className="rounded-xl border border-[#18251f]/10 bg-white/55 p-4">
          <p className="text-xs text-[#18251f]/40">Status kasus</p>
          <p className="mt-1 text-sm font-medium">{CASE_STATUS_LABEL[kasus.status]}</p>
        </div>
        <div className="rounded-xl border border-[#18251f]/10 bg-white/55 p-4">
          <p className="text-xs text-[#18251f]/40">Giliran bertindak</p>
          <p className="mt-1 text-sm font-medium">{nextActionByLabel(kasus.nextActionBy)}</p>
        </div>
      </div>

      <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href="/umkm"
          className="flex items-center justify-center gap-2 rounded-full bg-[#18251f] px-5 py-3 text-sm text-[#f5f4f0]"
        >
          <LayoutDashboard className="size-4" /> Kembali ke dashboard
        </Link>
        {rencanaSiap ? (
          <Link
            href={`/umkm/plan/${kasus.kode.toLowerCase()}`}
            className="flex items-center justify-center gap-2 rounded-full border border-[#18251f]/15 px-5 py-3 text-sm"
          >
            Buka rencana pendampingan <ArrowRight className="size-4" />
          </Link>
        ) : (
          <Link
            href={`/hasil/${kasus.kode.toLowerCase()}`}
            className="flex items-center justify-center gap-2 rounded-full border border-[#18251f]/15 px-5 py-3 text-sm"
          >
            Lihat hasil kesiapan <ArrowRight className="size-4" />
          </Link>
        )}
      </div>

      <p className="mt-10 text-xs text-[#18251f]/35">
        Riwayat pendampingan lengkap tersedia di rencana setelah petugas selesai meninjau.
      </p>
    </div>
  )
}
