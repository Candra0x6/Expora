/**
 * Dimensi blocker untuk antrean petugas — `docs/user-flow.md` §7.3.
 *
 * "Blocker bukan kolom yang diketik manusia." Diturunkan: dimensi dengan bobot
 * keparahan tertinggi, seri diputus dengan urutan kanonis — aturan yang sama
 * persis dengan pemilihan next action.
 *
 * `alasan` sengaja memakai kalimat penjelas dari dimensi itu, bukan skor
 * prioritas. Ini yang diminta user-flow §6.1 dan ikut dinilai juri.
 */

import { DIMENSION_ORDER, SEVERITY_WEIGHT, type CaseBlocker, type Dimension, type DimensionStatus } from "@/lib/types"
import { DIMENSION_LABEL } from "./next-actions"

const CANONICAL_INDEX: Record<Dimension, number> = Object.fromEntries(
  DIMENSION_ORDER.map((dimensi, index) => [dimensi, index]),
) as Record<Dimension, number>

/** `null` kalau semua dimensi `ready` — tidak ada yang menghambat. */
export function selectBlockerDimension(
  statuses: Record<Dimension, DimensionStatus>,
): Dimension | null {
  const kandidat = DIMENSION_ORDER.filter((dimensi) => SEVERITY_WEIGHT[statuses[dimensi]] > 0)
  if (kandidat.length === 0) return null

  return [...kandidat].sort((a, b) => {
    const selisih = SEVERITY_WEIGHT[statuses[b]] - SEVERITY_WEIGHT[statuses[a]]
    if (selisih !== 0) return selisih
    return CANONICAL_INDEX[a] - CANONICAL_INDEX[b]
  })[0]
}

export function buildBlocker(
  statuses: Record<Dimension, DimensionStatus>,
  alasanPerDimensi: Partial<Record<Dimension, string>>,
): CaseBlocker | null {
  const dimensi = selectBlockerDimension(statuses)
  if (!dimensi) return null
  return {
    dimensi,
    ringkas: DIMENSION_LABEL[dimensi],
    alasan: alasanPerDimensi[dimensi] ?? "Perlu diperiksa petugas.",
  }
}
