/**
 * Evaluasi percabangan assessment.
 *
 * Sifat adaptif hidup di sini: daftar pertanyaan terlihat dihitung ulang setiap
 * kali satu jawaban berubah. Jawaban milik pertanyaan yang tidak lagi terlihat
 * TIDAK dihapus — hanya ditandai tidak aktif (lihat `assessmentAnswer.aktif`),
 * supaya kalau syaratnya terpenuhi lagi jawaban lama muncul kembali.
 */

import type { AssessmentState, Question } from "@/lib/types"
import {
  ASSESSMENT_VERSION,
  QUESTIONS,
  isEmpty,
  type AnswerMap,
  type ServerQuestion,
} from "./questions"

/** Pertanyaan yang syaratnya terpenuhi, dalam urutan tampil. */
export function visibleQuestions(answers: AnswerMap): ServerQuestion[] {
  return QUESTIONS.filter((question) => !question.condition || question.condition(answers))
}

export function visibleQuestionIds(answers: AnswerMap): string[] {
  return visibleQuestions(answers).map((question) => question.id)
}

/** Buang `condition` — klien tidak pernah melihat predikat percabangan. */
export function toClientQuestion(question: ServerQuestion): Question {
  const { condition: _condition, ...rest } = question
  void _condition
  return rest
}

/**
 * Hanya jawaban milik pertanyaan yang terlihat. Ini yang dipakai mesin
 * readiness — jawaban tidak aktif tidak pernah ikut menghitung apa pun.
 */
export function activeAnswers(answers: AnswerMap): AnswerMap {
  const visible = new Set(visibleQuestionIds(answers))
  const result: AnswerMap = {}
  for (const [id, value] of Object.entries(answers)) {
    if (visible.has(id) && !isEmpty(value)) result[id] = value
  }
  return result
}

/** Pertanyaan wajib yang terlihat tapi belum terjawab. */
export function unansweredRequired(answers: AnswerMap): string[] {
  return visibleQuestions(answers)
    .filter((question) => question.wajib && isEmpty(answers[question.id]))
    .map((question) => question.id)
}

/**
 * Bentuk `AssessmentState` sesuai data-contract §3.3.
 * `disimpanPada` datang dari pemanggil (waktu simpan terakhir di database).
 */
export function buildAssessmentState(answers: AnswerMap, disimpanPada: string | null): AssessmentState {
  const visible = visibleQuestions(answers)
  const jawaban: AnswerMap = {}
  for (const question of visible) {
    const value = answers[question.id]
    if (!isEmpty(value)) jawaban[question.id] = value
  }

  const terjawab = visible.filter((question) => !isEmpty(answers[question.id])).length
  const indeksBerikutnya = visible.findIndex((question) => isEmpty(answers[question.id]))

  return {
    versi: ASSESSMENT_VERSION,
    pertanyaan: visible.map(toClientQuestion),
    jawaban,
    progress: { terjawab, total: visible.length },
    sisaWajib: unansweredRequired(answers).length,
    indeksBerikutnya,
    bolehLihatHasil: unansweredRequired(answers).length === 0,
    disimpanPada,
  }
}
