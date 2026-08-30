"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ApiClientError } from "@/lib/api-client"

export type Resource<T> = {
  data: T | null
  error: ApiClientError | null
  loading: boolean
  /** Ambil ulang dari server. */
  reload: () => void
  /** Perbarui data di klien tanpa memanggil server (untuk pembaruan optimistis). */
  set: (next: T | null | ((current: T | null) => T | null)) => void
}

/**
 * Pembungkus fetch untuk layar yang mengambil data.
 *
 * `deps` menentukan kapan data diambil ulang. `load` boleh `null` selama
 * prasyaratnya belum siap (mis. kode kasus belum tersedia) — resource akan
 * tetap berstatus loading tanpa memanggil server.
 */
export function useResource<T>(load: (() => Promise<T>) | null, deps: React.DependencyList): Resource<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiClientError | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    const loader = loadRef.current
    if (!loader) {
      setLoading(true)
      return
    }
    let aktif = true
    setLoading(true)
    setError(null)
    loader()
      .then((hasil) => {
        if (!aktif) return
        setData(hasil)
        setLoading(false)
      })
      .catch((gagal: unknown) => {
        if (!aktif) return
        setError(
          gagal instanceof ApiClientError
            ? gagal
            : new ApiClientError(0, "KESALAHAN_SERVER", (gagal as Error)?.message ?? "Terjadi kesalahan."),
        )
        setLoading(false)
      })
    return () => {
      aktif = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((value) => value + 1), [])

  const set = useCallback((next: T | null | ((current: T | null) => T | null)) => {
    setData((current) => (typeof next === "function" ? (next as (c: T | null) => T | null)(current) : next))
  }, [])

  return { data, error, loading, reload, set }
}

/** Menunda pembaruan nilai — dipakai untuk autosave dan kotak pencarian. */
export function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
