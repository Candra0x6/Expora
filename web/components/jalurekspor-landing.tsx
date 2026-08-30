import Link from "next/link"
import { ArrowRight, ClipboardList, FileSearch, ListChecks, ShieldCheck, TrendingUp } from "lucide-react"
import { Logo } from "@/components/site-header"

const langkah = [
  {
    kode: "01",
    judul: "Assessment yang menyesuaikan",
    teks: "Pertanyaan berkembang mengikuti jawabanmu, jadi kamu tidak mengisi hal yang tidak relevan.",
    Ikon: ClipboardList,
  },
  {
    kode: "02",
    judul: "Rekomendasi maksimal tiga langkah",
    teks: "Bukan daftar panjang. Hanya langkah yang paling membuka jalan, lengkap dengan alasannya.",
    Ikon: ListChecks,
  },
  {
    kode: "03",
    judul: "Penjelasan yang bisa ditelusuri",
    teks: "Fakta yang dipakai, informasi yang belum ada, tingkat keyakinan, dan sumber rujukan ditampilkan terbuka.",
    Ikon: FileSearch,
  },
  {
    kode: "04",
    judul: "Petugas meninjau sebelum final",
    teks: "Draft AI tidak pernah menjadi rencana sebelum petugas benar-benar membacanya dan menyetujuinya.",
    Ikon: ShieldCheck,
  },
  {
    kode: "05",
    judul: "Progres terpantau",
    teks: "Riwayat, tugas, dan giliran bertindak tersimpan, sehingga konsultasi berikutnya tidak mulai dari nol.",
    Ikon: TrendingUp,
  },
]

export function JalurEksporLanding() {
  return (
    <main className="min-h-screen bg-[#f5f4f0] text-[#18251f]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-10">
        <Logo />
        <Link href="/masuk" className="text-sm text-[#18251f]/60 transition-colors hover:text-[#18251f]">
          Masuk
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-14 pt-6 lg:px-10 lg:pb-20">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.22em] text-[#a75128]">
          Pendampingan ekspor UMKM
        </p>
        <h1 className="max-w-4xl font-serif text-4xl leading-[1.08] tracking-tight sm:text-6xl">
          Pahami kesiapan ekspor usahamu, dengan pendampingan petugas yang nyata.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-[#18251f]/60">
          JalurEkspor memetakan enam area kesiapan ekspor usahamu, menunjukkan hambatan yang sebenarnya, dan
          menghubungkanmu dengan petugas yang meninjau setiap rekomendasi sebelum menjadi rencana.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/daftar"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#18251f] px-6 py-3 text-sm text-[#f5f4f0] transition-transform hover:translate-x-0.5"
          >
            Mulai assessment <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/masuk"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#18251f]/15 px-6 py-3 text-sm transition-colors hover:bg-white/70"
          >
            Masuk ke akun
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16 lg:px-10">
        <div className="mb-6 flex flex-col gap-1 border-t border-[#18251f]/10 pt-8 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-serif text-2xl">Lima langkah, satu alur.</h2>
          <p className="text-xs text-[#18251f]/40">Assess → rekomendasi → penjelasan → petugas meninjau → progres</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {langkah.map(({ kode, judul, teks, Ikon }) => (
            <article key={kode} className="rounded-2xl border border-[#18251f]/10 bg-white/55 p-5">
              <div className="flex items-center justify-between">
                <Ikon className="size-4 text-[#a75128]" />
                <span className="font-mono text-[10px] tracking-[0.18em] text-[#18251f]/30">{kode}</span>
              </div>
              <h3 className="mt-5 text-sm font-medium">{judul}</h3>
              <p className="mt-2 text-sm leading-6 text-[#18251f]/55">{teks}</p>
            </article>
          ))}
          <article className="rounded-2xl border border-[#18251f]/10 bg-[#18251f] p-5 text-[#f5f4f0]">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#c47743]">Batasan</p>
            <p className="mt-5 text-sm leading-6 text-[#f5f4f0]/70">
              Sistem ini tidak menetapkan HS Code final, tidak memutuskan status Lartas, dan tidak menyetujui PEB.
              Keputusan kepabeanan tetap milik instansi berwenang.
            </p>
          </article>
        </div>
      </section>

      <footer className="border-t border-[#18251f]/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-xs text-[#18251f]/40 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <span>JalurEkspor · pendampingan kesiapan ekspor UMKM</span>
          <span className="flex gap-4">
            <Link href="/masuk" className="hover:text-[#18251f]">
              Masuk
            </Link>
            <Link href="/daftar" className="hover:text-[#18251f]">
              Daftar
            </Link>
          </span>
        </div>
      </footer>
    </main>
  )
}
