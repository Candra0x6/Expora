"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { CircleAlert, RotateCcw } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import type { ApiClientError } from "@/lib/api-client"

/**
 * Tiga state wajib untuk setiap layar yang mengambil data: loading, empty, error.
 * Pesan error selalu berasal dari `message` milik server, apa adanya.
 */

export function LoadingBlock({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`} role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Memuat data…</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-[#18251f]/10 bg-white/45 p-5">
          <Skeleton className="h-3 w-24 bg-[#18251f]/8" />
          <Skeleton className="mt-3 h-5 w-2/3 bg-[#18251f]/8" />
          <Skeleton className="mt-3 h-3 w-full bg-[#18251f]/8" />
          <Skeleton className="mt-2 h-3 w-4/5 bg-[#18251f]/8" />
        </div>
      ))}
    </div>
  )
}

export function LoadingLines({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} role="status" aria-busy="true">
      <span className="sr-only">Memuat data…</span>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-3 w-full bg-[#18251f]/8" style={{ width: `${100 - index * 12}%` }} />
      ))}
    </div>
  )
}

export function ErrorBlock({
  error,
  onRetry,
  title = "Data tidak dapat dimuat",
  children,
}: {
  error: ApiClientError | { message: string } | null
  onRetry?: () => void
  title?: string
  children?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-[#a75128]/25 bg-[#f3e3dc]/70 p-5 sm:p-6">
      <div className="flex gap-3">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-[#a75128]" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[#18251f]">{title}</p>
          {/* Teks dari server, ditampilkan apa adanya. */}
          <p className="mt-2 text-sm leading-6 text-[#18251f]/70">{error?.message}</p>
          {children}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#a75128]/30 bg-white/70 px-4 py-2 text-xs text-[#a75128] transition-colors hover:bg-white"
            >
              <RotateCcw className="size-3.5" /> Coba lagi
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Pesan error sebaris untuk form. Selalu `message` dari server. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="flex items-start gap-2 rounded-xl border border-[#a75128]/25 bg-[#f3e3dc]/70 px-3 py-2.5 text-xs leading-5 text-[#a75128]">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  )
}

export function EmptyBlock({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description: string
  action?: { label: string; href?: string; onClick?: () => void; pending?: boolean }
  icon?: ReactNode
}) {
  return (
    <Empty className="rounded-2xl border border-dashed border-[#18251f]/15 bg-white/35">
      <EmptyHeader>
        {icon && <div className="mb-1 text-[#a75128]">{icon}</div>}
        <EmptyTitle className="font-serif text-xl text-[#18251f]">{title}</EmptyTitle>
        <EmptyDescription className="text-[#18251f]/55">{description}</EmptyDescription>
      </EmptyHeader>
      {action && (
        <EmptyContent>
          {action.href ? (
            <Link
              href={action.href}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#18251f] px-5 py-2.5 text-sm text-[#f5f4f0]"
            >
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              disabled={action.pending}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#18251f] px-5 py-2.5 text-sm text-[#f5f4f0] disabled:opacity-60"
            >
              {action.pending ? "Memproses…" : action.label}
            </button>
          )}
        </EmptyContent>
      )}
    </Empty>
  )
}

/** Catatan batasan wajib (PRD #3) — teksnya tidak boleh diperlembut. */
export function DisclaimerBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-[#c47743]/30 bg-[#f0e6d7]/60 p-5 ${className}`}>
      <div className="flex gap-3">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-[#a75128]" />
        <p className="text-xs leading-6 text-[#18251f]/70">
          Rekomendasi ini adalah panduan pendampingan berdasarkan informasi yang tersedia.{" "}
          <strong className="font-medium text-[#18251f]">Bukan keputusan resmi kepabeanan</strong> — bukan penetapan HS
          final, bukan keputusan Lartas, bukan izin ekspor, dan bukan persetujuan PEB.
        </p>
      </div>
    </div>
  )
}
