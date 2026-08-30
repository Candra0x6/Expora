"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeft, LogOut } from "lucide-react"
import { api, ApiClientError } from "@/lib/api-client"

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3" aria-label="JalurEkspor">
      <span className="grid size-8 place-items-center rounded-lg bg-[#18251f] text-sm font-semibold text-[#f5f4f0]">J</span>
      <span className="font-serif text-lg text-[#18251f]">JalurEkspor</span>
    </Link>
  )
}

/**
 * Header tunggal untuk seluruh aplikasi. `back` memberi jalan kembali di setiap
 * layar — tidak boleh ada layar tanpa jalan keluar.
 */
export function SiteHeader({
  back,
  right,
  logoHref = "/",
}: {
  back?: { href: string; label: string }
  right?: ReactNode
  logoHref?: string
}) {
  return (
    <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-6 lg:px-10">
      <div className="flex items-center gap-5">
        <Logo href={logoHref} />
        {back && (
          <Link
            href={back.href}
            className="hidden items-center gap-2 border-l border-[#18251f]/10 pl-5 text-sm text-[#18251f]/55 transition-colors hover:text-[#18251f] sm:flex"
          >
            <ArrowLeft className="size-4" /> {back.label}
          </Link>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-[#18251f]/50">{right}</div>
    </header>
  )
}

export function LogoutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function keluar() {
    setPending(true)
    setError(null)
    try {
      await api.keluar()
      router.push("/")
      router.refresh()
    } catch (gagal) {
      setError(gagal instanceof ApiClientError ? gagal.message : null)
      setPending(false)
    }
  }

  return (
    <span className="flex items-center gap-2">
      {error && <span className="max-w-60 text-[11px] text-[#a75128]">{error}</span>}
      <button
        type="button"
        onClick={keluar}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full border border-[#18251f]/12 px-3 py-1.5 text-xs text-[#18251f]/65 transition-colors hover:bg-white/70 disabled:opacity-50"
      >
        <LogOut className="size-3.5" /> {pending ? "Keluar…" : "Keluar"}
      </button>
    </span>
  )
}
