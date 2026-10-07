"use client";

import {
  CHOICE_TYPES,
  MANUAL_TYPES,
  SCALE_TYPES,
  pairIsComplete,
  pairSideFilled,
  type QuizFormState,
  type QuizQuestion,
} from "@/lib/quiz-builder";

export const LABELS = "ABCDEFGHIJ".split("");

export type SaveState = "idle" | "saving" | "saved" | "error";

export type PreflightItem = {
  title: string;
  status: string;
  withoutClass: boolean;
  classGateWarning: boolean;
  missingAnswerKeys: string[];
  keylessQuestionIds: { order: number; question: string; type: string }[];
  objectiveQuestions: number;
  manualQuestions: number;
  coveragePercent: number;
};

const OBJECTIVE_KEY_TYPES = new Set([
  "PILIHAN_GANDA",
  "MULTI_SELECT",
  "DROPDOWN",
  "BENAR_SALAH",
  "ISIAN_SINGKAT",
  "CLOZE",
  "SKALA",
  "RATING",
  "GRID",
  "TANGGAL",
  "WAKTU",
  "MENJODOHKAN",
  "URUTAN",
]);

const MANUAL_REVIEW_TYPES = new Set(["ESAI", "FILE_UPLOAD", "GAMBAR", "LISTENING", "READING", "SPEAKING", "WRITING", "ROLEPLAY"]);

export function isManualReviewType(type: string) {
  return MANUAL_REVIEW_TYPES.has(type);
}

export function isObjectiveType(type: string) {
  return OBJECTIVE_KEY_TYPES.has(type);
}

/** Konversi state builder ke payload API — identik dengan kontrak `saveQuizFormSchema`. */
export function toPayload(form: QuizFormState) {
  const sectionIndexByKey = new Map(form.sections.map((section, index) => [section.key, index]));

  return {
    ...(form.kelasId.trim() ? { kelasId: form.kelasId } : {}),
    title: form.title,
    description: form.description,
    mode: form.mode,
    deliveryMode: form.deliveryMode,
    durationMinutes: form.durationMinutes,
    maxAttempts: form.maxAttempts,
    shuffleQuestions: form.shuffleQuestions,
    shuffleOptions: form.shuffleOptions,
    passingScore: form.passingScore,
    showScoreImmediately: form.showScoreImmediately,
    showAnswersAfterSubmit: form.showAnswersAfterSubmit,
    collectRespondentName: form.collectRespondentName,
    showResultToWali: form.showResultToWali,
    showResultToSiswa: form.showResultToSiswa,
    secureMode: form.secureMode,
    themeColor: form.themeColor,
    headerImageUrl: form.headerImageUrl,
    confirmationMessage: form.confirmationMessage,
    collectRespondentEmail: form.collectRespondentEmail,
    sendCopyToRespondent: form.sendCopyToRespondent,
    oneResponsePerEmail: form.oneResponsePerEmail,
    notifyGuruOnResponse: form.notifyGuruOnResponse,
    presentationMode: form.presentationMode,
    releaseMode: form.releaseMode,
    examDate: form.examDate,
    availableFrom: form.availableFrom,
    availableUntil: form.availableUntil,
    sections: form.sections.map((section, index) => ({ title: section.title.trim() || `Bagian ${index + 1}`, description: section.description })),
    questions: form.questions.map((question) => ({
      type: question.type,
      question: question.question,
      helpText: question.helpText,
      required: question.required,
      points: question.points,
      allowOther: question.allowOther,
      shuffleOptions: question.shuffleOptions,
      mediaUrl: question.mediaUrl,
      explanation: question.explanation,
      expectedAnswer: question.expectedAnswer,
      scaleMin: question.scaleMin,
      scaleMax: question.scaleMax,
      scaleMinLabel: question.scaleMinLabel,
      scaleMaxLabel: question.scaleMaxLabel,
      gridRows: question.gridRows,
      gridMultiple: question.gridMultiple,
      gridCorrect: question.gridCorrect,
      validationType: question.validationType,
      validationMin: question.validationMin.trim() === "" ? null : Number(question.validationMin),
      validationMax: question.validationMax.trim() === "" ? null : Number(question.validationMax),
      validationPattern: question.validationPattern,
      validationMessage: question.validationMessage,
      acceptedAnswers: question.acceptedAnswers.map((value) => value.trim()).filter(Boolean),
      feedbackCorrect: question.feedbackCorrect,
      feedbackIncorrect: question.feedbackIncorrect,
      uploadAllowedTypes: question.uploadAllowedTypes.map((value) => value.trim()).filter(Boolean),
      uploadMaxSizeMb: question.uploadMaxSizeMb,
      stimulusText: question.stimulusText,
      language: question.language,
      direction: question.direction,
      cognitiveLevel: question.cognitiveLevel,
      skill: question.skill,
      difficulty: question.difficulty,
      standard: question.standard,
      assessmentType: question.assessmentType,
      rubric: question.rubric.map((row) => ({ name: row.name.trim(), max: Number(row.max || 0) })).filter((row) => row.name && row.max > 0),
      pairs: question.pairs.map((pair) => ({ left: pair.left.trim(), right: pair.right.trim(), leftMediaUrl: pair.leftMediaUrl, rightMediaUrl: pair.rightMediaUrl })).filter((pair) => pairIsComplete(pair)),
      sequenceItems: question.sequenceItems.map((item) => item.trim()).filter(Boolean),
      sectionIndex: sectionIndexByKey.get(question.sectionKey) ?? 0,
      branchRules: question.branchRules.map((rule) => ({
        label: rule.label,
        goToSectionIndex: rule.goToSectionKey ? (sectionIndexByKey.get(rule.goToSectionKey) ?? null) : null,
      })),
      options: question.options.map((option, index) => ({ label: LABELS[index], content: option.content, mediaUrl: option.mediaUrl })),
      correctLabels: question.options.map((option, index) => (option.isCorrect ? LABELS[index] : null)).filter(Boolean),
    })),
  };
}

export type GridKeyGap = { order: number; question: string; missingRows: string[] };

/** Verifikasi kunci di sisi klien — mirror dari preflight server, dipakai sebelum "Kirim". */
export function collectClientKeyGaps(form: QuizFormState): { messages: string[]; blocked: boolean } {
  const messages: string[] = [];
  let blocked = false;

  for (const [index, question] of form.questions.entries()) {
    if (!OBJECTIVE_KEY_TYPES.has(question.type)) continue;

    if (question.type === "GRID") {
      const rows = question.gridRows;
      const missingRows = rows
        .map((row, rowIndex) => ({ row, rowIndex }))
        .filter(({ row, rowIndex }) => row.trim() && !question.gridCorrect[rowIndex]?.trim())
        .map(({ row, rowIndex }) => `Baris ${rowIndex + 1} (${row})`);
      if (missingRows.length > 0) {
        messages.push(`Soal ${index + 1} (Grid): pilih kunci kolom untuk ${missingRows.join(", ")}.`);
        blocked = true;
      }
      continue;
    }

    if (CHOICE_TYPES.has(question.type)) {
      if (!question.options.some((option) => option.isCorrect && option.content.trim())) {
        messages.push(`Soal ${index + 1}: tandai jawaban benar.`);
        blocked = true;
      }
      continue;
    }

    if (["BENAR_SALAH", "ISIAN_SINGKAT", "CLOZE", "TANGGAL", "WAKTU", "SKALA", "RATING"].includes(question.type)) {
      if (!question.expectedAnswer.trim() && question.acceptedAnswers.length === 0) {
        messages.push(`Soal ${index + 1}: isi kunci jawaban.`);
        blocked = true;
      }
      continue;
    }

    if (question.type === "MENJODOHKAN" && question.pairs.filter((pair) => pairIsComplete(pair)).length < 2) {
      messages.push(`Soal ${index + 1}: lengkapi minimal dua pasangan menjodohkan.`);
      blocked = true;
    }
    if (question.type === "MENJODOHKAN") {
      for (const [pairIndex, pair] of question.pairs.entries()) {
        const oneSide = pairSideFilled(pair.left, pair.leftMediaUrl) || pairSideFilled(pair.right, pair.rightMediaUrl);
        if (oneSide && !pairIsComplete(pair)) {
          messages.push(`Soal ${index + 1}: pasangan ${pairIndex + 1} harus lengkap di kedua sisi (teks atau gambar).`);
          blocked = true;
          break;
        }
      }
    }

    if (question.type === "URUTAN" && question.sequenceItems.filter((item) => item.trim()).length < 2) {
      messages.push(`Soal ${index + 1}: lengkapi minimal dua item urutan.`);
      blocked = true;
    }
  }

  return { messages, blocked };
}

export function validateForm(form: QuizFormState, published: boolean) {
  if (published && form.title.trim().length < 2) return "Judul formulir wajib diisi.";
  if (published && form.questions.length === 0) return "Minimal satu soal untuk publikasi.";
  if (published && (form.deliveryMode === "ONLINE_VIA_WALI" || form.deliveryMode === "ONLINE_VIA_SISWA" || form.deliveryMode === "BOTH") && !form.kelasId.trim()) {
    return "Pilih kelas untuk mengirim ke wali/siswa (atau ganti mode ke Input guru saja / tautan publik).";
  }

  for (const [index, question] of form.questions.entries()) {
    const number = index + 1;
    if (!question.question.trim()) return `Soal ${number}: pertanyaan wajib diisi.`;
    if (CHOICE_TYPES.has(question.type)) {
      const filled = question.options.filter((option) => option.content.trim());
      if (published && filled.length < 2) return `Soal ${number}: minimal dua opsi jawaban.`;
      const correct = question.options.filter((option) => option.isCorrect && option.content.trim());
      if (published && correct.length === 0) return `Soal ${number}: tandai jawaban benar.`;
      if ((question.type === "PILIHAN_GANDA" || question.type === "DROPDOWN") && correct.length > 1) return `Soal ${number}: hanya boleh satu jawaban benar.`;
    }
    if (SCALE_TYPES.has(question.type)) {
      if (question.scaleMax <= question.scaleMin) return `Soal ${number}: nilai maksimum skala harus lebih besar dari minimum.`;
      const correct = Number(question.expectedAnswer);
      if (published && (!question.expectedAnswer.trim() || Number.isNaN(correct) || correct < question.scaleMin || correct > question.scaleMax)) {
        return `Soal ${number}: pilih jawaban benar pada rentang skala.`;
      }
    }
    if (question.type === "GRID") {
      const rows = question.gridRows.filter((row) => row.trim());
      if (rows.length < 1) return `Soal ${number}: minimal satu baris pernyataan.`;
      if (question.gridRows.some((row) => !row.trim())) return `Soal ${number}: setiap baris harus diisi.`;
      const columns = question.options.filter((option) => option.content.trim());
      if (published && columns.length < 2) return `Soal ${number}: minimal dua kolom pilihan.`;
      if (published) {
        const gap = collectClientKeyGaps(form).messages.find((message) => message.startsWith(`Soal ${number} (Grid)`));
        if (gap) return gap;
      }
    }
    if (published && question.type === "ISIAN_SINGKAT" && !question.expectedAnswer.trim()) return `Soal ${number}: kunci jawaban wajib diisi.`;
    if (published && (question.type === "TANGGAL" || question.type === "WAKTU") && !question.expectedAnswer.trim()) return `Soal ${number}: kunci jawaban wajib diisi.`;
    if (published && question.type === "CLOZE" && !question.expectedAnswer.trim()) return `Soal ${number}: kunci cloze wajib diisi.`;
    if (published && question.type === "MENJODOHKAN" && question.pairs.filter((pair) => pairIsComplete(pair)).length < 2) return `Soal ${number}: minimal dua pasangan jawaban.`;
    if (published && question.type === "URUTAN" && question.sequenceItems.filter((item) => item.trim()).length < 2) return `Soal ${number}: minimal dua item urutan.`;
  }

  if (published) {
    const { messages } = collectClientKeyGaps(form);
    if (messages.length > 0) return messages[0];
  }

  return "";
}

export function questionKeySummary(question: QuizQuestion): string | null {
  if (MANUAL_TYPES.has(question.type)) return "Dinilai manual dengan rubrik";
  if (question.type === "GRID") {
    const filled = question.gridCorrect.filter((value) => value.trim()).length;
    return `${filled}/${question.gridRows.length} baris berkunci`;
  }
  if (question.type === "MENJODOHKAN") {
    const filled = question.pairs.filter((pair) => pairIsComplete(pair)).length;
    return filled > 0 ? `${filled}/${question.pairs.length} pasangan berkunci` : "Kunci belum diatur";
  }
  if (question.type === "URUTAN") {
    const filled = question.sequenceItems.filter((item) => item.trim()).length;
    return filled > 0 ? `${filled} item berkunci` : "Kunci belum diatur";
  }
  if (CHOICE_TYPES.has(question.type)) {
    const correct = question.options.filter((option) => option.isCorrect).length;
    return correct > 0 ? "Kunci terpasang" : "Kunci belum diatur";
  }
  if (question.expectedAnswer.trim() || question.acceptedAnswers.length > 0) return "Kunci terpasang";
  if (OBJECTIVE_KEY_TYPES.has(question.type)) return "Kunci belum diatur";
  return null;
}

const DRAFT_PREFIX = "limo-quiz-draft";

export function saveDraftBackup(key: string, form: QuizFormState) {
  try {
    window.localStorage.setItem(`${DRAFT_PREFIX}:${key}`, JSON.stringify({ savedAt: Date.now(), form }));
  } catch {
    // penyimpanan penuh / private mode — biarkan autosave server yang berjalan
  }
}

export function loadDraftBackup<T>(key: string): { savedAt: number; form: T } | null {
  try {
    const raw = window.localStorage.getItem(`${DRAFT_PREFIX}:${key}`);
    return raw ? (JSON.parse(raw) as { savedAt: number; form: T }) : null;
  } catch {
    return null;
  }
}

export function clearDraftBackup(key: string) {
  try {
    window.localStorage.removeItem(`${DRAFT_PREFIX}:${key}`);
  } catch {
    // abaikan
  }
}
