"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Check, CheckCircle2, Clock3, FileText, Paperclip, X } from "lucide-react"
import { api, ApiClientError } from "@/lib/api-client"
import { useResource } from "@/hooks/use-resource"
import { DisclaimerBlock, ErrorBlock, LoadingBlock, LoadingLines, FormError } from "@/components/state-blocks"
import {
  actorRoleLabel,
  CASE_STATUS_LABEL,
  TASK_OWNER_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_STYLE,
  formatTanggal,
  formatTanggalWaktu,
  formatUkuran,
} from "@/lib/labels"
import type { Task } from "@/lib/types"

const MAKS_BERKAS = 5
const MAKS_UKURAN = 5 * 1024 * 1024
const EKSTENSI = ["pdf", "jpg", "jpeg", "png", "zip"]

export function JalurEksporUmkmPlan({ kode }: { kode: string }) {
  const router = useRouter()
  const kasus = useResource(() => api.kasus(kode), [kode])
  const tugas = useResource(() => api.tugas(kode), [kode])
  const riwayat = useResource(() => api.riwayat(kode), [kode])

  const sudahMengalihkan = useRef(false)

  // Rencana hanya boleh terlihat saat RENCANA_TERKIRIM / SELESAI (user-flow §5.7).
  useEffect(() => {
    const status = kasus.data?.status
    if (!status || sudahMengalihkan.current) return
    if (status !== "RENCANA_TERKIRIM" && status !== "SELESAI") {
      sudahMengalihkan.current = true
      toast.info("Rencana belum tersedia; petugas masih meninjau.")
      router.replace(`/hasil/${kode.toLowerCase()}`)
    }
  }, [kasus.data?.status, kode, router])

  const memuat = kasus.loading
  const rencana = kasus.data?.rencana ?? null
  const bolehLihat = kasus.data?.status === "RENCANA_TERKIRIM" || kasus.data?.status === "SELESAI"

  return (
    <main className="min-h-screen bg-[#f5f4f0] text-[#18251f]">
      <div className="mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/umkm"
            className="inline-flex items-center gap-2 text-sm text-black/45 transition-colors hover:text-[#18251f]"
          >
            <ArrowLeft className="size-4" /> Kembali ke dashboard
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-black/35">
            JalurEkspor / rencana pendampingan
          </span>
        </header>

        {memuat && <LoadingBlock rows={3} className="mt-12" />}

        {!memuat && kasus.error && (
          <div className="mt-12">
            <ErrorBlock error={kasus.error} onRetry={kasus.reload} title="Rencana tidak dapat dimuat">
              <Link
                href="/umkm"
                className="mt-4 inline-flex items-center gap-2 text-xs text-[#a75128] underline underline-offset-4"
              >
                Kembali ke dashboard
              </Link>
            </ErrorBlock>
          </div>
        )}

        {!memuat && !kasus.error && kasus.data && bolehLihat && (
          <>
            <section className="mt-12 flex flex-col gap-8 border-b border-black/[0.1] pb-10 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#b55a38]">
                  Rencana pendampingan final · {kasus.data.kode}
                </p>
                <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.05em] md:text-6xl">
                  {kasus.data.namaUsaha}
                </h1>
                <p className="mt-3 text-lg text-black/55">
                  {kasus.data.produk || "Produk belum ditentukan"}
                  <span className="mx-2 text-black/25">→</span>
                  {kasus.data.tujuan || "Tujuan belum ditentukan"}
                </p>
              </div>

              {rencana?.ditinjauOleh ? (
                <div className="flex items-center gap-3 rounded-2xl border border-[#758b5f]/25 bg-[#e5ecdf] px-4 py-3 text-sm">
                  <CheckCircle2 className="size-5 shrink-0 text-[#587044]" />
                  <div>
                    <p className="font-medium text-[#3e5730]">Telah ditinjau petugas</p>
                    <p className="mt-0.5 text-xs text-[#587044]">
                      {rencana.ditinjauOleh.nama} · {formatTanggalWaktu(rencana.ditinjauOleh.pada)}
                    </p>
                  </div>
                </div>
              ) : null}
            </section>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <Meta label="Versi rekomendasi" value={rencana?.versi ?? "—"} />
              <Meta label="Kode kasus" value={kasus.data.kode} />
              <Meta label="Status" value={CASE_STATUS_LABEL[kasus.data.status]} />
            </div>

            <section className="mt-8 rounded-3xl bg-[#18251f] p-6 text-[#f5f4f0] md:p-8">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#d6a15c]">Ringkasan petugas</p>
                  <h2 className="mt-3 text-2xl font-medium tracking-[-0.03em]">
                    {rencana?.ringkasanPetugas ?? "Ringkasan petugas belum tersedia."}
                  </h2>
                </div>
                <FileText className="size-6 shrink-0 text-[#d6a15c]" />
              </div>
              {rencana && (
                <p className="mt-5 text-sm leading-7 text-[#f5f4f0]/65">
                  Dikirim {formatTanggalWaktu(rencana.dikirimPada)} · versi {rencana.versi}
                </p>
              )}
            </section>

            <DaftarTugas
              tugas={tugas.data}
              loading={tugas.loading}
              error={tugas.error}
              reload={tugas.reload}
              onPerubahan={() => {
                tugas.reload()
                kasus.reload()
                riwayat.reload()
              }}
              set={tugas.set}
            />

            <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_0.85fr]">
              <section className="rounded-3xl border border-[#d1a15c]/35 bg-[#fbf7ee] p-6">
                <SectionTitle eyebrow="02 / batasan" title="Catatan penting" />
                <p className="mt-4 text-sm leading-7 text-black/60">
                  Rencana ini adalah panduan pendampingan berdasarkan informasi yang telah ditinjau petugas. Rencana ini
                  bukan penetapan HS final, keputusan Lartas, izin ekspor, maupun persetujuan PEB resmi.
                </p>
              </section>
              <section className="rounded-3xl border border-black/[0.1] bg-white/50 p-6">
                <SectionTitle eyebrow="03 / akses cepat" title="Butuh bantuan?" />
                <p className="mt-4 text-sm leading-6 text-black/55">
                  Jika informasi usaha berubah atau ada bukti baru, perbarui kasus agar petugas dapat meninjau ulang
                  konteksnya.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href={`/hasil/${kode.toLowerCase()}`}
                    className="rounded-full border border-black/[0.12] px-4 py-2 text-xs"
                  >
                    Hasil kesiapan
                  </Link>
                  <a href="#riwayat" className="rounded-full border border-black/[0.12] px-4 py-2 text-xs">
                    Riwayat kasus
                  </a>
                  <Link href="/umkm" className="rounded-full border border-black/[0.12] px-4 py-2 text-xs">
                    Dashboard
                  </Link>
                </div>
              </section>
            </div>

            <section id="riwayat" className="mt-12 scroll-mt-8 pb-10">
              <SectionTitle
                eyebrow="04 / mentoring history"
                title="Riwayat pendampingan"
                detail="Semua perubahan penting tercatat secara kronologis."
              />
              {riwayat.loading && <LoadingLines rows={4} className="mt-6" />}
              {!riwayat.loading && riwayat.error && (
                <div className="mt-6">
                  <ErrorBlock error={riwayat.error} onRetry={riwayat.reload} title="Riwayat tidak dapat dimuat" />
                </div>
              )}
              {!riwayat.loading && riwayat.data && riwayat.data.length === 0 && (
                <p className="mt-6 rounded-2xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-black/45">
                  Belum ada aktivitas yang tercatat.
                </p>
              )}
              {!riwayat.loading && riwayat.data && riwayat.data.length > 0 && (
                <div className="mt-6 flex flex-col">
                  {riwayat.data.map((event, index, daftar) => (
                    // `relative` pada induk — tanpa ini titik penanda absolute meleset.
                    <div
                      key={event.id}
                      className="relative flex gap-4 border-l border-black/[0.12] pb-7 pl-6 last:pb-0"
                    >
                      <span className="absolute -left-1 top-1 size-2 rounded-full bg-[#b55a38] ring-4 ring-[#f5f4f0]" />
                      <div className="w-full">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">{event.judul}</p>
                          <span className="font-mono text-[10px] text-black/35">
                            {formatTanggalWaktu(event.pada)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-black/50">
                          {event.aktor} · {actorRoleLabel(event.peranAktor)} · {event.ringkasan}
                        </p>
                        {event.versi && (
                          <span className="mt-2 inline-block rounded-md bg-black/[0.05] px-2 py-1 font-mono text-[10px] text-black/40">
                            {event.versi}
                          </span>
                        )}
                      </div>
                      {index === daftar.length - 1 && <Clock3 className="size-4 shrink-0 text-[#b55a38]" />}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <DisclaimerBlock className="mb-10" />
          </>
        )}
      </div>
    </main>
  )
}

function DaftarTugas({
  tugas,
  loading,
  error,
  reload,
  onPerubahan,
  set,
}: {
  tugas: Task[] | null
  loading: boolean
  error: ApiClientError | null
  reload: () => void
  onPerubahan: () => void
  set: (next: Task[] | null | ((current: Task[] | null) => Task[] | null)) => void
}) {
  const [pesanGagal, setPesanGagal] = useState<string | null>(null)
  const [sedangDiproses, setSedangDiproses] = useState<string | null>(null)

  async function tandaiSelesai(task: Task) {
    setPesanGagal(null)
    setSedangDiproses(task.id)
    const sebelumnya = task.status
    // Pembaruan optimistis.
    set((current) => current?.map((item) => (item.id === task.id ? { ...item, status: "COMPLETED" } : item)) ?? null)
    try {
      await api.ubahStatusTugas(task.id, "COMPLETED")
      onPerubahan()
    } catch (gagal) {
      // Rollback.
      set((current) => current?.map((item) => (item.id === task.id ? { ...item, status: sebelumnya } : item)) ?? null)
      setPesanGagal(gagal instanceof ApiClientError ? gagal.message : null)
    } finally {
      setSedangDiproses(null)
    }
  }

  return (
    <section className="mt-12">
      <SectionTitle
        eyebrow="01 / action plan"
        title="Langkah berikutnya"
        detail="Tugas yang telah disusun dari rekomendasi petugas."
      />

      {loading && <LoadingBlock rows={3} className="mt-6" />}

      {!loading && error && (
        <div className="mt-6">
          <ErrorBlock error={error} onRetry={reload} title="Daftar tugas tidak dapat dimuat" />
        </div>
      )}

      {!loading && !error && tugas && tugas.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-black/45">
          Belum ada tugas pada rencana ini.
        </p>
      )}

      {!loading && !error && tugas && tugas.length > 0 && (
        <div className="mt-6 flex flex-col gap-3">
          {tugas.map((task, index) => (
            <article key={task.id} className="rounded-2xl border border-black/[0.1] bg-white/50 p-5 md:p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="flex gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e7ebe3] font-mono text-xs text-[#587044]">
                    {String(task.urutan || index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-medium">{task.judul}</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-black/55">{task.penjelasan}</p>
                  </div>
                </div>
                <span
                  className={`w-fit shrink-0 rounded-full px-3 py-1 text-[11px] font-medium ${TASK_STATUS_STYLE[task.status]}`}
                >
                  {TASK_STATUS_LABEL[task.status]}
                </span>
              </div>

              <div className="mt-5 grid gap-4 border-t border-black/[0.08] pt-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
                <Meta label="Pemilik" value={TASK_OWNER_LABEL[task.owner]} />
                <Meta label="Bukti yang diperlukan" value={task.buktiDibutuhkan || "—"} />
                <Meta label="Target selesai" value={formatTanggal(task.targetSelesai)} />
                <Meta label="Versi rencana" value={task.versi} />
              </div>

              {task.bukti.length > 0 && (
                <div className="mt-4 border-t border-black/[0.08] pt-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-black/35">Bukti terlampir</p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {task.bukti.map((file) => (
                      <li key={file.id} className="flex flex-wrap items-center gap-2 text-xs text-black/60">
                        <Paperclip className="size-3.5 shrink-0 text-[#b55a38]" />
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-4 hover:text-[#18251f]"
                        >
                          {file.namaBerkas}
                        </a>
                        <span className="text-black/35">
                          {file.tipe.toUpperCase()} · {formatUkuran(file.ukuranBytes)} ·{" "}
                          {formatTanggal(file.diunggahPada)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {task.owner === "PETUGAS" ? (
                <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-black/[0.04] px-4 py-2 text-xs text-black/50">
                  <Check className="size-3.5" /> Dikerjakan petugas
                </p>
              ) : (
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {task.status !== "COMPLETED" && (
                    <button
                      type="button"
                      onClick={() => tandaiSelesai(task)}
                      disabled={sedangDiproses === task.id}
                      className="inline-flex items-center gap-2 rounded-full bg-[#18251f] px-4 py-2 text-xs text-[#f5f4f0] disabled:opacity-60"
                    >
                      <Check className="size-3.5" />
                      {sedangDiproses === task.id ? "Menyimpan…" : "Tandai selesai"}
                    </button>
                  )}
                  <UnggahBukti taskId={task.id} onSelesai={onPerubahan} />
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <div className="mt-4">
        <FormError message={pesanGagal} />
      </div>
    </section>
  )
}

function UnggahBukti({ taskId, onSelesai }: { taskId: string; onSelesai: () => void }) {
  const [berkas, setBerkas] = useState<File[]>([])
  const [masalah, setMasalah] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function pilih(daftar: FileList | null) {
    if (!daftar) return
    const catatan: string[] = []
    const diterima: File[] = [...berkas]
    for (const item of Array.from(daftar)) {
      const ekstensi = item.name.split(".").pop()?.toLowerCase() ?? ""
      if (!EKSTENSI.includes(ekstensi)) {
        catatan.push(`${item.name} — format tidak didukung. Hanya ${EKSTENSI.join(", ")}.`)
        continue
      }
      if (item.size > MAKS_UKURAN) {
        catatan.push(`${item.name} — ukuran ${formatUkuran(item.size)} melebihi batas 5 MB.`)
        continue
      }
      if (diterima.length >= MAKS_BERKAS) {
        catatan.push(`${item.name} — melewati batas ${MAKS_BERKAS} berkas.`)
        continue
      }
      diterima.push(item)
    }
    setBerkas(diterima)
    setMasalah(catatan)
    if (inputRef.current) inputRef.current.value = ""
  }

  async function unggah() {
    if (berkas.length === 0) return
    setPending(true)
    setError(null)
    try {
      const form = new FormData()
      for (const item of berkas) form.append("berkas[]", item)
      await api.unggahBuktiTugas(taskId, form)
      setBerkas([])
      setMasalah([])
      toast.success("Bukti terlampir pada tugas.")
      onSelesai()
    } catch (gagal) {
      setError(gagal instanceof ApiClientError ? gagal.message : null)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full border border-black/[0.12] px-4 py-2 text-xs">
        <Paperclip className="size-3.5" /> Lampirkan bukti
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.zip"
          onChange={(event) => pilih(event.target.files)}
          className="hidden"
        />
      </label>

      {berkas.length > 0 && (
        <>
          <ul className="flex flex-col gap-1.5">
            {berkas.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-black/[0.03] px-3 py-2 text-xs"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{file.name}</span>
                  <span className="shrink-0 text-black/35">{formatUkuran(file.size)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setBerkas((current) => current.filter((_, posisi) => posisi !== index))}
                  aria-label={`Hapus ${file.name}`}
                  className="shrink-0 rounded-full p-1 text-black/35 hover:text-[#a75128]"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={unggah}
            disabled={pending}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-[#b55a38] px-4 py-2 text-xs text-white disabled:opacity-60"
          >
            {pending ? "Mengunggah…" : `Unggah ${berkas.length} berkas`}
          </button>
        </>
      )}

      {masalah.map((teks) => (
        <p key={teks} className="text-[11px] text-[#a75128]">
          {teks}
        </p>
      ))}

      <FormError message={error} />
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-black/35">{label}</p>
      <p className="mt-1 text-sm text-black/70">{value}</p>
    </div>
  )
}

function SectionTitle({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#b55a38]">{eyebrow}</p>
      <div className="mt-2 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <h2 className="text-2xl font-medium tracking-[-0.03em]">{title}</h2>
        {detail && <p className="text-xs text-black/40">{detail}</p>}
      </div>
    </div>
  )
}
