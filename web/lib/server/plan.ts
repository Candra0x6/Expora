/**
 * Rencana pendampingan & tugas.
 *
 * Aturan keras (user-flow §3): rencana hanya boleh terlihat UMKM di status
 * `RENCANA_TERKIRIM` atau `SELESAI`. Penyaringannya dilakukan DI SINI, bukan
 * dengan menyembunyikan komponen di UI.
 */

import type { MentoringPlan, Task } from "@/lib/types"
import { prisma } from "./db"
import { rencanaTerlihat } from "./case-state"
import { toEvidenceFile, toTask } from "./mappers"
import { signedUrls } from "./storage"

export async function buildTasks(caseId: string): Promise<Task[]> {
  const tasks = await prisma.task.findMany({
    where: { caseId },
    orderBy: { urutan: "asc" },
    include: { evidences: { orderBy: { diunggahPada: "desc" } } },
  })

  const paths = tasks.flatMap((task) => task.evidences.map((bukti) => bukti.storagePath))
  const urls = await signedUrls(paths)

  return tasks.map((task) =>
    toTask(
      task,
      task.evidences.map((bukti) => toEvidenceFile(bukti, urls.get(bukti.storagePath) ?? "")),
    ),
  )
}

type CaseForPlan = {
  id: string
  status: string
  ditinjauPada: Date | null
  ditinjauOleh: { namaLengkap: string } | null
}

/** `null` selama rencana belum dikirim — tidak ada bocoran draft ke UMKM. */
export async function buildMentoringPlan(kasus: CaseForPlan): Promise<MentoringPlan | null> {
  if (!rencanaTerlihat(kasus.status as never)) return null

  const rekomendasi = await prisma.recommendation.findFirst({
    where: { caseId: kasus.id, sumber: "OFFICER" },
    orderBy: { dibuatPada: "desc" },
  })
  if (!rekomendasi || !kasus.ditinjauOleh || !kasus.ditinjauPada) return null

  return {
    versi: rekomendasi.versi,
    ringkasanPetugas: rekomendasi.ringkasanPetugas ?? rekomendasi.isi,
    ditinjauOleh: { nama: kasus.ditinjauOleh.namaLengkap, pada: kasus.ditinjauPada.toISOString() },
    dikirimPada: kasus.ditinjauPada.toISOString(),
    tugas: await buildTasks(kasus.id),
  }
}
