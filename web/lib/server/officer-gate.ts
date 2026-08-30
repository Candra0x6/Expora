/**
 * Gerbang officer-in-the-loop — `docs/user-flow.md` §6.2, `handoff-backend.md` §3.6.
 *
 * "Tinjau & kirim rencana" ditolak `422` kalau ada dimensi berstatus `officer`
 * yang belum petugas sentuh. Kontrak tidak merinci butir-per-butir apa arti
 * "sentuh" untuk tiga sumber sinyal (catatan, rekomendasi, permintaan info) —
 * keputusan implementasi di sini, dicatat juga di data-contract.md §6:
 *
 * Sebuah dimensi `officer` dianggap SUDAH tersentuh kalau salah satu dari ini
 * benar untuk kasus tersebut:
 *   - sudah ada `OfficerNote` dengan `dimensi` yang sama, ATAU catatan umum
 *     (`dimensi = null`, dianggap menyentuh semua dimensi);
 *   - sudah ada `Recommendation` bersumber `OFFICER` (mengedit rekomendasi
 *     adalah tinjauan menyeluruh, jadi berlaku untuk semua dimensi);
 *   - sudah ada `InfoRequest` dengan `dimensi` yang sama, atau permintaan umum
 *     (`dimensi = null`).
 */

import type { Dimension } from "@/lib/types"
import { prisma } from "./db"

export async function untouchedOfficerDimensions(
  caseId: string,
  officerDimensions: Dimension[],
): Promise<Dimension[]> {
  if (officerDimensions.length === 0) return []

  const [notes, requests, officerRecommendation] = await Promise.all([
    prisma.officerNote.findMany({ where: { caseId }, select: { dimensi: true } }),
    prisma.infoRequest.findMany({ where: { caseId }, select: { dimensi: true } }),
    prisma.recommendation.findFirst({ where: { caseId, sumber: "OFFICER" }, select: { id: true } }),
  ])

  if (officerRecommendation) return []
  if (notes.some((n) => n.dimensi === null)) return []
  if (requests.some((r) => r.dimensi === null)) return []

  const notedDims = new Set(notes.map((n) => n.dimensi).filter((d): d is string => d !== null))
  const requestedDims = new Set(requests.map((r) => r.dimensi).filter((d): d is string => d !== null))

  return officerDimensions.filter((d) => !notedDims.has(d) && !requestedDims.has(d))
}
