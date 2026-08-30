/**
 * Seed database — `docs/user-flow.md` §8, `docs/handoff-backend.md` §3.5.
 *
 * Jalankan lewat `pnpm exec prisma db seed` (bukan `tsx prisma/seed.ts`
 * langsung) — perintah itu yang memuat `web/.env` sebelum skrip ini jalan,
 * jadi variabel Supabase & database sudah terisi.
 *
 * Idempoten: akun dicari lewat email, kasus dicari lewat kode. Menjalankan
 * dua kali tidak menggandakan apa pun — hanya melengkapi yang belum ada.
 *
 * `LE-0248` dibiarkan `DRAFT` (demo dimulai dari sana, §9). `KA-0172` dan
 * `BS-0311` dijalankan lewat mesin aturan SUNGGUHAN (bukan ditulis tangan)
 * supaya status enam dimensi & draft AI-nya konsisten dengan jawabannya.
 */

import type { Prisma } from "@prisma/client"
import { prisma } from "../lib/server/db"
import { supabaseAdmin } from "../lib/supabase/admin"
import { pastikanBucket } from "../lib/server/storage"
import { computeAndPersist, nextVersion } from "../lib/server/readiness-service"
import { generateDraft } from "../lib/server/ai/draft"
import { recordEvent } from "../lib/server/events"
import { QUESTION_BY_ID } from "../lib/server/engine/questions"
import { SEED_ACCOUNTS, SEED_CASES, SEED_PASSWORD, type SeedAccount, type SeedCase } from "../lib/server/seed-data"

async function findAuthUserByEmail(email: string) {
  const admin = supabaseAdmin()
  const perPage = 200
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (found) return found
    if (data.users.length < perPage) return null
  }
}

async function ensureAuthUser(account: SeedAccount): Promise<string> {
  const existing = await findAuthUserByEmail(account.email)
  if (existing) return existing.id

  const { data, error } = await supabaseAdmin().auth.admin.createUser({
    email: account.email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { role: account.role, namaLengkap: account.namaLengkap },
  })
  if (error || !data.user) throw error ?? new Error(`Gagal membuat akun ${account.email}`)
  console.log(`  akun dibuat: ${account.email}`)
  return data.user.id
}

async function ensureProfile(account: SeedAccount, authId: string): Promise<string | null> {
  await prisma.profile.upsert({
    where: { id: authId },
    create: { id: authId, role: account.role, namaLengkap: account.namaLengkap },
    update: {},
  })

  if (account.role === "PETUGAS") return null

  const existing = await prisma.business.findFirst({ where: { ownerId: authId } })
  if (existing) return existing.id

  const business = await prisma.business.create({
    data: {
      ownerId: authId,
      nama: account.namaUsaha!,
      bentukLegal: account.bentukLegal,
      usiaTahun: account.usiaTahun,
    },
  })
  return business.id
}

async function ensureCase(seedCase: SeedCase, businessId: string, petugasId: string): Promise<void> {
  const sudahAda = await prisma.case.findUnique({ where: { kode: seedCase.kode } })
  if (sudahAda) {
    console.log(`  kasus sudah ada, dilewati: ${seedCase.kode}`)
    return
  }

  const dikirimPada =
    seedCase.dikirimHariLalu !== null ? new Date(Date.now() - seedCase.dikirimHariLalu * 86_400_000) : null

  const kasus = await prisma.case.create({
    data: {
      kode: seedCase.kode,
      businessId,
      produk: seedCase.produk,
      tujuan: seedCase.tujuan,
      status: "DRAFT",
      targetEkspor: seedCase.targetEkspor ? new Date(seedCase.targetEkspor) : null,
    },
  })

  await prisma.assessmentAnswer.createMany({
    data: Object.entries(seedCase.jawaban).map(([questionId, nilai]) => ({
      caseId: kasus.id,
      questionId,
      dimensi: QUESTION_BY_ID[questionId]?.dimensi ?? "produk",
      nilai: nilai as Prisma.InputJsonValue,
    })),
  })

  await recordEvent(prisma, {
    caseId: kasus.id,
    tipe: "KASUS_DIBUAT",
    ringkasan: "Assessment dimulai.",
    peranAktor: "SISTEM",
  })

  const computed = await computeAndPersist(kasus.id)

  if (seedCase.status === "DRAFT") {
    console.log(`  kasus dibuat (DRAFT): ${seedCase.kode}`)
    return
  }

  await prisma.case.update({ where: { id: kasus.id }, data: { dikirimPada } })
  await recordEvent(prisma, {
    caseId: kasus.id,
    tipe: "DIKIRIM_TINJAUAN",
    ringkasan: "Kasus dikirim untuk ditinjau petugas.",
    peranAktor: "SISTEM",
    pada: dikirimPada ?? undefined,
  })

  const draft = await generateDraft(computed.answers, computed.statuses, computed.actions, {
    namaUsaha: (await prisma.business.findUnique({ where: { id: businessId } }))!.nama,
    produk: seedCase.produk,
    tujuan: seedCase.tujuan,
  })
  const versi = await nextVersion(kasus.id, "AI")
  await prisma.recommendation.create({
    data: {
      caseId: kasus.id,
      versi,
      sumber: "AI",
      isi: draft.isi,
      ringkasan: draft.ringkasan,
      tahap: draft.tahap,
      tahapPenjelasan: draft.tahapPenjelasan,
      keyakinan: draft.keyakinan,
      alasanReview: draft.alasanReview,
      fakta: { create: draft.fakta.map((f) => ({ label: f.label, nilai: f.nilai, asal: f.asal, dikonfirmasi: f.dikonfirmasi })) },
      belumDiketahui: { create: draft.belumDiketahui.map((u) => ({ teks: u.teks, dimensiTerkait: u.dimensiTerkait })) },
      sumberReferensi: {
        create: draft.sumberReferensi.map((s) => ({ judul: s.judul, penerbit: s.penerbit, tahun: s.tahun, mendukung: s.mendukung, url: s.url })),
      },
    },
  })
  await recordEvent(prisma, {
    caseId: kasus.id,
    tipe: "DRAFT_AI_DIBUAT",
    ringkasan: "Draft rekomendasi AI dibuat, menunggu tinjauan petugas.",
    peranAktor: "SISTEM",
    versi,
  })

  await prisma.case.update({ where: { id: kasus.id }, data: { status: seedCase.status } })

  if (seedCase.status === "ESKALASI") {
    const petugas = await prisma.profile.findUniqueOrThrow({ where: { id: petugasId } })
    const alasan = "Dokumen ekspor belum lengkap dan PEB belum pernah diurus; perlu pendampingan langsung."
    await prisma.escalation.create({ data: { caseId: kasus.id, officerId: petugasId, kategori: "dokumen", alasan } })
    await recordEvent(prisma, {
      caseId: kasus.id,
      tipe: "KASUS_DIESKALASI",
      ringkasan: alasan,
      aktorId: petugasId,
      aktorLabel: petugas.namaLengkap,
      peranAktor: "PETUGAS",
    })
  }

  console.log(`  kasus dibuat (${seedCase.status}): ${seedCase.kode}`)
}

async function main() {
  console.log("Seed JalurEkspor — memastikan bucket Supabase Storage...")
  await pastikanBucket()

  console.log("Akun...")
  const businessByOwner = new Map<SeedAccount["key"], string>()
  let petugasId = ""
  for (const account of SEED_ACCOUNTS) {
    const authId = await ensureAuthUser(account)
    const businessId = await ensureProfile(account, authId)
    if (account.role === "PETUGAS") petugasId = authId
    if (businessId) businessByOwner.set(account.key, businessId)
  }

  console.log("Kasus...")
  for (const seedCase of SEED_CASES) {
    const businessId = businessByOwner.get(seedCase.ownerKey)
    if (!businessId) throw new Error(`Business untuk owner "${seedCase.ownerKey}" tidak ditemukan.`)
    await ensureCase(seedCase, businessId, petugasId)
  }

  console.log("Selesai.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
