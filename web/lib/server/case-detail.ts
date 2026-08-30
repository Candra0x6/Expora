/**
 * `CaseDetail` — `docs/data-contract.md` §3.2.
 *
 * Penyaringan per role dilakukan DI SINI, bukan di UI: `catatanInternal` dan
 * `eskalasi` hanya untuk PETUGAS, `rencana` hanya untuk UMKM (dan hanya saat
 * status RENCANA_TERKIRIM/SELESAI). Properti yang tidak boleh terlihat sengaja
 * tidak diisi (`undefined`) supaya hilang dari JSON, bukan diisi `null`.
 */

import type { CaseDetail, Dimension, Escalation, OfficerNote } from "@/lib/types"
import type { CaseWithBusiness } from "./auth"
import type { Authed } from "./auth"
import { prisma } from "./db"
import { hariSejak, nextActionBy } from "./case-state"
import { toEvidenceFile } from "./mappers"
import { buildMentoringPlan } from "./plan"
import { caseContext } from "./engine/narrative"
import { readActiveAnswers } from "./readiness-service"
import { signedUrls } from "./storage"

export async function buildCaseDetail(kasus: CaseWithBusiness, user: Authed): Promise<CaseDetail> {
  const answers = await readActiveAnswers(kasus.id)
  const hariMenunggu = hariSejak(kasus.dikirimPada ?? kasus.dibuatPada)

  const evidenceRows = await prisma.evidence.findMany({
    where: { caseId: kasus.id },
    orderBy: { diunggahPada: "asc" },
  })
  const urls = await signedUrls(evidenceRows.map((row) => row.storagePath))
  const bukti = evidenceRows.map((row) => toEvidenceFile(row, urls.get(row.storagePath) ?? ""))

  const detail: CaseDetail = {
    id: kasus.id,
    kode: kasus.kode,
    namaUsaha: kasus.business.nama,
    produk: kasus.produk,
    tujuan: kasus.tujuan,
    status: kasus.status,
    nextActionBy: nextActionBy(kasus.status),
    tahap: kasus.tahap,
    versiAssessment: kasus.versiAssessment,
    dibuatPada: kasus.dibuatPada.toISOString(),
    dikirimPada: kasus.dikirimPada?.toISOString() ?? null,
    targetEkspor: kasus.targetEkspor ? kasus.targetEkspor.toISOString().slice(0, 10) : null,
    hariMenunggu,
    konteks: caseContext(answers),
    ditinjauOleh:
      kasus.ditinjauOleh && kasus.ditinjauPada
        ? { nama: kasus.ditinjauOleh.namaLengkap, pada: kasus.ditinjauPada.toISOString() }
        : null,
    bukti,
  }

  if (user.role === "PETUGAS") {
    const [notes, escalation] = await Promise.all([
      prisma.officerNote.findMany({
        where: { caseId: kasus.id },
        orderBy: { dibuatPada: "desc" },
        include: { officer: true },
      }),
      prisma.escalation.findFirst({
        where: { caseId: kasus.id },
        orderBy: { dibuatPada: "desc" },
        include: { officer: true },
      }),
    ])

    detail.catatanInternal = notes.map(
      (note): OfficerNote => ({
        id: note.id,
        isi: note.isi,
        olehNama: note.officer.namaLengkap,
        dibuatPada: note.dibuatPada.toISOString(),
      }),
    )

    detail.eskalasi = escalation
      ? ({
          id: escalation.id,
          kategori: escalation.kategori as Dimension,
          alasan: escalation.alasan,
          olehNama: escalation.officer.namaLengkap,
          dibuatPada: escalation.dibuatPada.toISOString(),
        } satisfies Escalation)
      : null
  }

  if (user.role === "UMKM") {
    detail.rencana = await buildMentoringPlan(kasus)
  }

  return detail
}
