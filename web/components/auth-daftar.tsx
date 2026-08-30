"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Info } from "lucide-react"
import { api, ApiClientError } from "@/lib/api-client"
import { FormError } from "@/components/state-blocks"
import { Logo } from "@/components/site-header"

export function AuthDaftar() {
  const router = useRouter()
  const [namaPemilik, setNamaPemilik] = useState("")
  const [namaUsaha, setNamaUsaha] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordTerlaluPendek = password.length > 0 && password.length < 8

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const hasil = await api.daftar({
        namaPemilik: namaPemilik.trim(),
        namaUsaha: namaUsaha.trim(),
        email: email.trim(),
        password,
      })
      router.push(hasil.redirectTo)
      router.refresh()
    } catch (gagal) {
      setError(gagal instanceof ApiClientError ? gagal.message : null)
      setPending(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f4f0] text-[#18251f]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-10">
        <Logo />
        <Link href="/masuk" className="text-sm text-[#18251f]/60 transition-colors hover:text-[#18251f]">
          Masuk
        </Link>
      </header>

      <div className="mx-auto flex max-w-md flex-col px-6 pb-20 pt-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-[#a75128]">Daftar</p>
        <h1 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">Mulai dari kondisi usahamu.</h1>
        <p className="mt-3 text-sm leading-6 text-[#18251f]/55">
          Buat akun untuk mengisi assessment kesiapan ekspor dan mendapat pendampingan petugas.
        </p>

        <form onSubmit={submit} className="mt-8 flex flex-col gap-4 rounded-2xl border border-[#18251f]/10 bg-white/55 p-6">
          <label className="flex flex-col gap-2">
            <span className="text-xs text-[#18251f]/50">Nama pemilik</span>
            <input
              required
              autoComplete="name"
              value={namaPemilik}
              onChange={(event) => setNamaPemilik(event.target.value)}
              placeholder="Budi Santoso"
              className="h-11 rounded-xl border border-[#18251f]/10 bg-[#f5f4f0]/70 px-3 text-sm outline-none placeholder:text-[#18251f]/30 focus:border-[#18251f]/35"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs text-[#18251f]/50">Nama usaha</span>
            <input
              required
              autoComplete="organization"
              value={namaUsaha}
              onChange={(event) => setNamaUsaha(event.target.value)}
              placeholder="Lereng Lawu Foods"
              className="h-11 rounded-xl border border-[#18251f]/10 bg-[#f5f4f0]/70 px-3 text-sm outline-none placeholder:text-[#18251f]/30 focus:border-[#18251f]/35"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs text-[#18251f]/50">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nama@usaha.id"
              className="h-11 rounded-xl border border-[#18251f]/10 bg-[#f5f4f0]/70 px-3 text-sm outline-none placeholder:text-[#18251f]/30 focus:border-[#18251f]/35"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs text-[#18251f]/50">Password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimal 8 karakter"
              className="h-11 rounded-xl border border-[#18251f]/10 bg-[#f5f4f0]/70 px-3 text-sm outline-none placeholder:text-[#18251f]/30 focus:border-[#18251f]/35"
            />
            {passwordTerlaluPendek && (
              <span className="text-[11px] text-[#a75128]">Password minimal 8 karakter.</span>
            )}
          </label>

          <FormError message={error} />

          <button
            type="submit"
            disabled={pending || password.length < 8}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#18251f] px-5 py-3 text-sm text-[#f5f4f0] transition-transform hover:translate-x-0.5 disabled:opacity-60"
          >
            {pending ? "Membuat akun…" : "Daftar & mulai"} <ArrowRight className="size-4" />
          </button>

          <p className="text-center text-xs text-[#18251f]/50">
            Sudah punya akun?{" "}
            <Link href="/masuk" className="text-[#a75128] underline underline-offset-4">
              Masuk
            </Link>
          </p>
        </form>

        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-[#eeeee9] px-4 py-3 text-xs leading-6 text-[#18251f]/55">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Pendaftaran ini khusus pemilik usaha. Akun petugas disiapkan oleh pengelola program, jadi tidak tersedia
            pendaftaran mandiri untuk petugas.
          </span>
        </p>

        <Link href="/" className="mt-6 text-center text-xs text-[#18251f]/40 hover:text-[#18251f]">
          Kembali ke beranda
        </Link>
      </div>
    </main>
  )
}
