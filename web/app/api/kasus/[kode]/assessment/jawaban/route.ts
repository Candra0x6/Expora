import { z } from "zod"
import { prisma } from "@/lib/server/db"
import { requireCaseAccess, requireRole } from "@/lib/server/auth"
import { QUESTION_BY_ID } from "@/lib/server/engine/questions"
import { buildAssessmentState } from "@/lib/server/engine/visible-questions"
import { readAllAnswers, syncAktif } from "@/lib/server/readiness-service"
import { ApiError, handle, ok, parseJson } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const Body = z.object({
  questionId: z.string().trim().min(1),
  jawaban: z.union([z.string(), z.array(z.string())]),
})

/**
 * PUT /api/kasus/[kode]/assessment/jawaban — autosave satu jawaban.
 *
 * `data-contract.md` §3.3: respons berisi `AssessmentState` PENUH setelah
 * jawaban diterapkan — frontend mengganti state-nya, tidak menggabung manual.
 * Jawaban untuk pertanyaan yang tidak lagi terlihat ditandai `aktif = false`,
 * tidak dihapus (`syncAktif`).
 */
export async function PUT(request: Request, context: { params: Promise<{ kode: string }> }) {
  return handle(async () => {
    const user = await requireRole("UMKM")
    const { kode } = await context.params
    const kasus = await requireCaseAccess(kode, user)
    const body = await parseJson(request, Body)

    const question = QUESTION_BY_ID[body.questionId]
    if (!question) {
      throw new ApiError("VALIDASI_GAGAL", "Pertanyaan tidak dikenali.", { questionId: body.questionId })
    }

    await prisma.assessmentAnswer.upsert({
      where: { caseId_questionId: { caseId: kasus.id, questionId: body.questionId } },
      create: {
        caseId: kasus.id,
        questionId: body.questionId,
        dimensi: question.dimensi,
        nilai: body.jawaban,
        aktif: true,
      },
      update: { nilai: body.jawaban, dijawabPada: new Date() },
    })

    const semua = await readAllAnswers(kasus.id)
    await syncAktif(kasus.id, semua)

    const terakhir = await prisma.assessmentAnswer.aggregate({
      where: { caseId: kasus.id },
      _max: { dijawabPada: true },
    })

    return ok(buildAssessmentState(semua, terakhir._max.dijawabPada?.toISOString() ?? null))
  })
}
