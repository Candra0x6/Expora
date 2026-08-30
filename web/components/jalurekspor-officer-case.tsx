"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  CircleAlert,
  FileText,
  Flag,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Trash2,
  Upload,
} from "lucide-react"
import { api, ApiClientError, type PlanTaskInput } from "@/lib/api-client"
import { useResource, type Resource } from "@/hooks/use-resource"
import { DisclaimerBlock, ErrorBlock, LoadingBlock, LoadingLines, FormError } from "@/components/state-blocks"
import { LogoutButton } from "@/components/site-header"
import {
  actorRoleLabel,
  CASE_STATUS_LABEL,
  CASE_STATUS_STYLE,
  CONFIDENCE_LABEL,
  CONFIDENCE_STYLE,
  DIMENSION_LABEL,
  DIMENSION_STATUS_LABEL,
  DIMENSION_STATUS_STYLE,
  TASK_OWNER_LABEL,
  formatMenunggu,
  formatTanggal,
  formatTanggalWaktu,
  formatUkuran,
} from "@/lib/labels"
import { DIMENSION_ORDER } from "@/lib/types"
import type { CaseDetail, Dimension, TaskOwner } from "@/lib/types"

const OWNER_PILIHAN: TaskOwner[] = ["UMKM", "PETUGAS", "UMKM_DAN_PENDAMPING"]

export function JalurEksporOfficerCase({ kode }: { kode: string }) {
  const kasus = useResource(() => api.kasus(kode), [kode])
  const kesiapan = useResource(() => api.kesiapan(kode), [kode])
  const draft = useResource(() => api.draft(kode), [kode])
  const riwayat = useResource(() => api.riwayat(kode), [kode])
  const tugas = useResource(() => api.tugas(kode), [kode])

  const [panel, setPanel] = useState<string | null>(null)
  const [rencanaTerbuka, setRencanaTerbuka] = useState(false)
  const [gateError, setGateError] = useState<ApiClientError | null>(null)

  const bukaPanel = (nama: string) => setPanel((current) => (current === nama ? null : nama))

  function segarkan() {
    kasus.reload()
    kesiapan.reload()
    draft.reload()
    riwayat.reload()
    tugas.reload()
  }

  const detail = kasus.data
  const kodeTampil = detail?.kode ?? kode.toUpperCase()

  // Bukti kasus: gabungan dari permintaan-info yang sudah dijawab + tugas, dikirim server di CaseDetail.bukti.
  const bukti = detail?.bukti ?? []

  return (
    <main className="min-h-screen bg-[#f5f4f0] text-[#18251f]">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-6 lg:px-10">
        <Link href="/petugas/antrian" className="flex items-center gap-2 text-sm text-[#18251f]/60">
          <ArrowLeft className="size-4" /> Antrean review
        </Link>
        <div className="flex items-center gap-3 text-xs text-[#18251f]/45">
          <span>Ruang petugas · Kasus {kodeTampil}</span>
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 pb-20 lg:px-10">
        {/* ---------------------------------------------------------------- header kasus */}
        <section className="rounded-3xl border border-[#18251f]/10 bg-[#18251f] p-6 text-[#f5f4f0] sm:p-8">
          {kasus.loading && (
            <div className="flex flex-col gap-3">
              <div className="h-3 w-40 animate-pulse rounded bg-white/15" />
              <div className="h-10 w-72 animate-pulse rounded bg-white/15" />
              <div className="h-3 w-56 animate-pulse rounded bg-white/15" />
            </div>
          )}

          {!kasus.loading && kasus.error && (
            <div className="flex flex-col gap-3">
              <p className="flex items-center gap-2 text-sm text-[#f0e6d7]">
                <CircleAlert className="size-4" /> Kasus tidak dapat dimuat
              </p>
              <p className="text-sm text-[#f5f4f0]/65">{kasus.error.message}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={kasus.reload}
                  className="w-fit rounded-full border border-[#f5f4f0]/25 px-4 py-2 text-xs"
                >
                  Coba lagi
                </button>
                <Link
                  href="/petugas/antrian"
                  className="w-fit rounded-full border border-[#f5f4f0]/25 px-4 py-2 text-xs"
                >
                  Kembali ke antrean
                </Link>
              </div>
            </div>
          )}

          {detail && (
            <>
              <div className="flex flex-col justify-between gap-6 lg:flex-row">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#c47743]">Review kasus · {detail.kode}</p>
                  <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">{detail.namaUsaha}</h1>
                  <p className="mt-2 text-sm text-[#f5f4f0]/65">
                    {detail.produk || "Produk belum ditentukan"} <span className="px-1">→</span>{" "}
                    {detail.tujuan || "Tujuan belum ditentukan"}
                  </p>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <span className={`rounded-full px-3 py-1.5 text-xs ${CASE_STATUS_STYLE[detail.status]}`}>
                    {CASE_STATUS_LABEL[detail.status]}
                  </span>
                  <span className="rounded-full border border-[#f5f4f0]/15 px-3 py-1.5 text-xs text-[#f5f4f0]/65">
                    {formatMenunggu(detail.hariMenunggu)}
                  </span>
                </div>
              </div>

              <div className="mt-8 grid gap-4 border-t border-[#f5f4f0]/10 pt-5 sm:grid-cols-2 lg:grid-cols-5">
                {(
                  [
                    ["Skenario", `${detail.namaUsaha} · ${detail.tahap}`],
                    ["Assessment", detail.versiAssessment],
                    ["Rekomendasi", draft.data?.versi ?? (draft.loading ? "…" : "Belum ada")],
                    ["Dikirim", detail.dikirimPada ? formatTanggalWaktu(detail.dikirimPada) : "Belum dikirim"],
                    ["Target ekspor", detail.targetEkspor ? formatTanggal(detail.targetEkspor) : "Belum ditentukan"],
                  ] as [string, string][]
                ).map(([label, nilai]) => (
                  <div key={label}>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[#f5f4f0]/40">{label}</p>
                    <p className="mt-1 text-sm">{nilai}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-8">
            {/* ------------------------------------------------------------ 01 konteks */}
            <section>
              <p className="text-xs uppercase tracking-[0.2em] text-[#a75128]">01 · Konteks kasus</p>
              <h2 className="mt-2 font-serif text-3xl">Fakta yang perlu dibaca bersama.</h2>
              {kasus.loading && <LoadingBlock rows={1} className="mt-4" />}
              {!kasus.loading && detail && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["Status buyer", detail.konteks.statusBuyer],
                      ["Pengalaman ekspor", detail.konteks.pengalamanEkspor],
                      ["Metode pengiriman", detail.konteks.metodePengiriman],
                      [
                        "Target tanggal",
                        detail.konteks.targetTanggal ? formatTanggal(detail.konteks.targetTanggal) : "Belum ditentukan",
                      ],
                    ] as [string, string][]
                  ).map(([label, nilai]) => (
                    <div key={label} className="rounded-2xl border border-[#18251f]/10 bg-white/55 p-4">
                      <p className="text-xs text-[#18251f]/45">{label}</p>
                      <p className="mt-2 text-sm">{nilai}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ------------------------------------------------------------ 02 readiness */}
            <section>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#a75128]">02 · Readiness profile</p>
                  <h2 className="mt-2 font-serif text-3xl">Enam dimensi kesiapan.</h2>
                </div>
                <span className="hidden text-xs text-[#18251f]/40 sm:block">Alasan selalu terlihat</span>
              </div>

              {kesiapan.loading && <LoadingBlock rows={3} className="mt-4" />}
              {!kesiapan.loading && kesiapan.error && (
                <div className="mt-4">
                  <ErrorBlock
                    error={kesiapan.error}
                    onRetry={kesiapan.reload}
                    title="Profil kesiapan tidak dapat dimuat"
                  />
                </div>
              )}
              {!kesiapan.loading && kesiapan.data && (
                <div className="mt-4 flex flex-col gap-3">
                  {kesiapan.data.dimensi.map((item) => (
                    <div key={item.dimensi} className="rounded-2xl border border-[#18251f]/10 bg-white/55 p-4">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div>
                          <h3 className="text-sm font-medium">{DIMENSION_LABEL[item.dimensi]}</h3>
                          <p className="mt-1 text-sm leading-6 text-[#18251f]/60">{item.alasan}</p>
                        </div>
                        <span
                          className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs ${DIMENSION_STATUS_STYLE[item.status]}`}
                        >
                          {DIMENSION_STATUS_LABEL[item.status]}
                        </span>
                      </div>
                      <div className="mt-3 border-t border-[#18251f]/8 pt-3 text-xs text-[#18251f]/45">
                        <p className="flex items-start gap-2">
                          <FileText className="mt-0.5 size-3.5 shrink-0" />
                          <span>
                            Fakta pendukung:{" "}
                            {item.fakta.length > 0 ? item.fakta.join(" · ") : "belum ada fakta yang tercatat"}
                          </span>
                        </p>
                        <p className="mt-1.5 pl-5">Belum ada: {item.belumAda}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ------------------------------------------------------------ AI draft */}
            <section className="rounded-2xl border border-[#c47743]/25 bg-[#f0e6d7] p-5">
              {draft.loading && <LoadingLines rows={4} />}
              {!draft.loading && draft.error && (
                <div className="flex gap-3">
                  <CircleAlert className="mt-0.5 size-5 shrink-0 text-[#a75128]" />
                  <div>
                    <p className="font-medium text-[#a75128]">Draft rekomendasi tidak dapat dimuat</p>
                    <p className="mt-2 text-sm leading-6 text-[#18251f]/70">{draft.error.message}</p>
                    <button
                      type="button"
                      onClick={draft.reload}
                      className="mt-3 rounded-full border border-[#a75128]/30 bg-white/60 px-4 py-2 text-xs text-[#a75128]"
                    >
                      Coba lagi
                    </button>
                  </div>
                </div>
              )}
              {!draft.loading && draft.data && (
                <div className="flex gap-3">
                  <Sparkles className="mt-0.5 size-5 shrink-0 text-[#a75128]" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-[#a75128]">
                        {draft.data.sumber === "AI" ? "AI draft" : "Versi petugas"} · {draft.data.versi}
                      </p>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] ${CONFIDENCE_STYLE[draft.data.keyakinan]}`}
                      >
                        {CONFIDENCE_LABEL[draft.data.keyakinan]}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{draft.data.isi}</p>
                    <p className="mt-3 text-xs leading-5 text-[#18251f]/55">
                      Dibuat {formatTanggalWaktu(draft.data.dibuatPada)} · Alasan review: {draft.data.alasanReview}
                    </p>
                    {draft.data.versiSebelumnya.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-[#a75128]/15 pt-3">
                        <span className="text-[11px] text-[#18251f]/45">Riwayat versi:</span>
                        {draft.data.versiSebelumnya.map((versi) => (
                          <span
                            key={versi.versi}
                            className="rounded-full bg-white/70 px-2.5 py-1 font-mono text-[10px] text-[#18251f]/60"
                          >
                            {versi.versi} · {versi.sumber} · {formatTanggal(versi.dibuatPada)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* ------------------------------------------------------------ 03 data pendukung */}
            <section>
              <p className="text-xs uppercase tracking-[0.2em] text-[#a75128]">03 · Data pendukung</p>
              <h2 className="mt-2 font-serif text-3xl">Yang dipakai dan yang belum jelas.</h2>

              {draft.loading && <LoadingBlock rows={2} className="mt-4" />}

              {!draft.loading && draft.data && (
                <>
                  <div className="mt-4 overflow-x-auto rounded-2xl border border-[#18251f]/10 bg-white/55">
                    <div className="min-w-[560px]">
                      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 border-b border-[#18251f]/10 px-4 py-3 text-[10px] uppercase tracking-wider text-[#18251f]/40">
                        <span>Fakta</span>
                        <span>Nilai</span>
                        <span>Asal</span>
                        <span>Status</span>
                      </div>
                      {draft.data.fakta.length === 0 && (
                        <p className="px-4 py-6 text-center text-xs text-[#18251f]/45">
                          Belum ada fakta pendukung yang tercatat.
                        </p>
                      )}
                      {draft.data.fakta.map((fakta) => (
                        <div
                          key={`${fakta.label}-${fakta.nilai}`}
                          className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 border-b border-[#18251f]/8 px-4 py-3 text-xs last:border-0"
                        >
                          <span className="font-medium">{fakta.label}</span>
                          <span>{fakta.nilai}</span>
                          <span className="text-[#18251f]/50">{fakta.asal}</span>
                          <span className={fakta.dikonfirmasi ? "text-[#4c674f]" : "text-[#a75128]"}>
                            {fakta.dikonfirmasi ? "Dikonfirmasi" : "Belum dikonfirmasi"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[#a75128]/20 bg-[#f3e3dc] p-4">
                      <p className="text-xs uppercase tracking-wider text-[#a75128]">Informasi yang belum diketahui</p>
                      {draft.data.belumDiketahui.length === 0 ? (
                        <p className="mt-2 text-sm text-[#18251f]/55">Tidak ada informasi yang ditandai belum jelas.</p>
                      ) : (
                        <ul className="mt-2 flex flex-col gap-3">
                          {draft.data.belumDiketahui.map((item) => (
                            <li key={item.teks}>
                              <p className="text-sm leading-6">{item.teks}</p>
                              <p className="mt-1 text-xs text-[#18251f]/50">
                                Terkait: {item.dimensiTerkait.map((d) => DIMENSION_LABEL[d]).join(" · ")}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="rounded-2xl border border-[#18251f]/10 bg-white/55 p-4">
                      <p className="text-xs uppercase tracking-wider text-[#18251f]/45">Referensi sumber</p>
                      {draft.data.sumberReferensi.length === 0 ? (
                        <p className="mt-2 text-sm text-[#18251f]/55">Belum ada referensi sumber yang dilampirkan.</p>
                      ) : (
                        <ul className="mt-2 flex flex-col gap-3">
                          {draft.data.sumberReferensi.map((sumber) => (
                            <li key={sumber.judul}>
                              <p className="text-sm">
                                {sumber.url ? (
                                  <a
                                    href={sumber.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline underline-offset-4"
                                  >
                                    {sumber.judul}
                                  </a>
                                ) : (
                                  sumber.judul
                                )}{" "}
                                <span className="text-[#18251f]/45">
                                  · {sumber.penerbit} · {sumber.tahun}
                                </span>
                              </p>
                              <p className="mt-1 text-xs text-[#18251f]/50">Mendukung: {sumber.mendukung}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* ------------------------------------------------------------ evidence + usulan */}
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#18251f]/10 bg-white/55 p-5">
                <div className="flex items-center gap-2">
                  <Upload className="size-4 text-[#a75128]" />
                  <p className="text-xs uppercase tracking-wider text-[#a75128]">Evidence tersedia</p>
                </div>
                {kasus.loading && <LoadingLines rows={2} className="mt-4" />}
                {!kasus.loading && kasus.error && (
                  <div className="mt-4">
                    <p className="text-sm leading-6 text-[#a75128]">{kasus.error.message}</p>
                    <button
                      type="button"
                      onClick={kasus.reload}
                      className="mt-2 rounded-full border border-[#a75128]/30 px-3 py-1.5 text-xs text-[#a75128]"
                    >
                      Coba lagi
                    </button>
                  </div>
                )}
                {!kasus.loading && !kasus.error && bukti.length === 0 && (
                  <p className="mt-4 text-sm text-[#18251f]/50">Belum ada berkas bukti yang terlampir pada kasus ini.</p>
                )}
                {!kasus.loading && !kasus.error && bukti.length > 0 && (
                  <ul className="mt-4 flex flex-col gap-2">
                    {bukti.map((file) => (
                      <li key={file.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <Paperclip className="size-3.5 shrink-0 text-[#a75128]" />
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-4 hover:text-[#a75128]"
                        >
                          {file.namaBerkas}
                        </a>
                        <span className="text-xs text-[#18251f]/45">
                          · {file.tipe.toUpperCase()} · {formatUkuran(file.ukuranBytes)} ·{" "}
                          {file.dikonfirmasi ? "dikonfirmasi" : "belum dikonfirmasi"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border border-[#18251f]/10 bg-white/55 p-5">
                <div className="flex items-center gap-2">
                  <Check className="size-4 text-[#a75128]" />
                  <p className="text-xs uppercase tracking-wider text-[#a75128]">Usulan next actions</p>
                </div>
                {kesiapan.loading && <LoadingLines rows={3} className="mt-4" />}
                {!kesiapan.loading && kesiapan.data && kesiapan.data.nextActions.length === 0 && (
                  <p className="mt-4 text-sm text-[#18251f]/50">Belum ada usulan aksi prioritas.</p>
                )}
                {!kesiapan.loading && kesiapan.data && kesiapan.data.nextActions.length > 0 && (
                  <ol className="mt-4 flex flex-col gap-3 text-sm">
                    {kesiapan.data.nextActions.map((action) => (
                      <li key={action.id}>
                        <b>{action.urutan}.</b> {action.judul}
                        <span className="block pl-5 text-xs text-[#18251f]/50">
                          Owner: {TASK_OWNER_LABEL[action.owner]} · prioritas: {action.prioritas}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>

            {/* ------------------------------------------------------------ 04 timeline */}
            <section>
              <p className="text-xs uppercase tracking-[0.2em] text-[#a75128]">04 · Timeline kasus</p>
              {riwayat.loading && <LoadingLines rows={4} className="mt-4" />}
              {!riwayat.loading && riwayat.error && (
                <div className="mt-4">
                  <ErrorBlock error={riwayat.error} onRetry={riwayat.reload} title="Riwayat tidak dapat dimuat" />
                </div>
              )}
              {!riwayat.loading && riwayat.data && riwayat.data.length === 0 && (
                <p className="mt-4 rounded-2xl border border-dashed border-[#18251f]/15 px-4 py-8 text-center text-sm text-[#18251f]/45">
                  Belum ada aktivitas yang tercatat pada kasus ini.
                </p>
              )}
              {!riwayat.loading && riwayat.data && riwayat.data.length > 0 && (
                <div className="mt-4 flex flex-col gap-4 border-l border-[#18251f]/15 pl-5 text-sm">
                  {riwayat.data.map((event) => (
                    <div key={event.id} className="relative">
                      <span className="absolute -left-[25px] top-1.5 size-2 rounded-full bg-[#a75128]" />
                      <p className="text-xs text-[#18251f]/40">
                        {formatTanggalWaktu(event.pada)} · {event.aktor} ({actorRoleLabel(event.peranAktor)})
                      </p>
                      <p className="mt-1">{event.judul}</p>
                      <p className="mt-0.5 text-xs text-[#18251f]/50">{event.ringkasan}</p>
                      {event.versi && (
                        <span className="mt-1.5 inline-block rounded-md bg-[#18251f]/5 px-2 py-1 font-mono text-[10px] text-[#18251f]/45">
                          {event.versi}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ------------------------------------------------------------ 05 rencana */}
            {rencanaTerbuka && kasus.data && (
              <PlanEditor
                kode={kode}
                usulan={(kesiapan.data?.nextActions ?? []).map((action) => ({
                  judul: action.judul,
                  penjelasan: action.kenapa,
                  owner: action.owner,
                  buktiDibutuhkan: action.buktiDibutuhkan,
                  targetSelesai: null,
                }))}
                ringkasanAwal={kesiapan.data?.ringkasan ?? ""}
                onGate={setGateError}
                onSelesai={() => {
                  setRencanaTerbuka(false)
                  setGateError(null)
                  segarkan()
                }}
              />
            )}

            <DisclaimerBlock />
          </div>

          {/* ---------------------------------------------------------------- panel aksi */}
          <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
            <CatatanInternal kode={kode} kasus={kasus} />

            <div className="rounded-2xl border border-[#18251f]/10 bg-white/65 p-5">
              <p className="text-xs uppercase tracking-wider text-[#a75128]">Tindakan review</p>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => bukaPanel("request")}
                  className="flex items-center justify-between rounded-xl border border-[#18251f]/10 px-4 py-3 text-sm hover:bg-[#e7ebe3]"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="size-4" /> Request Information
                  </span>
                  <ChevronDown className={`size-4 transition-transform ${panel === "request" ? "rotate-180" : ""}`} />
                </button>

                <button
                  type="button"
                  onClick={() => bukaPanel("edit")}
                  className="flex items-center justify-between rounded-xl border border-[#18251f]/10 px-4 py-3 text-sm hover:bg-[#e7ebe3]"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="size-4" /> Edit Recommendation
                  </span>
                  <ChevronDown className={`size-4 transition-transform ${panel === "edit" ? "rotate-180" : ""}`} />
                </button>

                <button
                  type="button"
                  onClick={() => bukaPanel("escalate")}
                  className="flex items-center justify-between rounded-xl border border-[#a75128]/20 px-4 py-3 text-sm text-[#a75128] hover:bg-[#f3e3dc]"
                >
                  <span className="flex items-center gap-2">
                    <Flag className="size-4" /> Escalate
                  </span>
                  <ChevronDown className={`size-4 transition-transform ${panel === "escalate" ? "rotate-180" : ""}`} />
                </button>

                <button
                  type="button"
                  onClick={() => setRencanaTerbuka((current) => !current)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#18251f] px-4 py-3 text-sm text-[#f5f4f0] hover:opacity-90"
                >
                  <Send className="size-4" /> {rencanaTerbuka ? "Tutup editor rencana" : "Tinjau & kirim rencana"}
                </button>
              </div>

              {panel === "request" && <PanelPermintaanInfo kode={kode} onSelesai={segarkan} />}
              {panel === "edit" && (
                <PanelEditRekomendasi
                  kode={kode}
                  isiAwal={draft.data?.isi ?? ""}
                  versiAI={draft.data?.versi ?? "—"}
                  onSelesai={() => {
                    draft.reload()
                    riwayat.reload()
                  }}
                />
              )}
              {panel === "escalate" && <PanelEskalasi kode={kode} onSelesai={segarkan} />}

              {/* Gerbang officer-in-the-loop: fitur, bukan error. Jangan dikubur di toast. */}
              {gateError && (
                <div className="mt-4 rounded-xl border border-[#c47743]/40 bg-[#f0e6d7] p-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-[#8d572e]">
                    <ShieldCheck className="size-4" /> Rencana belum bisa dikirim
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[#18251f]/70">{gateError.message}</p>
                  {Array.isArray(gateError.details?.dimensiBelumDitinjau) && (
                    <>
                      <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-[#8d572e]/70">
                        Dimensi yang belum ditinjau
                      </p>
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {(gateError.details.dimensiBelumDitinjau as Dimension[]).map((dimensi) => (
                          <li
                            key={dimensi}
                            className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] text-[#18251f]/70"
                          >
                            {DIMENSION_LABEL[dimensi] ?? dimensi}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-xs leading-5 text-[#18251f]/60">
                        Tambahkan catatan internal, edit rekomendasi, atau minta informasi terkait dimensi itu lebih
                        dulu.
                      </p>
                    </>
                  )}
                </div>
              )}

              {kasus.data?.eskalasi && (
                <div className="mt-4 rounded-xl border border-[#a75128]/25 bg-[#f3e3dc] p-4">
                  <p className="text-xs uppercase tracking-wider text-[#a75128]">Kasus dieskalasi</p>
                  <p className="mt-2 text-sm">{DIMENSION_LABEL[kasus.data.eskalasi.kategori]}</p>
                  <p className="mt-1 text-xs leading-5 text-[#18251f]/60">{kasus.data.eskalasi.alasan}</p>
                  <p className="mt-2 text-[11px] text-[#18251f]/40">
                    {kasus.data.eskalasi.olehNama} · {formatTanggalWaktu(kasus.data.eskalasi.dibuatPada)}
                  </p>
                </div>
              )}

              {kasus.data?.ditinjauOleh && (
                <div className="mt-4 rounded-xl border border-[#55715e]/25 bg-[#e7ebe3] p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ShieldCheck className="size-4" /> Sudah ditinjau petugas
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#18251f]/60">
                    {kasus.data.ditinjauOleh.nama} · {formatTanggalWaktu(kasus.data.ditinjauOleh.pada)}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#a75128]/20 bg-[#f3e3dc] p-5">
              <div className="flex gap-2">
                <AlertTriangle className="size-4 shrink-0 text-[#a75128]" />
                <p className="text-xs leading-5 text-[#18251f]/65">
                  Rekomendasi ini adalah draft pendampingan. Bukan keputusan resmi kepabeanan. Validasi petugas
                  diperlukan sebelum disampaikan sebagai rencana.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Panel aksi
// ---------------------------------------------------------------------------

function CatatanInternal({
  kode,
  kasus,
}: {
  kode: string
  kasus: Resource<CaseDetail>
}) {
  const [isi, setIsi] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function simpan() {
    if (!isi.trim()) return
    setPending(true)
    setError(null)
    try {
      await api.simpanCatatan(kode, isi.trim())
      setIsi("")
      toast.success("Catatan internal tersimpan.")
      kasus.reload()
    } catch (gagal) {
      setError(gagal instanceof ApiClientError ? gagal.message : null)
    } finally {
      setPending(false)
    }
  }

  const catatan = kasus.data?.catatanInternal ?? []

  return (
    <div className="rounded-2xl border border-[#18251f]/10 bg-white/65 p-5">
      <div className="flex items-center gap-2">
        <StickyNote className="size-4 text-[#a75128]" />
        <p className="text-xs uppercase tracking-wider text-[#a75128]">Catatan internal</p>
      </div>
      <p className="mt-2 text-[11px] text-[#18251f]/40">Tidak pernah terlihat oleh UMKM.</p>

      <textarea
        value={isi}
        onChange={(event) => setIsi(event.target.value)}
        placeholder="Tulis catatan yang hanya terlihat petugas…"
        className="mt-3 min-h-24 w-full resize-none rounded-xl border border-[#18251f]/10 bg-[#f5f4f0] p-3 text-sm outline-none placeholder:text-[#18251f]/35"
      />
      <div className="mt-2">
        <FormError message={error} />
      </div>
      <button
        type="button"
        onClick={simpan}
        disabled={pending || !isi.trim()}
        className="mt-3 w-full rounded-full border border-[#18251f]/15 px-4 py-2 text-xs disabled:opacity-50"
      >
        {pending ? "Menyimpan…" : "Simpan catatan"}
      </button>

      {catatan.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 border-t border-[#18251f]/8 pt-4">
          {catatan.map((item) => (
            <div key={item.id} className="rounded-xl bg-[#f5f4f0] p-3">
              <p className="text-xs leading-5 text-[#18251f]/70">{item.isi}</p>
              <p className="mt-1.5 text-[10px] text-[#18251f]/40">
                {item.olehNama} · {formatTanggalWaktu(item.dibuatPada)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PanelPermintaanInfo({ kode, onSelesai }: { kode: string; onSelesai: () => void }) {
  const [judul, setJudul] = useState("")
  const [pesan, setPesan] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function kirim() {
    setPending(true)
    setError(null)
    try {
      await api.mintaInfo(kode, { judul: judul.trim(), pesan: pesan.trim() })
      setJudul("")
      setPesan("")
      toast.success("Permintaan informasi dikirim ke UMKM.")
      onSelesai()
    } catch (gagal) {
      setError(gagal instanceof ApiClientError ? gagal.message : null)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-4 rounded-xl bg-[#f5f4f0] p-4">
      <p className="text-sm font-medium">Minta informasi dari UMKM</p>
      <input
        value={judul}
        onChange={(event) => setJudul(event.target.value)}
        placeholder="Informasi yang dibutuhkan"
        className="mt-3 w-full rounded-lg border border-[#18251f]/10 bg-white p-2.5 text-xs outline-none"
      />
      <textarea
        value={pesan}
        onChange={(event) => setPesan(event.target.value)}
        placeholder="Pesan untuk UMKM"
        className="mt-2 min-h-16 w-full rounded-lg border border-[#18251f]/10 bg-white p-2.5 text-xs outline-none"
      />
      <div className="mt-2">
        <FormError message={error} />
      </div>
      <button
        type="button"
        onClick={kirim}
        disabled={pending || !judul.trim() || !pesan.trim()}
        className="mt-2 w-full rounded-full bg-[#a75128] px-3 py-2 text-xs text-white disabled:opacity-50"
      >
        {pending ? "Mengirim…" : "Kirim permintaan"}
      </button>
    </div>
  )
}

function PanelEditRekomendasi({
  kode,
  isiAwal,
  versiAI,
  onSelesai,
}: {
  kode: string
  isiAwal: string
  versiAI: string
  onSelesai: () => void
}) {
  const [isi, setIsi] = useState(isiAwal)
  const [alasan, setAlasan] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function simpan() {
    setPending(true)
    setError(null)
    try {
      const hasil = await api.simpanRekomendasi(kode, { isi: isi.trim(), alasanPerubahan: alasan.trim() })
      toast.success(`Versi ${hasil.versi} tersimpan. Versi ${versiAI} tetap tersimpan.`)
      setAlasan("")
      onSelesai()
    } catch (gagal) {
      setError(gagal instanceof ApiClientError ? gagal.message : null)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-4 rounded-xl bg-[#f5f4f0] p-4">
      <p className="text-sm font-medium">Edit Recommendation</p>
      <p className="mt-2 text-xs text-[#18251f]/45">
        Versi asli tersimpan permanen sebagai <span className="font-mono">{versiAI}</span> dan tidak ditimpa.
      </p>

      {/* Versi asli ditampilkan berdampingan dengan editor — jejak officer-in-the-loop. */}
      <div className="mt-3 rounded-lg border border-[#18251f]/10 bg-white/70 p-2.5">
        <p className="text-[10px] uppercase tracking-[0.14em] text-[#18251f]/40">Versi {versiAI}</p>
        <p className="mt-1.5 max-h-28 overflow-y-auto whitespace-pre-wrap text-[11px] leading-5 text-[#18251f]/60">
          {isiAwal || "—"}
        </p>
      </div>

      <textarea
        value={isi}
        onChange={(event) => setIsi(event.target.value)}
        placeholder="Teks rekomendasi versi petugas"
        className="mt-3 min-h-28 w-full rounded-lg border border-[#18251f]/10 bg-white p-2.5 text-xs outline-none"
      />
      <input
        value={alasan}
        onChange={(event) => setAlasan(event.target.value)}
        placeholder="Alasan perubahan"
        className="mt-2 w-full rounded-lg border border-[#18251f]/10 bg-white p-2.5 text-xs outline-none"
      />
      <div className="mt-2">
        <FormError message={error} />
      </div>
      <button
        type="button"
        onClick={simpan}
        disabled={pending || !isi.trim() || !alasan.trim()}
        className="mt-2 w-full rounded-full bg-[#18251f] px-3 py-2 text-xs text-white disabled:opacity-50"
      >
        {pending ? "Menyimpan…" : "Simpan versi petugas"}
      </button>
    </div>
  )
}

function PanelEskalasi({ kode, onSelesai }: { kode: string; onSelesai: () => void }) {
  const [kategori, setKategori] = useState<Dimension>("hs-lartas")
  const [alasan, setAlasan] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function kirim() {
    setPending(true)
    setError(null)
    try {
      await api.eskalasi(kode, { kategori, alasan: alasan.trim() })
      setAlasan("")
      toast.success("Kasus dieskalasi ke spesialis.")
      onSelesai()
    } catch (gagal) {
      setError(gagal instanceof ApiClientError ? gagal.message : null)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-4 rounded-xl bg-[#f5f4f0] p-4">
      <p className="text-sm font-medium">Eskalasi kasus</p>
      <select
        value={kategori}
        onChange={(event) => setKategori(event.target.value as Dimension)}
        className="mt-3 w-full rounded-lg border border-[#18251f]/10 bg-white p-2.5 text-xs"
      >
        {DIMENSION_ORDER.map((dimensi) => (
          <option key={dimensi} value={dimensi}>
            {DIMENSION_LABEL[dimensi]}
          </option>
        ))}
      </select>
      <textarea
        value={alasan}
        onChange={(event) => setAlasan(event.target.value)}
        placeholder="Alasan eskalasi"
        className="mt-2 min-h-16 w-full rounded-lg border border-[#18251f]/10 bg-white p-2.5 text-xs outline-none"
      />
      <div className="mt-2">
        <FormError message={error} />
      </div>
      <button
        type="button"
        onClick={kirim}
        disabled={pending || !alasan.trim()}
        className="mt-2 w-full rounded-full bg-[#a75128] px-3 py-2 text-xs text-white disabled:opacity-50"
      >
        {pending ? "Mengirim…" : "Eskalasi kasus"}
      </button>
    </div>
  )
}

function PlanEditor({
  kode,
  usulan,
  ringkasanAwal,
  onGate,
  onSelesai,
}: {
  kode: string
  usulan: PlanTaskInput[]
  ringkasanAwal: string
  onGate: (error: ApiClientError | null) => void
  onSelesai: () => void
}) {
  const [ringkasan, setRingkasan] = useState(ringkasanAwal)
  const [tugas, setTugas] = useState<PlanTaskInput[]>(usulan)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function ubah(index: number, patch: Partial<PlanTaskInput>) {
    setTugas((current) => current.map((item, posisi) => (posisi === index ? { ...item, ...patch } : item)))
  }

  function tambah() {
    setTugas((current) => [
      ...current,
      { judul: "", penjelasan: "", owner: "UMKM", buktiDibutuhkan: "", targetSelesai: null },
    ])
  }

  function hapus(index: number) {
    setTugas((current) => current.filter((_, posisi) => posisi !== index))
  }

  async function kirim() {
    setPending(true)
    setError(null)
    onGate(null)
    try {
      const hasil = await api.kirimRencana(kode, {
        ringkasanPetugas: ringkasan.trim(),
        tugas: tugas.map((item) => ({ ...item, judul: item.judul.trim(), penjelasan: item.penjelasan.trim() })),
      })
      toast.success(`Rencana ${hasil.versi} dikirim ke UMKM oleh ${hasil.ditinjauOleh.nama}.`)
      onSelesai()
    } catch (gagal) {
      if (gagal instanceof ApiClientError) {
        // 422 = gerbang officer-in-the-loop, ditampilkan di panel aksi, bukan sebagai error biasa.
        if (gagal.status === 422) onGate(gagal)
        else setError(gagal.message)
      }
      setPending(false)
    }
  }

  return (
    <section id="rencana" className="rounded-2xl border border-[#18251f]/10 bg-white/55 p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-[#a75128]">05 · Tinjau & kirim rencana</p>
      <h2 className="mt-2 font-serif text-3xl">Rencana pendampingan final.</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#18251f]/55">
        Tugas di bawah disusun dari usulan aksi dan bisa disunting sebelum dikirim. Setelah dikirim, rencana terlihat
        oleh UMKM.
      </p>

      <label className="mt-6 flex flex-col gap-2">
        <span className="text-xs text-[#18251f]/50">Ringkasan petugas</span>
        <textarea
          value={ringkasan}
          onChange={(event) => setRingkasan(event.target.value)}
          placeholder="Arahan singkat untuk UMKM…"
          className="min-h-24 w-full resize-y rounded-xl border border-[#18251f]/10 bg-[#f5f4f0]/70 p-3 text-sm leading-6 outline-none"
        />
      </label>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.14em] text-[#18251f]/40">Tugas ({tugas.length})</p>
        <button
          type="button"
          onClick={tambah}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#18251f]/15 px-3 py-1.5 text-xs"
        >
          <Plus className="size-3.5" /> Tambah tugas
        </button>
      </div>

      {tugas.length === 0 && (
        <p className="mt-3 rounded-xl border border-dashed border-[#18251f]/15 px-4 py-6 text-center text-xs text-[#18251f]/45">
          Belum ada tugas. Tambahkan minimal satu tugas sebelum mengirim rencana.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {tugas.map((item, index) => (
          <div key={index} className="rounded-xl border border-[#18251f]/10 bg-[#f5f4f0]/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-[10px] text-[#18251f]/35">TUGAS {index + 1}</span>
              <button
                type="button"
                onClick={() => hapus(index)}
                aria-label={`Hapus tugas ${index + 1}`}
                className="rounded-full p-1 text-[#18251f]/35 hover:bg-white hover:text-[#a75128]"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <input
              value={item.judul}
              onChange={(event) => ubah(index, { judul: event.target.value })}
              placeholder="Judul tugas"
              className="mt-2 w-full rounded-lg border border-[#18251f]/10 bg-white p-2.5 text-sm outline-none"
            />
            <textarea
              value={item.penjelasan}
              onChange={(event) => ubah(index, { penjelasan: event.target.value })}
              placeholder="Penjelasan untuk UMKM"
              className="mt-2 min-h-16 w-full rounded-lg border border-[#18251f]/10 bg-white p-2.5 text-xs outline-none"
            />
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#18251f]/35">Pemilik</span>
                <select
                  value={item.owner}
                  onChange={(event) => ubah(index, { owner: event.target.value as TaskOwner })}
                  className="rounded-lg border border-[#18251f]/10 bg-white p-2.5 text-xs"
                >
                  {OWNER_PILIHAN.map((owner) => (
                    <option key={owner} value={owner}>
                      {TASK_OWNER_LABEL[owner]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#18251f]/35">Bukti dibutuhkan</span>
                <input
                  value={item.buktiDibutuhkan}
                  onChange={(event) => ubah(index, { buktiDibutuhkan: event.target.value })}
                  className="rounded-lg border border-[#18251f]/10 bg-white p-2.5 text-xs outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#18251f]/35">Target selesai</span>
                <input
                  type="date"
                  value={item.targetSelesai ?? ""}
                  onChange={(event) => ubah(index, { targetSelesai: event.target.value || null })}
                  className="rounded-lg border border-[#18251f]/10 bg-white p-2.5 text-xs outline-none"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <FormError message={error} />
      </div>

      <button
        type="button"
        onClick={kirim}
        disabled={pending || tugas.length === 0 || !ringkasan.trim()}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#18251f] px-6 py-3 text-sm text-[#f5f4f0] disabled:opacity-60"
      >
        {pending ? "Mengirim…" : "Kirim rencana ke UMKM"} <Send className="size-4" />
      </button>
    </section>
  )
}
