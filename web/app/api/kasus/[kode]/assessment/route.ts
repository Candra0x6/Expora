import { prisma } from "@/lib/server/db"
import { requireCaseAccess, requireRole } from "@/lib/server/auth"
import { readAllAnswers } from "@/lib/server/readiness-service"
import { buildAssessmentState } from "@/lib/server/engine/visible-questions"
import { handle, ok } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/kasus/[kode]/assessment → `AssessmentState` — `data-contract.md` §3.3. */
export async function GET(_request: Request, context: { params: Promise<{ kode: string }> }) {
  return handle(async () => {
    const user = await requireRole("UMKM")
    const { kode } = await context.params
    const kasus = await requireCaseAccess(kode, user)

    const answers = await readAllAnswers(kasus.id)
    const terakhir = await prisma.assessmentAnswer.aggregate({
      where: { caseId: kasus.id },
      _max: { dijawabPada: true },
    })

    return ok(buildAssessmentState(answers, terakhir._max.dijawabPada?.toISOString() ?? null))
  })
}
