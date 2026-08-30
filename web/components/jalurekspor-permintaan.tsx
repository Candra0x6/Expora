"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowRight, Check, MessageSquare, Paperclip, Send, X } from "lucide-react"
import { api, ApiClientError } from "@/lib/api-client"
import { useResource } from "@/hooks/use-resource"
import { SiteHeader, LogoutButton } from "@/components/site-header"
import { ErrorBlock, FormError, LoadingBlock } from "@/components/state-blocks"
import { formatTanggalWaktu, formatUkuran } from "@/lib/labels"

const MAKS_BERKAS = 5
const MAKS_UKURAN = 5 * 1024 * 1024
const EKSTENSI = ["pdf", "jpg", "jpeg", "png", "zip"]

export function JalurEksporPermintaan({ id }: { id: string }) {
  const router = useRouter()
  const permintaan = useResource(() => api.permintaan(id), [id])

  const [pesan, setPesan] = useState("")
  const [berkas, setBerkas] = useState<File[]>([])
  const [masalahBerkas, setMasalahBerkas] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function tambahBerkas(daftar: FileList | null) {
    if (!daftar) return
    const masalah: string[] = []
    const diterima: File[] = [...berkas]
    for (const item of Array.from(daftar)) {
      const ekstensi = item.name.split(".").pop()?.toLowerCase() ?? ""
      if (!EKSTENSI.includes(ekstensi)) {
        masalah.push(`${item.name} — format tidak didukung. Hanya ${EKSTENSI.join(", ")}.`)
        continue
      }
      if (item.size > MAKS_UKURAN) {
        masalah.push(`${item.name} — ukuran ${formatUkuran(item.size)} melebihi batas 5 MB.`)
        continue
      }
      if (diterima.length >= MAKS_BERKAS) {
        masalah.push(`${item.name} — melewati batas ${MAKS_BERKAS} berkas.`)
        continue
      }
      diterima.push(item)
    }
    setBerkas(diterima)
    setMasalahBerkas(masalah)
    if (inputRef.current) inputRef.current.value = ""
  }

  function hapusBerkas(index: number) {
    setBerkas((current) => current.filter((_, posisi) => posisi !== index))
  }

  async function kirim(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const form = new FormData()
      form.set("pesan", pesan.trim())
      for (const item of berkas) form.append("berkas[]", item)
      const hasil = await api.jawabPermintaan(id, form)
      toast.success("Jawaban terkirim. Petugas akan meninjau kembali kasusmu.")
      router.push(hasil.redirectTo ?? "/umkm")
    } catch (gagal) {
      setError(gagal instanceof ApiClientError ? gagal.message : null)
      setPending(false)
    }
  }

  const data = permintaan.data
  const sudahDijawab = data?.status === "DIJAWAB"

  return (
    <main className="min-h-screen bg-[#f5f4f0] text-[#18251f]">
      <SiteHeader
        logoHref="/umkm"
        back={{ href: "/umkm", label: "Dashboard" }}
        right={
          <>
            <span className="hidden sm:inline">Permintaan informasi</span>
            <LogoutButton />
          </>
        }
      />

      <div className="mx-auto max-w-3xl px-6 pb-20 lg:px-10">
        {permintaan.loading && <LoadingBlock rows={2} />}

        {!permintaan.loading && permintaan.error && (
          <ErrorBlock
            error={permintaan.error}
            onRetry={permintaan.reload}
            title="Permintaan tidak dapat dimuat"
          >
            <Link
              href="/umkm"
              className="mt-4 inline-flex items-center gap-2 text-xs text-[#a75128] underline underline-offset-4"
            >
              Kembali ke dashboard <ArrowRight className="size-3.5" />
            </Link>
          </ErrorBlock>
        )}

        {!permintaan.loading && !permintaan.error && data && (
          <>
            <div className="mb-8 flex flex-wrap items-center gap-2 text-sm text-[#18251f]/45">
              <Link href="/umkm" className="hover:text-[#18251f]">
                Dashboard
              </Link>
              <span>/</span>
              <Link href={`/hasil/${data.kodeKasus.toLowerCase()}`} className="hover:text-[#18251f]">
                Kasus {data.kodeKasus}
              </Link>
              <span>/</span>
              <span className="text-[#18251f]/70">Permintaan informasi</span>
            </div>

            <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-[#a75128]">
              Permintaan dari petugas
            </p>
            <h1 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">{data.judul}</h1>

            <section className="mt-7 rounded-2xl border border-[#18251f]/10 bg-white/55 p-6">
              <div className="flex items-center gap-2 text-xs text-[#18251f]/45">
                <MessageSquare className="size-4 text-[#a75128]" />
                {data.dariPetugas} · {formatTanggalWaktu(data.dibuatPada)}
              </div>
              <p className="mt-4 text-sm leading-7 text-[#18251f]/75">{data.pesan}</p>
            </section>

            {sudahDijawab && data.jawaban ? (
              <section className="mt-6 rounded-2xl border border-[#55715e]/25 bg-[#e7ebe3]/70 p-6">
                <div className="flex items-center gap-2 text-xs font-medium text-[#3e5730]">
                  <Check className="size-4" /> Sudah dijawab · {formatTanggalWaktu(data.jawaban.dijawabPada)}
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#18251f]/75">{data.jawaban.pesan}</p>
                {data.jawaban.bukti.length > 0 && (
                  <div className="mt-5 border-t border-[#55715e]/15 pt-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#3e5730]/70">Bukti terlampir</p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {data.jawaban.bukti.map((file) => (
                        <li key={file.id} className="flex items-center gap-2 text-xs text-[#18251f]/65">
                          <Paperclip className="size-3.5 text-[#55715e]" />
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-4 hover:text-[#18251f]"
                          >
                            {file.namaBerkas}
                          </a>
                          <span className="text-[#18251f]/35">
                            {file.tipe.toUpperCase()} · {formatUkuran(file.ukuranBytes)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Link
                  href="/umkm"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#18251f] px-4 py-2.5 text-sm text-[#f5f4f0]"
                >
                  Kembali ke dashboard <ArrowRight className="size-4" />
                </Link>
              </section>
            ) : (
              <form onSubmit={kirim} className="mt-6 rounded-2xl border border-[#18251f]/10 bg-white/55 p-6">
                <label className="flex flex-col gap-2">
                  <span className="text-xs text-[#18251f]/50">Jawabanmu</span>
                  <textarea
                    required
                    value={pesan}
                    onChange={(event) => setPesan(event.target.value)}
                    placeholder="Tuliskan informasi yang diminta petugas…"
                    className="min-h-36 w-full resize-y rounded-xl border border-[#18251f]/10 bg-[#f5f4f0]/70 p-3 text-sm leading-6 outline-none placeholder:text-[#18251f]/30 focus:border-[#18251f]/35"
                  />
                </label>

                <div className="mt-5">
                  <p className="text-xs text-[#18251f]/50">
                    Bukti pendukung <span className="text-[#18251f]/35">(opsional)</span>
                  </p>
                  <p className="mt-1 text-[11px] text-[#18251f]/35">
                    Maksimal {MAKS_BERKAS} berkas, masing-masing 5 MB. Format: {EKSTENSI.join(", ")}.
                  </p>
                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.zip"
                    onChange={(event) => tambahBerkas(event.target.files)}
                    className="mt-3 block w-full cursor-pointer rounded-xl border border-dashed border-[#18251f]/20 bg-[#f5f4f0]/60 p-3 text-xs text-[#18251f]/55 file:mr-3 file:rounded-full file:border-0 file:bg-[#18251f] file:px-4 file:py-2 file:text-xs file:text-[#f5f4f0]"
                  />

                  {berkas.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2">
                      {berkas.map((file, index) => (
                        <li
                          key={`${file.name}-${index}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-[#18251f]/10 bg-[#f5f4f0]/70 px-3 py-2.5 text-xs"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Paperclip className="size-3.5 shrink-0 text-[#a75128]" />
                            <span className="truncate">{file.name}</span>
                            <span className="shrink-0 text-[#18251f]/35">{formatUkuran(file.size)}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => hapusBerkas(index)}
                            aria-label={`Hapus ${file.name}`}
                            className="shrink-0 rounded-full p-1 text-[#18251f]/40 transition-colors hover:bg-white hover:text-[#a75128]"
                          >
                            <X className="size-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {masalahBerkas.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-1">
                      {masalahBerkas.map((teks) => (
                        <li key={teks} className="text-[11px] text-[#a75128]">
                          {teks}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-5">
                  <FormError message={error} />
                </div>

                <div className="mt-5 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                  <Link href="/umkm" className="text-center text-sm text-[#18251f]/55 hover:text-[#18251f] sm:text-left">
                    Nanti saja
                  </Link>
                  <button
                    type="submit"
                    disabled={pending || pesan.trim().length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#18251f] px-6 py-3 text-sm text-[#f5f4f0] transition-transform hover:translate-x-0.5 disabled:opacity-60"
                  >
                    {pending ? "Mengirim…" : "Kirim jawaban"} <Send className="size-4" />
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  )
}
