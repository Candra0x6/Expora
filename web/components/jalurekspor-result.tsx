"use client"

import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  Pencil,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { api } from "@/lib/api-client"
import { useResource } from "@/hooks/use-resource"
import { DisclaimerBlock, ErrorBlock, LoadingBlock } from "@/components/state-blocks"
import {
  DIMENSION_LABEL,
  DIMENSION_STATUS_LABEL,
  DIMENSION_STATUS_STYLE,
  TASK_OWNER_LABEL,
  TASK_STATUS_LABEL,
  CASE_STATUS_LABEL,
  formatTanggal,
  formatTanggalWaktu,
} from "@/lib/labels"
import type { CaseDetail, ReadinessResult } from "@/lib/types"

export function JalurEksporResult({ kode }: { kode: string }) {
  const kasus = useResource(() => api.kasus(kode), [kode])
  const kesiapan = useResource(() => api.kesiapan(kode), [kode])

  const memuat = kasus.loading || kesiapan.loading
  const error = kasus.error ?? kesiapan.error

  return (
    <main className="min-h-screen bg-[#f5f4f0] text-[#161615] antialiased">
      <header className="border-b border-black/[0.08] bg-[#f5f4f0]/90 px-5 py-4 backdrop-blur-xl md:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/umkm" className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#18251f] text-sm font-semibold text-[#f5f4f0]">
              JE
            </span>
            <span className="text-sm font-medium tracking-[-0.02em]">JalurEkspor</span>
          </Link>
          <span className="rounded-full border border-black/[0.08] bg-white/50 px-3 py-1.5 text-[11px] text-black/55">
            {kasus.data ? `Assessment ${kasus.data.versiAssessment}` : "Assessment"}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-14">
        {memuat && <LoadingBlock rows={3} />}

        {!memuat && error && (
          <ErrorBlock
            error={error}
            onRetry={() => {
              kasus.reload()
              kesiapan.reload()
            }}
            title="Hasil kesiapan tidak dapat dimuat"
          >
            <Link
              href="/umkm"
              className="mt-4 inline-flex items-center gap-2 text-xs text-[#a75128] underline underline-offset-4"
            >
              Kembali ke dashboard <ArrowRight className="size-3.5" />
            </Link>
          </ErrorBlock>
        )}

        {!memuat && !error && kasus.data && kesiapan.data && (
          <Isi kasus={kasus.data} kesiapan={kesiapan.data} kode={kode} />
        )}
      </div>
    </main>
  )
}

function Isi({ kasus, kesiapan, kode }: { kasus: CaseDetail; kesiapan: ReadinessResult; kode: string }) {
  const ditinjauPetugas = kesiapan.sumber === "OFFICER"
  const bolehAjukan = kasus.status === "DRAFT"
  const rencanaTersedia = kasus.status === "RENCANA_TERKIRIM" || kasus.status === "SELESAI"

  return (
    <>
      <div className="mb-12 flex flex-col gap-8 border-b border-black/[0.08] pb-10 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            href="/umkm"
            className="mb-7 inline-flex items-center gap-2 text-xs text-black/40 transition-colors hover:text-black"
          >
            <ArrowLeft className="size-3.5" /> Kembali ke dashboard
          </Link>
          <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-black/35">
            Profil kesiapan · {kasus.kode}
          </p>
          <h1 className="max-w-3xl text-4xl font-light leading-[1.05] tracking-[-0.055em] md:text-6xl">
            Profil kesiapan <span className="text-black/35">{kasus.namaUsaha}</span>
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-black/50">
            {kasus.produk || "Produk belum ditentukan"} <span className="mx-1 text-black/25">→</span>{" "}
            {kasus.tujuan || "Tujuan belum ditentukan"} · Dihitung {formatTanggalWaktu(kesiapan.dihitungPada)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <Link
            href={`/assessment/${kode.toLowerCase()}`}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-black/15 bg-white/40 px-4 py-2.5 text-sm transition-colors hover:bg-white"
          >
            <Pencil className="size-3.5" /> Update informasi
          </Link>

          {bolehAjukan ? (
            <Link
              href={`/kirim-untuk-ditinjau/${kode.toLowerCase()}`}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#18251f] px-4 py-2.5 text-sm text-[#f5f4f0] transition-transform hover:translate-x-0.5"
            >
              <Send className="size-3.5" /> Ajukan ke petugas
            </Link>
          ) : rencanaTersedia ? (
            <Link
              href={`/umkm/plan/${kode.toLowerCase()}`}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#18251f] px-4 py-2.5 text-sm text-[#f5f4f0] transition-transform hover:translate-x-0.5"
            >
              Buka rencana pendampingan <ArrowRight className="size-3.5" />
            </Link>
          ) : (
            <span className="inline-flex items-center justify-center gap-2 rounded-full border border-[#c47743]/30 bg-[#f0e6d7] px-4 py-2.5 text-sm text-[#8d572e]">
              <Clock3 className="size-3.5" />
              {kasus.dikirimPada
                ? `Sedang ditinjau petugas sejak ${formatTanggal(kasus.dikirimPada)}`
                : CASE_STATUS_LABEL[kasus.status]}
            </span>
          )}
        </div>
      </div>

      <div className="mb-12 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-[#18251f] p-6 text-[#f5f4f0] md:col-span-2">
          <div className="mb-10 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/45">Ringkasan singkat</span>
            <Sparkles className="size-4 text-[#b3cbb0]" />
          </div>
          <p className="max-w-2xl text-2xl font-light leading-snug tracking-[-0.03em] md:text-3xl">
            {kesiapan.ringkasan}
          </p>
        </div>

        <div className="rounded-2xl border border-black/[0.08] bg-white/45 p-6">
          <div className="mb-10 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-black/35">
            <ShieldCheck className="size-4" /> Tahap pendampingan
          </div>
          <p className="text-2xl font-medium tracking-[-0.04em]">{kesiapan.tahap}</p>
          <p className="mt-3 text-sm leading-relaxed text-black/45">{kesiapan.tahapPenjelasan}</p>

          {/* Label sumber wajib jujur (PRD #3). */}
          {ditinjauPetugas && kesiapan.ditinjauOleh ? (
            <div className="mt-7 flex items-start gap-2 rounded-xl bg-[#e4eee2] px-3 py-2.5 text-xs leading-5 text-[#3e5730]">
              <Check className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Telah ditinjau petugas · {kesiapan.ditinjauOleh.nama} · {formatTanggalWaktu(kesiapan.ditinjauOleh.pada)}
              </span>
            </div>
          ) : (
            <div className="mt-7 flex items-start gap-2 rounded-xl bg-[#f0e6d7] px-3 py-2.5 text-xs leading-5 text-[#8d572e]">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>Draft AI — belum ditinjau petugas</span>
            </div>
          )}
        </div>
      </div>

      <section className="mb-14">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-black/35">Readiness profile</p>
            <h2 className="text-2xl font-medium tracking-[-0.04em]">Enam dimensi kesiapan</h2>
          </div>
          <span className="hidden text-xs text-black/35 sm:block">Status berdasarkan jawaban terakhir</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {kesiapan.dimensi.map((item, i) => (
            <article
              key={item.dimensi}
              className="rounded-2xl border border-black/[0.08] bg-white/45 p-5 transition-colors hover:bg-white/70"
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-black/25">0{i + 1}</span>
                  <h3 className="text-base font-medium tracking-[-0.02em]">{DIMENSION_LABEL[item.dimensi]}</h3>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] ${DIMENSION_STATUS_STYLE[item.status]}`}>
                  {DIMENSION_STATUS_LABEL[item.status]}
                </span>
              </div>
              <p className="mb-5 text-sm leading-relaxed text-black/60">{item.alasan}</p>
              {item.fakta.length > 0 && (
                <div className="mb-4 flex flex-col gap-2 border-t border-black/[0.07] pt-4">
                  {item.fakta.map((fakta) => (
                    <div key={fakta} className="flex items-start gap-2 text-xs text-black/55">
                      <Check className="mt-0.5 size-3 shrink-0 text-[#789b74]" /> {fakta}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-start gap-2 rounded-xl bg-black/[0.035] px-3 py-2.5 text-xs leading-relaxed text-black/45">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-black/30" />
                <span>
                  <strong className="font-medium text-black/60">Belum ada:</strong> {item.belumAda}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mb-14">
        <div className="mb-6">
          <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-black/35">Next actions</p>
          <h2 className="text-2xl font-medium tracking-[-0.04em]">
            {kesiapan.nextActions.length > 0
              ? "Langkah yang paling membantu sekarang"
              : "Belum ada langkah yang perlu diprioritaskan"}
          </h2>
        </div>
        {kesiapan.nextActions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-black/15 px-5 py-8 text-center text-sm text-black/45">
            Semua dimensi sudah siap ditinjau. Tidak ada aksi prioritas yang tersisa.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {kesiapan.nextActions.map((action) => (
              <article
                key={action.id}
                className="group grid gap-5 rounded-2xl border border-black/[0.08] bg-white/45 p-5 md:grid-cols-[40px_minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-center"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-[#e7ebe3] font-mono text-xs text-[#4c674f]">
                  {action.urutan}
                </span>
                <div>
                  <h3 className="mb-1 text-base font-medium">{action.judul}</h3>
                  <p className="text-sm leading-relaxed text-black/50">{action.kenapa}</p>
                </div>
                <div className="flex flex-col gap-1 text-xs text-black/45">
                  <span>
                    <strong className="font-medium text-black/65">Pemilik:</strong> {TASK_OWNER_LABEL[action.owner]}
                  </span>
                  <span>
                    <strong className="font-medium text-black/65">Bukti:</strong> {action.buktiDibutuhkan}
                  </span>
                  <span>
                    <strong className="font-medium text-black/65">Prioritas:</strong> {action.prioritas}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-black/40">
                  {TASK_STATUS_LABEL[action.status]}
                  <ChevronRight className="size-3 transition-transform group-hover:translate-x-1" />
                </span>
              </article>
            ))}
          </div>
        )}
      </section>

      <DisclaimerBlock className="mb-10" />

      <footer className="flex flex-col gap-4 border-t border-black/[0.08] pt-6 text-xs text-black/35 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Kasus {kasus.kode} · {CASE_STATUS_LABEL[kasus.status]} · diperbarui{" "}
          {formatTanggalWaktu(kesiapan.dihitungPada)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <FileText className="size-3.5" /> Hasil dapat diperbarui kapan saja
        </span>
      </footer>
    </>
  )
}
