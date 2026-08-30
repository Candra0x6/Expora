-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('UMKM', 'PETUGAS');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('DRAFT', 'MENUNGGU_TINJAUAN', 'MENUNGGU_UMKM', 'ESKALASI', 'RENCANA_TERKIRIM', 'SELESAI');

-- CreateEnum
CREATE TYPE "DimensionStatus" AS ENUM ('ready', 'pending', 'working', 'officer', 'blocked', 'idle');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TaskOwner" AS ENUM ('UMKM', 'PETUGAS', 'UMKM_DAN_PENDAMPING');

-- CreateEnum
CREATE TYPE "RecommendationSource" AS ENUM ('AI', 'OFFICER');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('rendah', 'sedang', 'tinggi');

-- CreateEnum
CREATE TYPE "InfoRequestStatus" AS ENUM ('TERBUKA', 'DIJAWAB');

-- CreateEnum
CREATE TYPE "CaseEventType" AS ENUM ('KASUS_DIBUAT', 'ASSESSMENT_SELESAI', 'DIKIRIM_TINJAUAN', 'DRAFT_AI_DIBUAT', 'CATATAN_PETUGAS', 'INFO_DIMINTA', 'INFO_DIJAWAB', 'REKOMENDASI_DIEDIT', 'KASUS_DIESKALASI', 'RENCANA_DIKIRIM', 'TUGAS_SELESAI', 'BUKTI_DIUNGGAH');

-- CreateTable
CREATE TABLE "profile" (
    "id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "nama_lengkap" TEXT NOT NULL,
    "telepon" TEXT,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "nama" TEXT NOT NULL,
    "bentuk_legal" TEXT,
    "usia_tahun" INTEGER,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case" (
    "id" UUID NOT NULL,
    "kode" TEXT NOT NULL,
    "business_id" UUID NOT NULL,
    "produk" TEXT NOT NULL,
    "tujuan" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'DRAFT',
    "tahap" TEXT NOT NULL DEFAULT 'Persiapan dasar',
    "versi_assessment" TEXT NOT NULL DEFAULT 'v1.0',
    "target_ekspor" DATE,
    "dikirim_pada" TIMESTAMP(3),
    "ditinjau_oleh_id" UUID,
    "ditinjau_pada" TIMESTAMP(3),
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diperbarui_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_answer" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "question_id" TEXT NOT NULL,
    "dimensi" TEXT NOT NULL,
    "nilai" JSONB NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "dijawab_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "readiness_dimension" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "dimensi" TEXT NOT NULL,
    "status" "DimensionStatus" NOT NULL,
    "alasan" TEXT NOT NULL,
    "fakta" TEXT[],
    "belum_ada" TEXT NOT NULL,
    "dihitung_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "readiness_dimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "versi" TEXT NOT NULL,
    "sumber" "RecommendationSource" NOT NULL,
    "isi" TEXT NOT NULL,
    "ringkasan" TEXT NOT NULL,
    "tahap" TEXT NOT NULL,
    "tahap_penjelasan" TEXT NOT NULL,
    "keyakinan" "Confidence" NOT NULL,
    "alasan_review" TEXT NOT NULL,
    "alasan_perubahan" TEXT,
    "ringkasan_petugas" TEXT,
    "dibuat_oleh_id" UUID,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rec_fact" (
    "id" UUID NOT NULL,
    "recommendation_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "nilai" TEXT NOT NULL,
    "asal" TEXT NOT NULL,
    "dikonfirmasi" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "rec_fact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rec_unknown" (
    "id" UUID NOT NULL,
    "recommendation_id" UUID NOT NULL,
    "teks" TEXT NOT NULL,
    "dimensi_terkait" TEXT[],

    CONSTRAINT "rec_unknown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rec_source" (
    "id" UUID NOT NULL,
    "recommendation_id" UUID NOT NULL,
    "judul" TEXT NOT NULL,
    "penerbit" TEXT NOT NULL,
    "tahun" INTEGER NOT NULL,
    "mendukung" TEXT NOT NULL,
    "url" TEXT,

    CONSTRAINT "rec_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "recommendation_id" UUID,
    "urutan" INTEGER NOT NULL,
    "dimensi" TEXT,
    "judul" TEXT NOT NULL,
    "penjelasan" TEXT NOT NULL,
    "owner" "TaskOwner" NOT NULL,
    "bukti_dibutuhkan" TEXT NOT NULL,
    "target_selesai" DATE,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "versi" TEXT NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selesai_pada" TIMESTAMP(3),

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "info_request" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "officer_id" UUID NOT NULL,
    "dimensi" TEXT,
    "judul" TEXT NOT NULL,
    "pesan" TEXT NOT NULL,
    "status" "InfoRequestStatus" NOT NULL DEFAULT 'TERBUKA',
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dijawab_pada" TIMESTAMP(3),

    CONSTRAINT "info_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "info_response" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "pesan" TEXT NOT NULL,
    "oleh_id" UUID NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "info_response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "task_id" UUID,
    "info_response_id" UUID,
    "nama_berkas" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "tipe" TEXT NOT NULL,
    "ukuran_bytes" INTEGER NOT NULL,
    "dikonfirmasi" BOOLEAN NOT NULL DEFAULT false,
    "diunggah_oleh_id" UUID NOT NULL,
    "diunggah_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "officer_note" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "officer_id" UUID NOT NULL,
    "dimensi" TEXT,
    "isi" TEXT NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "officer_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "officer_id" UUID NOT NULL,
    "kategori" TEXT NOT NULL,
    "alasan" TEXT NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_event" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "tipe" "CaseEventType" NOT NULL,
    "judul" TEXT NOT NULL,
    "aktor_id" UUID,
    "aktor_label" TEXT NOT NULL,
    "peran_aktor" TEXT NOT NULL DEFAULT 'SISTEM',
    "ringkasan" TEXT NOT NULL,
    "versi" TEXT,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_owner_id_idx" ON "business"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_kode_key" ON "case"("kode");

-- CreateIndex
CREATE INDEX "case_status_idx" ON "case"("status");

-- CreateIndex
CREATE INDEX "case_business_id_idx" ON "case"("business_id");

-- CreateIndex
CREATE INDEX "case_kode_idx" ON "case"("kode");

-- CreateIndex
CREATE INDEX "assessment_answer_case_id_idx" ON "assessment_answer"("case_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_answer_case_id_question_id_key" ON "assessment_answer"("case_id", "question_id");

-- CreateIndex
CREATE INDEX "readiness_dimension_case_id_idx" ON "readiness_dimension"("case_id");

-- CreateIndex
CREATE UNIQUE INDEX "readiness_dimension_case_id_dimensi_key" ON "readiness_dimension"("case_id", "dimensi");

-- CreateIndex
CREATE INDEX "recommendation_case_id_idx" ON "recommendation"("case_id");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_case_id_versi_key" ON "recommendation"("case_id", "versi");

-- CreateIndex
CREATE INDEX "rec_fact_recommendation_id_idx" ON "rec_fact"("recommendation_id");

-- CreateIndex
CREATE INDEX "rec_unknown_recommendation_id_idx" ON "rec_unknown"("recommendation_id");

-- CreateIndex
CREATE INDEX "rec_source_recommendation_id_idx" ON "rec_source"("recommendation_id");

-- CreateIndex
CREATE INDEX "task_case_id_idx" ON "task"("case_id");

-- CreateIndex
CREATE INDEX "info_request_case_id_idx" ON "info_request"("case_id");

-- CreateIndex
CREATE UNIQUE INDEX "info_response_request_id_key" ON "info_response"("request_id");

-- CreateIndex
CREATE INDEX "evidence_case_id_idx" ON "evidence"("case_id");

-- CreateIndex
CREATE INDEX "evidence_task_id_idx" ON "evidence"("task_id");

-- CreateIndex
CREATE INDEX "evidence_info_response_id_idx" ON "evidence"("info_response_id");

-- CreateIndex
CREATE INDEX "officer_note_case_id_idx" ON "officer_note"("case_id");

-- CreateIndex
CREATE INDEX "escalation_case_id_idx" ON "escalation"("case_id");

-- CreateIndex
CREATE INDEX "case_event_case_id_pada_idx" ON "case_event"("case_id", "pada");

-- AddForeignKey
ALTER TABLE "business" ADD CONSTRAINT "business_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case" ADD CONSTRAINT "case_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case" ADD CONSTRAINT "case_ditinjau_oleh_id_fkey" FOREIGN KEY ("ditinjau_oleh_id") REFERENCES "profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_answer" ADD CONSTRAINT "assessment_answer_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "readiness_dimension" ADD CONSTRAINT "readiness_dimension_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_dibuat_oleh_id_fkey" FOREIGN KEY ("dibuat_oleh_id") REFERENCES "profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rec_fact" ADD CONSTRAINT "rec_fact_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rec_unknown" ADD CONSTRAINT "rec_unknown_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rec_source" ADD CONSTRAINT "rec_source_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "recommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "info_request" ADD CONSTRAINT "info_request_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "info_request" ADD CONSTRAINT "info_request_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "info_response" ADD CONSTRAINT "info_response_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "info_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "info_response" ADD CONSTRAINT "info_response_oleh_id_fkey" FOREIGN KEY ("oleh_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_info_response_id_fkey" FOREIGN KEY ("info_response_id") REFERENCES "info_response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_diunggah_oleh_id_fkey" FOREIGN KEY ("diunggah_oleh_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "officer_note" ADD CONSTRAINT "officer_note_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "officer_note" ADD CONSTRAINT "officer_note_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation" ADD CONSTRAINT "escalation_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation" ADD CONSTRAINT "escalation_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_event" ADD CONSTRAINT "case_event_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_event" ADD CONSTRAINT "case_event_aktor_id_fkey" FOREIGN KEY ("aktor_id") REFERENCES "profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

