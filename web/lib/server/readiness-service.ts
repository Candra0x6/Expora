/**
 * Jembatan antara mesin aturan dan database.
 *
 * Mesin aturan murni (lib/server/engine/**) tidak tahu apa-apa soal Prisma.
 * Berkas ini yang membaca jawaban, menjalankan mesin, menyimpan hasilnya, dan
 * menyusun bentuk respons `ReadinessResult`.
 *
 * Status enam dimensi SELALU dihitung ulang dari jawaban aktif — tidak pernah
 * dibaca mentah dari database. Baris `readiness_dimension` hanya menyimpan
 * narasinya (yang bisa ditulis LLM), bukan keputusannya.
 */

import { createHash } from "node:crypto"
import type { Prisma } from "@prisma/client"
import {
  DIMENSION_ORDER,
  type Dimension,
  type DimensionStatus,
  type NextAction,
  type ReadinessResult,
  type RecommendationSource,
  type TaskStatus,
} from "@/lib/types"
import { prisma } from "./db"
import { rencanaTerlihat } from "./case-state"
import { ASSESSMENT_VERSION, type AnswerValue, type AnswerMap } from "./engine/questions"
import { activeAnswers, visibleQuestionIds } from "./engine/visible-questions"
import { computeReadiness, type DimensionStatusMap } from "./engine/readiness"
import { selectNextActions, type SelectedAction } from "./engine/next-actions"
import { computeRingkasan, computeTahap, dimensionFacts, dimensionNarrative } from "./engine/narrative"

// ---------------------------------------------------------------------------
// Jawaban
// ---------------------------------------------------------------------------

/** Semua jawaban tersimpan, termasuk yang tidak aktif. */
export async function readAllAnswers(caseId: string): Promise<AnswerMap> {
  const rows = await prisma.assessmentAnswer.findMany({ where: { caseId } })
  const out: AnswerMap = {}
  for (const row of rows) out[row.questionId] = row.nilai as AnswerValue
  return out
}

/** Hanya jawaban milik pertanyaan yang syaratnya terpenuhi. Ini yang dihitung. */
export async function readActiveAnswers(caseId: string): Promise<AnswerMap> {
  return activeAnswers(await readAllAnswers(caseId))
}

/**
 * Menyelaraskan kolom `aktif` dengan hasil evaluasi percabangan terbaru.
 * Jawaban tidak pernah dihapus — hanya ditandai, supaya kalau syaratnya
 * terpenuhi lagi jawaban lama muncul kembali (user-flow §5.3).
 */
export async function syncAktif(caseId: string, semua: AnswerMap): Promise<void> {
  const terlihat = new Set(visibleQuestionIds(semua))
  const rows = await prisma.assessmentAnswer.findMany({
    where: { caseId },
    select: { id: true, questionId: true, aktif: true },
  })

  const perluAktif = rows.filter((row) => terlihat.has(row.questionId) && !row.aktif).map((row) => row.id)
  const perluNonaktif = rows.filter((row) => !terlihat.has(row.questionId) && row.aktif).map((row) => row.id)

  if (perluAktif.length > 0) {
    await prisma.assessmentAnswer.updateMany({ where: { id: { in: perluAktif } }, data: { aktif: true } })
  }
  if (perluNonaktif.length > 0) {
    await prisma.assessmentAnswer.updateMany({ where: { id: { in: perluNonaktif } }, data: { aktif: false } })
  }
}

// ---------------------------------------------------------------------------
// Versi rekomendasi — append only
// ---------------------------------------------------------------------------

const PREFIX: Record<RecommendationSource, string> = { AI: "AI-DRAFT", OFFICER: "OFFICER" }

export async function nextVersion(caseId: string, sumber: RecommendationSource): Promise<string> {
  const jumlah = await prisma.recommendation.count({ where: { caseId, sumber } })
  return `${PREFIX[sumber]}-${String(jumlah + 1).padStart(2, "0")}`
}

export async function latestRecommendation(caseId: string) {
  return prisma.recommendation.findFirst({
    where: { caseId },
    orderBy: { dibuatPada: "desc" },
    include: { fakta: true, belumDiketahui: true, sumberReferensi: true, dibuatOleh: true },
  })
}

export async function latestOfficerRecommendation(caseId: string) {
  return prisma.recommendation.findFirst({
    where: { caseId, sumber: "OFFICER" },
    orderBy: { dibuatPada: "desc" },
  })
}

// ---------------------------------------------------------------------------
// Perhitungan + penyimpanan
// ---------------------------------------------------------------------------

export type ComputedReadiness = {
  answers: AnswerMap
  statuses: DimensionStatusMap
  actions: SelectedAction[]
  tahap: string
  tahapPenjelasan: string
  ringkasan: string
  narasi: Record<Dimension, { alasan: string; belumAda: string; fakta: string[] }>
}

/**
 * Menghitung status enam dimensi dari jawaban aktif, lalu menyusun narasinya.
 *
 * Narasi yang sudah tersimpan dipertahankan SELAMA statusnya belum berubah —
 * itu yang membuat kalimat tulisan LLM (atau hasil edit petugas) tidak hilang
 * setiap kali halaman dibuka. Begitu statusnya berubah, narasinya kembali ke
 * template deterministik supaya tidak pernah ada kalimat yang bertentangan
 * dengan statusnya sendiri.
 */
export async function computeAndPersist(caseId: string): Promise<ComputedReadiness> {
  const answers = await readActiveAnswers(caseId)
  const statuses = computeReadiness(answers)
  const actions = selectNextActions(statuses)

  const tersimpan = await prisma.readinessDimension.findMany({ where: { caseId } })
  const byDimensi = new Map(tersimpan.map((row) => [row.dimensi as Dimension, row]))

  const narasi = {} as ComputedReadiness["narasi"]
  for (const dimensi of DIMENSION_ORDER) {
    const status = statuses[dimensi]
    const lama = byDimensi.get(dimensi)
    const template = dimensionNarrative(dimensi, status, answers)
    const pakaiLama = lama && (lama.status as DimensionStatus) === status
    narasi[dimensi] = {
      alasan: pakaiLama ? lama.alasan : template.alasan,
      belumAda: pakaiLama ? lama.belumAda : template.belumAda,
      fakta: dimensionFacts(dimensi, answers),
    }
  }

  await prisma.$transaction(
    DIMENSION_ORDER.map((dimensi) =>
      prisma.readinessDimension.upsert({
        where: { caseId_dimensi: { caseId, dimensi } },
        create: {
          caseId,
          dimensi,
          status: statuses[dimensi],
          alasan: narasi[dimensi].alasan,
          belumAda: narasi[dimensi].belumAda,
          fakta: narasi[dimensi].fakta,
        },
        update: {
          status: statuses[dimensi],
          alasan: narasi[dimensi].alasan,
          belumAda: narasi[dimensi].belumAda,
          fakta: narasi[dimensi].fakta,
          dihitungPada: new Date(),
        },
      }),
    ),
  )

  const tahap = computeTahap(statuses)
  const rekomendasi = await latestRecommendation(caseId)
  const ringkasan =
    rekomendasi && rekomendasi.tahap === tahap.tahap ? rekomendasi.ringkasan : computeRingkasan(statuses, actions)

  await prisma.case.update({ where: { id: caseId }, data: { tahap: tahap.tahap } })

  return { answers, statuses, actions, ...tahap, ringkasan, narasi }
}

/** Simpan narasi hasil LLM ke enam baris dimensi. */
export async function persistNarasi(
  caseId: string,
  dimensi: { dimensi: Dimension; alasan: string; belumAda: string }[],
): Promise<void> {
  await prisma.$transaction(
    dimensi.map((item) =>
      prisma.readinessDimension.update({
        where: { caseId_dimensi: { caseId, dimensi: item.dimensi } },
        data: { alasan: item.alasan, belumAda: item.belumAda },
      }),
    ),
  )
}

// ---------------------------------------------------------------------------
// Next action → bentuk API
// ---------------------------------------------------------------------------

/**
 * Id stabil untuk aksi yang belum menjadi `task` di database.
 * Berbentuk UUID supaya frontend bisa memperlakukannya seperti id lain, dan
 * deterministik supaya tidak berubah setiap kali halaman dimuat.
 */
export function syntheticActionId(caseId: string, dimensi: Dimension): string {
  const hex = createHash("sha1").update(`${caseId}:${dimensi}`).digest("hex")
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join("-")
}

export async function buildNextActions(caseId: string, actions: SelectedAction[]): Promise<NextAction[]> {
  const tasks = await prisma.task.findMany({ where: { caseId }, orderBy: { urutan: "asc" } })
  const byDimensi = new Map(tasks.filter((task) => task.dimensi).map((task) => [task.dimensi as Dimension, task]))

  return actions.map((action) => {
    const task = byDimensi.get(action.dimensi)
    return {
      id: task?.id ?? syntheticActionId(caseId, action.dimensi),
      urutan: action.urutan,
      dimensi: action.dimensi,
      judul: task?.judul ?? action.judul,
      kenapa: task?.penjelasan ?? action.kenapa,
      owner: task?.owner ?? action.owner,
      buktiDibutuhkan: task?.buktiDibutuhkan ?? action.buktiDibutuhkan,
      prioritas: action.prioritas,
      status: (task?.status ?? "OPEN") as TaskStatus,
    }
  })
}

// ---------------------------------------------------------------------------
// GET /api/kasus/[kode]/kesiapan
// ---------------------------------------------------------------------------

type CaseForReadiness = {
  id: string
  status: string
  ditinjauPada: Date | null
  ditinjauOleh: { namaLengkap: string } | null
}

export async function buildReadinessResult(kasus: CaseForReadiness): Promise<ReadinessResult> {
  const hasil = await computeAndPersist(kasus.id)

  // Aturan keras user-flow §3 & §5.4: label sumber harus jujur. Selama rencana
  // belum dikirim, yang ada hanyalah draft AI — walaupun petugas sudah menulis
  // versi OFFICER di belakang layar.
  const sudahDitinjau = rencanaTerlihat(kasus.status as never)
  const sumber: RecommendationSource = sudahDitinjau ? "OFFICER" : "AI"

  const rows = await prisma.readinessDimension.findMany({ where: { caseId: kasus.id } })
  const byDimensi = new Map(rows.map((row) => [row.dimensi as Dimension, row]))

  return {
    ringkasan: hasil.ringkasan,
    tahap: hasil.tahap,
    tahapPenjelasan: hasil.tahapPenjelasan,
    sumber,
    ditinjauOleh:
      sudahDitinjau && kasus.ditinjauOleh && kasus.ditinjauPada
        ? { nama: kasus.ditinjauOleh.namaLengkap, pada: kasus.ditinjauPada.toISOString() }
        : null,
    dihitungPada: (byDimensi.get("legalitas")?.dihitungPada ?? new Date()).toISOString(),
    // Selalu enam elemen, selalu urutan kanonis.
    dimensi: DIMENSION_ORDER.map((dimensi) => ({
      dimensi,
      status: hasil.statuses[dimensi],
      alasan: hasil.narasi[dimensi].alasan,
      fakta: hasil.narasi[dimensi].fakta,
      belumAda: hasil.narasi[dimensi].belumAda,
    })),
    nextActions: await buildNextActions(kasus.id, hasil.actions),
  }
}

export const VERSI_ASSESSMENT = ASSESSMENT_VERSION

export type TxClient = Prisma.TransactionClient
