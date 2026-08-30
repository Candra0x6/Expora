import { z } from "zod"
import type { CaseStatus } from "@/lib/types"
import { prisma } from "@/lib/server/db"
import { requireRole } from "@/lib/server/auth"
import { requireTransition } from "@/lib/server/case-state"
import { recordEvent } from "@/lib/server/events"
import { ApiError, handle, ok, parseJson, tidakDitemukan } from "@/lib/server/response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const Body = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "READY_FOR_REVIEW", "COMPLETED"]),
})

/**
 * PATCH /api/tugas/[id] — `data-contract.md` §3.7.
 * `403` kalau `owner = PETUGAS`. Kalau ini tugas terakhir yang tuntas, kasus → `SELESAI`.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireRole("UMKM")
    const { id } = await context.params

    const task = await prisma.task.findUnique({
      where: { id },
      include: { case: { select: { id: true, status: true, businessId: true } } },
    })
    if (!task || !user.businessIds.includes(task.case.businessId)) {
      throw tidakDitemukan("Tugas tidak ditemukan.")
    }
    if (task.owner === "PETUGAS") {
      throw new ApiError("AKSES_DITOLAK", "Tugas ini dikerjakan petugas.")
    }
    const body = await parseJson(request, Body)

    const now = new Date()
    await prisma.task.update({
      where: { id },
      data: { status: body.status, selesaiPada: body.status === "COMPLETED" ? now : null },
    })

    let statusKasus = task.case.status as CaseStatus
    if (body.status === "COMPLETED") {
      const belumSelesai = await prisma.task.count({
        where: { caseId: task.case.id, status: { not: "COMPLETED" } },
      })
      if (belumSelesai === 0) {
        statusKasus = requireTransition(task.case.status as CaseStatus, "TUGAS_TERAKHIR_SELESAI", "UMKM")
        await prisma.case.update({ where: { id: task.case.id }, data: { status: statusKasus } })
      }
      await recordEvent(prisma, {
        caseId: task.case.id,
        tipe: "TUGAS_SELESAI",
        ringkasan:
          belumSelesai === 0
            ? `Tugas "${task.judul}" selesai — semua tugas rencana sudah tuntas.`
            : `Tugas "${task.judul}" ditandai selesai.`,
        aktorId: user.id,
        aktorLabel: user.usaha?.nama ?? user.namaLengkap,
        peranAktor: "UMKM",
        pada: now,
      })
    }

    return ok({ status: body.status, statusKasus })
  })
}
