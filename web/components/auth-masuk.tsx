"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, KeyRound } from "lucide-react"
import { api, ApiClientError } from "@/lib/api-client"
import { FormError } from "@/components/state-blocks"
import { Logo } from "@/components/site-header"
import type { AuthResult, Role } from "@/lib/types"

const DEMO_PASSWORD = "Demo1234!"
const AKUN_DEMO = [
  { peran: "UMKM", email: "umkm@jalurekspor.id" },
  { peran: "Petugas", email: "petugas@jalurekspor.id" },
]

/** `?next=` hanya dihormati kalau rutenya memang milik role tersebut. */
function tujuan(hasil: AuthResult, next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return hasil.redirectTo
  const untukPetugas = next.startsWith("/petugas")
  const cocok: Record<Role, boolean> = { PETUGAS: untukPetugas, UMKM: !untukPetugas }
  return cocok[hasil.role] ? next : hasil.redirectTo
}

export function AuthMasuk() {
  const router = useRouter()
  const next = useSearchParams().get("next")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const hasil = await api.masuk({ email: email.trim(), password })
      router.push(tujuan(hasil, next))
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
        <Link href="/daftar" className="text-sm text-[#18251f]/60 transition-colors hover:text-[#18251f]">
          Daftar
        </Link>
      </header>

      <div className="mx-auto flex max-w-md flex-col px-6 pb-20 pt-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-[#a75128]">Masuk</p>
        <h1 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">Lanjutkan pendampingan.</h1>
        <p className="mt-3 text-sm leading-6 text-[#18251f]/55">
          Masuk untuk melihat kasus, hasil kesiapan, dan giliran tindakan berikutnya.
        </p>

        <form onSubmit={submit} className="mt-8 flex flex-col gap-4 rounded-2xl border border-[#18251f]/10 bg-white/55 p-6">
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
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="h-11 rounded-xl border border-[#18251f]/10 bg-[#f5f4f0]/70 px-3 text-sm outline-none placeholder:text-[#18251f]/30 focus:border-[#18251f]/35"
            />
          </label>

          <FormError message={error} />

          <button
            type="submit"
            disabled={pending}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#18251f] px-5 py-3 text-sm text-[#f5f4f0] transition-transform hover:translate-x-0.5 disabled:opacity-60"
          >
            {pending ? "Memeriksa…" : "Masuk"} <ArrowRight className="size-4" />
          </button>

          <p className="text-center text-xs text-[#18251f]/50">
            Belum punya akun?{" "}
            <Link href="/daftar" className="text-[#a75128] underline underline-offset-4">
              Daftar sebagai UMKM
            </Link>
          </p>
        </form>

        <div className="mt-4 rounded-2xl border border-[#c47743]/25 bg-[#f0e6d7]/60 p-4">
          <p className="flex items-center gap-2 text-xs font-medium text-[#a75128]">
            <KeyRound className="size-3.5" /> Akun demo — klik untuk isi otomatis
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {AKUN_DEMO.map((akun) => (
              <button
                key={akun.email}
                type="button"
                onClick={() => {
                  setEmail(akun.email)
                  setPassword(DEMO_PASSWORD)
                  setError(null)
                }}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#a75128]/20 bg-white/50 px-3 py-2 text-left text-xs transition-colors hover:border-[#a75128]/45 hover:bg-white/80"
              >
                <span className="text-[#18251f]/60">{akun.peran}</span>
                <span className="font-mono text-[11px] text-[#18251f]/80">{akun.email}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[#18251f]/40">
            Password akun demo: <span className="font-mono">{DEMO_PASSWORD}</span>
          </p>
        </div>

        <Link href="/" className="mt-6 text-center text-xs text-[#18251f]/40 hover:text-[#18251f]">
          Kembali ke beranda
        </Link>
      </div>
    </main>
  )
}
