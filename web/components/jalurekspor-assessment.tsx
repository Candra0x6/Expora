"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  CircleHelp,
  Cloud,
  Info,
  LoaderCircle,
  RotateCcw,
} from "lucide-react"
import { api, ApiClientError } from "@/lib/api-client"
import { useResource } from "@/hooks/use-resource"
import { ErrorBlock, LoadingBlock } from "@/components/state-blocks"
import { DIMENSION_LABEL, formatWaktu } from "@/lib/labels"
import { DIMENSION_ORDER } from "@/lib/types"
import type { AnswerValue, AssessmentState, Question } from "@/lib/types"

const DEBOUNCE_TEKS = 500

type SaveState = { status: "idle" | "saving" | "error"; message: string | null }

export function JalurEksporAssessment({ kode }: { kode: string }) {
  const kasus = useResource(() => api.kasus(kode), [kode])
  const awal = useResource(() => api.assessment(kode), [kode])

  const [state, setState] = useState<AssessmentState | null>(null)
  const [index, setIndex] = useState(0)
  const [save, setSave] = useState<SaveState>({ status: "idle", message: null })

  /** Jawaban yang belum sempat dikonfirmasi server (mengetik lebih cepat dari debounce). */
  const pendingRef = useRef<Record<string, AnswerValue>>({})
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const terakhirGagalRef = useRef<{ questionId: string; jawaban: AnswerValue } | null>(null)

  useEffect(() => {
    if (awal.data) {
      setState(awal.data)
      setIndex(awal.data.indeksBerikutnya >= 0 ? awal.data.indeksBerikutnya : 0)
    }
  }, [awal.data])

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  /**
   * Respons autosave adalah AssessmentState PENUH — percabangan bisa berubah.
   * State diganti utuh, tidak digabung manual.
   */
  const terapkanRespons = useCallback((berikutnya: AssessmentState, questionIdSaatIni: string | null) => {
    // Nilai yang masih diketik menang atas nilai lama dari server.
    const pending = pendingRef.current
    const jawaban = { ...berikutnya.jawaban }
    for (const [id, nilai] of Object.entries(pending)) jawaban[id] = nilai
    const hasil: AssessmentState = { ...berikutnya, jawaban }
    setState(hasil)

    setIndex((sebelumnya) => {
      if (!questionIdSaatIni) return Math.min(sebelumnya, Math.max(hasil.pertanyaan.length - 1, 0))
      const posisi = hasil.pertanyaan.findIndex((item) => item.id === questionIdSaatIni)
      // Pertanyaan yang sedang dibuka masih ada → ikuti posisi barunya.
      if (posisi >= 0) return posisi
      // Lenyap karena percabangan → lompat ke pertanyaan belum terjawab pertama.
      if (hasil.indeksBerikutnya >= 0) return hasil.indeksBerikutnya
      return Math.max(hasil.pertanyaan.length - 1, 0)
    })
  }, [])

  const kirimJawaban = useCallback(
    async (questionId: string, jawaban: AnswerValue) => {
      setSave({ status: "saving", message: null })
      try {
        const berikutnya = await api.simpanJawaban(kode, { questionId, jawaban })
        // Hapus pending kalau nilai yang tersimpan memang nilai terakhir yang diketik.
        const pending = pendingRef.current[questionId]
        if (JSON.stringify(pending) === JSON.stringify(jawaban)) delete pendingRef.current[questionId]
        terakhirGagalRef.current = null
        terapkanRespons(berikutnya, questionId)
        setSave({ status: "idle", message: null })
      } catch (gagal) {
        terakhirGagalRef.current = { questionId, jawaban }
        setSave({
          status: "error",
          message: gagal instanceof ApiClientError ? gagal.message : null,
        })
      }
    },
    [kode, terapkanRespons],
  )

  function ubahJawaban(question: Question, nilai: AnswerValue, langsung: boolean) {
    pendingRef.current[question.id] = nilai
    setState((current) =>
      current ? { ...current, jawaban: { ...current.jawaban, [question.id]: nilai } } : current,
    )
    if (timerRef.current) clearTimeout(timerRef.current)
    if (langsung) {
      void kirimJawaban(question.id, nilai)
    } else {
      timerRef.current = setTimeout(() => void kirimJawaban(question.id, nilai), DEBOUNCE_TEKS)
    }
  }

  function cobaSimpanLagi() {
    const terakhir = terakhirGagalRef.current
    if (terakhir) void kirimJawaban(terakhir.questionId, terakhir.jawaban)
  }

  const memuat = awal.loading || kasus.loading
  const pertanyaan = state?.pertanyaan ?? []
  const question = pertanyaan[Math.min(index, Math.max(pertanyaan.length - 1, 0))]
  const jawabanSaatIni: AnswerValue = question ? (state?.jawaban[question.id] ?? "") : ""
  const total = state?.progress.total ?? 0
  const terjawab = state?.progress.terjawab ?? 0
  const persen = total > 0 ? Math.round(((index + 1) / pertanyaan.length) * 100) : 0
  const sisaWajib = state?.sisaWajib ?? 0

  return (
    <main className="min-h-screen bg-[#f5f4f0] text-[#161615] antialiased">
      <header className="sticky top-0 z-20 border-b border-black/[0.08] bg-[#f5f4f0]/85 px-5 py-4 backdrop-blur-xl md:px-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <Link href="/umkm" className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#18251f] text-sm font-semibold tracking-tight text-[#f5f4f0]">
              JE
            </span>
            <span className="text-sm font-medium tracking-[-0.02em]">JalurEkspor</span>
          </Link>

          <div className="flex items-center gap-2 text-xs">
            {save.status === "saving" && (
              <span className="flex items-center gap-1.5 text-black/45">
                <LoaderCircle className="size-3.5 animate-spin" /> Menyimpan…
              </span>
            )}
            {save.status === "error" && (
              <span className="flex items-center gap-2 text-[#a75128]">
                <CircleAlert className="size-3.5" />
                <span className="max-w-64 truncate">{save.message}</span>
                <button
                  type="button"
                  onClick={cobaSimpanLagi}
                  className="inline-flex items-center gap-1 rounded-full border border-[#a75128]/30 px-2.5 py-1 text-[11px]"
                >
                  <RotateCcw className="size-3" /> Coba lagi
                </button>
              </span>
            )}
            {save.status === "idle" && (
              <span className="hidden items-center gap-2 text-black/40 sm:flex">
                <Cloud className="size-3.5" />
                {state?.disimpanPada
                  ? `Disimpan otomatis pukul ${formatWaktu(state.disimpanPada)}`
                  : "Belum ada jawaban tersimpan"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/50 px-3 py-1.5 text-[11px] text-black/55">
            <span className="size-1.5 rounded-full bg-[#789b74]" /> Assessment {state?.versi ?? "…"}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-8 md:grid-cols-[240px_minmax(0,680px)] md:gap-16 md:px-10 md:py-14 lg:grid-cols-[260px_minmax(0,720px)]">
        <aside className="md:sticky md:top-28 md:h-fit">
          <div className="mb-7">
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-black/35">Kasus</p>
            {kasus.loading ? (
              <div className="h-7 w-40 animate-pulse rounded bg-black/[0.07]" />
            ) : kasus.error ? (
              <p className="text-sm text-[#a75128]">{kasus.error.message}</p>
            ) : (
              <>
                <h1 className="text-xl font-medium tracking-[-0.04em]">{kasus.data?.namaUsaha}</h1>
                <p className="mt-1 text-sm text-black/45">
                  {kasus.data?.produk || "Produk belum ditentukan"}
                  <span className="mx-1 text-black/25">→</span>
                  {kasus.data?.tujuan || "Tujuan belum ditentukan"}
                </p>
              </>
            )}
          </div>

          <div className="mb-8 border-y border-black/[0.08] py-4 text-xs">
            <div className="flex justify-between py-1.5 text-black/45">
              <span>Kode kasus</span>
              <span className="font-mono text-[10px] text-black/65">{kasus.data?.kode ?? kode.toUpperCase()}</span>
            </div>
            <div className="flex justify-between py-1.5 text-black/45">
              <span>Progress</span>
              <span className="text-black/75">
                {terjawab}/{total} terjawab
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            {DIMENSION_ORDER.map((dimensi, dimensionIndex) => {
              const aktif = question?.dimensi === dimensi
              const terkait = pertanyaan.filter((item) => item.dimensi === dimensi)
              const selesai =
                terkait.length > 0 &&
                terkait.every((item) => {
                  const nilai = state?.jawaban[item.id]
                  return Array.isArray(nilai) ? nilai.length > 0 : Boolean(nilai)
                })
              return (
                <div
                  key={dimensi}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs transition-colors ${
                    aktif ? "bg-white text-black" : "text-black/40"
                  }`}
                >
                  <span
                    className={`flex size-5 items-center justify-center rounded-full border text-[10px] ${
                      selesai
                        ? "border-[#789b74] bg-[#789b74] text-white"
                        : aktif
                          ? "border-black/40 text-black"
                          : "border-black/15"
                    }`}
                  >
                    {selesai ? <Check className="size-3" /> : dimensionIndex + 1}
                  </span>
                  <span>{DIMENSION_LABEL[dimensi]}</span>
                </div>
              )
            })}
          </div>

          <p className="mt-8 hidden text-xs leading-relaxed text-black/35 md:block">
            Pertanyaan menyesuaikan jawabanmu — beberapa pertanyaan bisa muncul atau hilang di tengah jalan.
          </p>

          <Link href="/umkm" className="mt-6 inline-flex items-center gap-2 text-xs text-black/40 hover:text-black">
            <ArrowLeft className="size-3.5" /> Kembali ke dashboard
          </Link>
        </aside>

        <section aria-label="Pertanyaan assessment" className="min-w-0">
          {memuat && <LoadingBlock rows={2} />}

          {!memuat && awal.error && (
            <ErrorBlock error={awal.error} onRetry={awal.reload} title="Assessment tidak dapat dimuat">
              <Link
                href="/umkm"
                className="mt-4 inline-flex items-center gap-2 text-xs text-[#a75128] underline underline-offset-4"
              >
                Kembali ke dashboard <ArrowRight className="size-3.5" />
              </Link>
            </ErrorBlock>
          )}

          {!memuat && !awal.error && !question && (
            <div className="rounded-2xl border border-dashed border-black/15 p-10 text-center text-sm text-black/50">
              Tidak ada pertanyaan yang perlu dijawab untuk kasus ini.
            </div>
          )}

          {!memuat && !awal.error && question && state && (
            <>
              <div className="mb-9">
                <div className="mb-4 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-black/35">
                  <span>
                    Langkah {index + 1} dari {pertanyaan.length}
                  </span>
                  <span>{persen}%</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-black/[0.07]">
                  <div
                    className="h-full rounded-full bg-[#18251f] transition-all duration-500"
                    style={{ width: `${persen}%` }}
                  />
                </div>
              </div>

              <div className="mb-5 flex items-center gap-2 text-xs text-black/45">
                <span className="rounded-full bg-[#e7ebe3] px-2.5 py-1 text-[#4c674f]">{question.section}</span>
                <span className="font-mono text-[10px] text-black/25">{question.id}</span>
                {!question.wajib && <span className="text-[10px] text-black/30">opsional</span>}
              </div>

              <h2 className="max-w-2xl text-3xl font-light leading-tight tracking-[-0.045em] md:text-5xl">
                {question.title}
              </h2>
              {question.description && (
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-black/50">{question.description}</p>
              )}

              {question.glossary && question.glossary.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {question.glossary.map((item) => (
                    <details key={item.term} className="group relative">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-black/[0.1] bg-white/60 px-3 py-1.5 text-xs text-black/55">
                        <CircleHelp className="size-3.5" /> Apa itu {item.term}?{" "}
                        <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="absolute left-0 top-10 z-10 w-72 rounded-xl border border-black/10 bg-white p-4 text-xs leading-relaxed text-black/60 shadow-xl">
                        <strong className="mb-1 block text-black">{item.term}</strong>
                        {item.definition}
                      </div>
                    </details>
                  ))}
                </div>
              )}

              <div className="mt-10">
                <QuestionInput question={question} value={jawabanSaatIni} onChange={ubahJawaban} />
              </div>

              <div className="mt-12 flex items-center justify-between border-t border-black/[0.08] pt-5">
                <button
                  type="button"
                  onClick={() => setIndex((current) => Math.max(current - 1, 0))}
                  disabled={index === 0}
                  className="flex items-center gap-2 text-sm text-black/45 transition-colors hover:text-black disabled:cursor-not-allowed disabled:opacity-25"
                >
                  <ArrowLeft className="size-4" /> Sebelumnya
                </button>

                {index === pertanyaan.length - 1 ? (
                  state.bolehLihatHasil ? (
                    <Link
                      href={`/hasil/${kode.toLowerCase()}`}
                      className="flex items-center gap-2 rounded-full bg-[#18251f] px-5 py-2.5 text-sm text-[#f5f4f0] transition-transform hover:translate-x-0.5"
                    >
                      Lihat hasil <ArrowRight className="size-4" />
                    </Link>
                  ) : (
                    <span className="flex flex-col items-end gap-1 text-right">
                      <span className="cursor-not-allowed rounded-full bg-[#18251f]/25 px-5 py-2.5 text-sm text-[#f5f4f0]">
                        Lihat hasil
                      </span>
                      <span className="text-[11px] text-[#a75128]">
                        Masih ada {sisaWajib} pertanyaan wajib yang belum terjawab.
                      </span>
                    </span>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => setIndex((current) => Math.min(current + 1, pertanyaan.length - 1))}
                    className="flex items-center gap-2 rounded-full bg-[#18251f] px-5 py-2.5 text-sm text-[#f5f4f0] transition-transform hover:translate-x-0.5"
                  >
                    Berikutnya <ArrowRight className="size-4" />
                  </button>
                )}
              </div>

              {state.bolehLihatHasil && index !== pertanyaan.length - 1 && (
                <div className="mt-6">
                  <Link
                    href={`/hasil/${kode.toLowerCase()}`}
                    className="inline-flex items-center gap-2 text-sm text-[#a75128] underline underline-offset-4"
                  >
                    Semua pertanyaan sudah terjawab — lihat hasil <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              )}

              <div className="mt-8 flex items-center gap-2 text-[11px] text-black/30">
                <Cloud className="size-3.5" /> Jawaban tersimpan otomatis di server setiap kali kamu menjawab.
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: Question
  value: AnswerValue
  onChange: (question: Question, nilai: AnswerValue, langsung: boolean) => void
}) {
  const teks = typeof value === "string" ? value : ""
  const daftar = Array.isArray(value) ? value : []

  function pilih(option: string) {
    onChange(question, option, true)
  }

  function toggle(option: string) {
    const berikutnya = daftar.includes(option) ? daftar.filter((item) => item !== option) : [...daftar, option]
    onChange(question, berikutnya, true)
  }

  return (
    <>
      {question.type === "text" && (
        <input
          key={question.id}
          autoFocus
          value={teks}
          onChange={(event) => onChange(question, event.target.value, false)}
          placeholder={question.placeholder ?? undefined}
          className="w-full border-0 border-b border-black/20 bg-transparent px-0 py-4 text-xl outline-none placeholder:text-black/20 focus:border-black/70"
        />
      )}

      {question.type === "number" && (
        <div className="flex items-center gap-3 border-b border-black/20">
          <input
            key={question.id}
            autoFocus
            type="number"
            value={teks}
            onChange={(event) => onChange(question, event.target.value, false)}
            placeholder={question.placeholder ?? undefined}
            className="w-full border-0 bg-transparent px-0 py-4 text-3xl outline-none placeholder:text-black/20"
          />
        </div>
      )}

      {question.type === "select" && (
        <div className="flex flex-col gap-2">
          {(question.options ?? []).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => pilih(option)}
              className={`flex items-center justify-between rounded-xl border px-4 py-3.5 text-left text-sm transition-all ${
                teks === option ? "border-[#18251f] bg-[#e7ebe3]" : "border-black/[0.1] bg-white/50 hover:border-black/30"
              }`}
            >
              <span>{option}</span>
              {teks === option && <Check className="size-4 text-[#4c674f]" />}
            </button>
          ))}
        </div>
      )}

      {question.type === "yesno" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {["Ya", "Tidak"].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => pilih(option)}
              className={`rounded-xl border px-4 py-5 text-left text-sm transition-all ${
                teks === option ? "border-[#18251f] bg-[#e7ebe3]" : "border-black/[0.1] bg-white/50 hover:border-black/30"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {question.type === "multi" && (
        <div className="flex flex-col gap-2">
          {(question.options ?? []).map((option) => {
            const terpilih = daftar.includes(option)
            return (
              <button
                key={option}
                type="button"
                onClick={() => toggle(option)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition-all ${
                  terpilih ? "border-[#18251f] bg-[#e7ebe3]" : "border-black/[0.1] bg-white/50 hover:border-black/30"
                }`}
              >
                <span
                  className={`flex size-5 items-center justify-center rounded-md border ${
                    terpilih ? "border-[#18251f] bg-[#18251f] text-white" : "border-black/20"
                  }`}
                >
                  {terpilih && <Check className="size-3" />}
                </span>
                {option}
              </button>
            )
          })}
        </div>
      )}

      {(question.supportsUnknown || question.supportsNotOwned) && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-black/35">Atau pilih:</span>
            {question.supportsUnknown && (
              <button
                type="button"
                onClick={() => onChange(question, question.type === "multi" ? ["Saya belum tahu"] : "Saya belum tahu", true)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  teks === "Saya belum tahu" || daftar.includes("Saya belum tahu")
                    ? "border-[#18251f] bg-[#e7ebe3]"
                    : "border-black/10 bg-white/50 hover:border-black/30"
                }`}
              >
                Saya belum tahu
              </button>
            )}
            {question.supportsNotOwned && (
              <button
                type="button"
                onClick={() => onChange(question, question.type === "multi" ? ["Belum punya"] : "Belum punya", true)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  teks === "Belum punya" || daftar.includes("Belum punya")
                    ? "border-[#18251f] bg-[#e7ebe3]"
                    : "border-black/10 bg-white/50 hover:border-black/30"
                }`}
              >
                Belum punya
              </button>
            )}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#eeeee9] px-4 py-3 text-xs leading-relaxed text-black/45">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>Jawaban dapat diubah kapan saja. Tidak ada jawaban yang salah.</span>
          </div>
        </>
      )}
    </>
  )
}
