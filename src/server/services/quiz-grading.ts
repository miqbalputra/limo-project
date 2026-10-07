export const QUIZ_SUBMIT_GRACE_SECONDS = 20;

const CHOICE_BRANCH_TYPES = new Set(["PILIHAN_GANDA", "DROPDOWN", "MULTI_SELECT"]);

export type GradableAnswer = {
  ujianSoalId: string;
  selectedOption?: string | null;
  selectedOptions?: string[] | null;
  shortAnswer?: string | null;
  structuredAnswer?: unknown;
  essayAnswer?: string | null;
};

export type GradableQuestion = {
  id: string;
  required: boolean;
  sectionIndex: number;
  type: string;
  branchRules: { label: string; goToSectionIndex: number | null }[];
};

export function normalizeAnswerText(value: string | null | undefined) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function sortedAnswerLabels(values: string[] | undefined | null) {
  return [...(values || [])].map((value) => value.toUpperCase()).sort();
}

export function jsonValuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export function isAnswerFilled(answer: GradableAnswer | undefined) {
  if (!answer) return false;
  const otherText = answer.shortAnswer?.trim();
  if (answer.selectedOption) return answer.selectedOption === "OTHER" ? Boolean(otherText) : true;
  if (answer.selectedOptions?.length) return answer.selectedOptions.includes("OTHER") ? Boolean(otherText) : true;
  if (answer.structuredAnswer && typeof answer.structuredAnswer === "object") {
    return Object.values(answer.structuredAnswer as Record<string, unknown>).some((value) => (Array.isArray(value) ? value.length > 0 : Boolean(value)));
  }
  return Boolean(otherText || answer.essayAnswer?.trim());
}

export function isTextAnswerAccepted(input: {
  answer: string | null | undefined;
  expectedAnswer: string | null | undefined;
  acceptedAnswers?: unknown;
}) {
  const given = normalizeAnswerText(input.answer);
  if (!given) return false;
  if (input.expectedAnswer && normalizeAnswerText(input.expectedAnswer) === given) return true;

  const alternatives = Array.isArray(input.acceptedAnswers) ? input.acceptedAnswers : [];
  return alternatives.some((value) => typeof value === "string" && normalizeAnswerText(value) === given);
}

export function parseBranchRules(value: unknown) {
  if (!Array.isArray(value)) return [] as GradableQuestion["branchRules"];

  return (value as Array<{ label?: unknown; goToSectionIndex?: unknown }>)
    .filter((rule) => typeof rule.label === "string" && (rule.goToSectionIndex === null || typeof rule.goToSectionIndex === "number"))
    .map((rule) => ({ label: rule.label as string, goToSectionIndex: (rule.goToSectionIndex as number | null) ?? null }));
}

export function isWithinSubmitGrace(expiresAt: Date | null | undefined, now = new Date()) {
  if (!expiresAt) return true;
  return now.getTime() <= expiresAt.getTime() + QUIZ_SUBMIT_GRACE_SECONDS * 1000;
}

export function collectReachableQuestionIds(input: {
  questions: GradableQuestion[];
  answers: Map<string, GradableAnswer>;
  sectionCount: number;
}) {
  const bySection = new Map<number, GradableQuestion[]>();
  for (const question of input.questions) {
    const list = bySection.get(question.sectionIndex) ?? [];
    list.push(question);
    bySection.set(question.sectionIndex, list);
  }

  const reachable = new Set<string>();
  const visited = new Set<number>();
  let current = 0;

  while (current >= 0 && current < input.sectionCount && !visited.has(current)) {
    visited.add(current);
    const questions = bySection.get(current) ?? [];
    for (const question of questions) reachable.add(question.id);

    let next: number | null = null;
    for (const question of questions) {
      if (!CHOICE_BRANCH_TYPES.has(question.type)) continue;
      const answer = input.answers.get(question.id);
      const labels = question.type === "MULTI_SELECT"
        ? (answer?.selectedOptions ?? []).map((value) => value.toUpperCase())
        : [answer?.selectedOption ? answer.selectedOption.toUpperCase() : ""];

      for (const label of labels) {
        if (!label) continue;
        const rule = question.branchRules.find((item) => item.label.toUpperCase() === label);
        if (rule && rule.goToSectionIndex !== null) {
          next = rule.goToSectionIndex;
          break;
        }
      }

      if (next !== null) break;
    }

    current = next ?? current + 1;
  }

  return reachable;
}

export function findMissingRequiredAnswers(input: {
  questions: GradableQuestion[];
  answers: GradableAnswer[];
  sectionCount: number;
}) {
  const answerMap = new Map(input.answers.map((answer) => [answer.ujianSoalId, answer]));
  const reachable = collectReachableQuestionIds({ questions: input.questions, answers: answerMap, sectionCount: input.sectionCount });
  return input.questions.filter((question) => reachable.has(question.id) && question.required && !isAnswerFilled(answerMap.get(question.id)));
}

const SINGLE_CHOICE_TYPES = new Set(["PILIHAN_GANDA", "DROPDOWN", "SKALA", "RATING"]);
const TEXT_ANSWER_TYPES = new Set(["ISIAN_SINGKAT", "CLOZE", "TANGGAL", "WAKTU"]);
const PAIRING_TYPES = new Set(["MENJODOHKAN", "URUTAN"]);

const MANUAL_REVIEW_TYPES = new Set(["ESAI", "FILE_UPLOAD", "GAMBAR", "LISTENING", "READING", "SPEAKING", "WRITING", "ROLEPLAY"]);

export function isManualReviewType(type: string) {
  return MANUAL_REVIEW_TYPES.has(type);
}

function roundFraction(numerator: number, denominator: number, weight: number) {
  if (denominator <= 0) return 0;
  return Number(((Math.max(0, numerator) / denominator) * weight).toFixed(2));
}

/**
 * Penilaian objektif terpusat untuk semua jalur (publik, wali, input guru, halaman hasil).
 * `score: null` berarti soal tidak dapat dinilai otomatis (jawaban manual / opsi "Lainnya" / kunci belum ada).
 * Tipe multi-select, GRID, menjodohkan, dan urutan memberi poin parsial proporsional;
 * `correct: true` hanya saat skor penuh.
 */
export function gradeObjectiveAnswer(input: {
  type: string;
  weight: number;
  correctLabels: string[];
  expectedAnswer: string | null;
  acceptedAnswers: unknown;
  structuredPayload: unknown;
  answer: GradableAnswer | undefined;
}): { score: number | null; correct: boolean | null } {
  const { type, weight, answer } = input;

  if (SINGLE_CHOICE_TYPES.has(type)) {
    const selected = answer?.selectedOption?.toUpperCase() || "";
    if (selected === "OTHER") return { score: null, correct: null };
    if (input.correctLabels.length === 0) {
      // Kunci berbasis expectedAnswer (skala/rating tanpa opsi bertanda benar)
      if (input.expectedAnswer && input.expectedAnswer.trim()) {
        const fallback = (answer?.selectedOption ?? answer?.shortAnswer ?? "").toUpperCase();
        const score = fallback && normalizeAnswerText(fallback) === normalizeAnswerText(input.expectedAnswer) ? weight : 0;
        return { score, correct: score > 0 };
      }
      return { score: null, correct: null };
    }
    const score = selected && input.correctLabels[0] === selected ? weight : 0;
    return { score, correct: score > 0 };
  }

  if (type === "MULTI_SELECT") {
    const key = input.correctLabels;
    if (key.length === 0) return { score: null, correct: null };
    const raw = (answer?.selectedOptions ?? []).map((label) => label.toUpperCase());
    if (raw.includes("OTHER")) return { score: null, correct: null };
    const selected = sortedAnswerLabels(answer?.selectedOptions);
    if (selected.length === 0) return { score: 0, correct: false };
    const correctPicks = selected.filter((label) => key.includes(label)).length;
    const wrongPicks = selected.filter((label) => !key.includes(label)).length;
    const score = jsonValuesEqual(selected, key) ? weight : roundFraction(correctPicks - wrongPicks, key.length, weight);
    return { score, correct: score === weight };
  }

  if (type === "BENAR_SALAH") {
    if (!input.expectedAnswer || !input.expectedAnswer.trim()) return { score: null, correct: null };
    const score = normalizeAnswerText(answer?.selectedOption) === normalizeAnswerText(input.expectedAnswer) ? weight : 0;
    return { score, correct: score > 0 };
  }

  if (TEXT_ANSWER_TYPES.has(type)) {
    const hasKey = Boolean(input.expectedAnswer && input.expectedAnswer.trim())
      || (Array.isArray(input.acceptedAnswers) && input.acceptedAnswers.some((value) => typeof value === "string" && value.trim().length > 0));
    if (!hasKey) return { score: null, correct: null };
    const score = isTextAnswerAccepted({ answer: answer?.shortAnswer, expectedAnswer: input.expectedAnswer, acceptedAnswers: input.acceptedAnswers }) ? weight : 0;
    return { score, correct: score > 0 };
  }

  if (type === "GRID") {
    const payload = (input.structuredPayload ?? null) as { rows?: string[]; correct?: Record<string, string> } | null;
    const rows = Array.isArray(payload?.rows) ? payload!.rows : [];
    const keyMap = payload?.correct ?? {};
    if (rows.length === 0) return { score: null, correct: null };
    // Semua baris wajib berkunci; publish blokir bila ada baris tanpa kunci (assertQuizAnswerKeys).
    if (!rows.every((_, index) => Boolean((keyMap[String(index)] || "").trim()))) return { score: null, correct: null };

    const given = (answer?.structuredAnswer ?? null) as Record<string, unknown> | null;
    let rowsCorrect = 0;
    for (let index = 0; index < rows.length; index += 1) {
      const raw = given ? given[String(index)] : undefined;
      const expected = (keyMap[String(index)] || "").toUpperCase();
      const selected = Array.isArray(raw)
        ? raw.map((value) => String(value).toUpperCase()).sort()
        : raw
          ? [String(raw).toUpperCase()]
          : [];
      if (jsonValuesEqual(selected, [expected])) rowsCorrect += 1;
    }

    const score = rowsCorrect === rows.length ? weight : roundFraction(rowsCorrect, rows.length, weight);
    return { score, correct: rowsCorrect === rows.length };
  }

  if (PAIRING_TYPES.has(type)) {
    const payload = (input.structuredPayload ?? null) as { answerKey?: unknown; pairs?: unknown[]; items?: unknown[] } | null;
    const answerKey = payload?.answerKey;
    if (answerKey === undefined || answerKey === null) return { score: null, correct: null };

    if (type === "URUTAN") {
      const items = Array.isArray(answerKey) ? answerKey : [];
      if (items.length === 0) return { score: null, correct: null };
      const given = Array.isArray(answer?.structuredAnswer) ? (answer!.structuredAnswer as unknown[]) : [];
      let positionsCorrect = 0;
      for (let index = 0; index < items.length; index += 1) {
        if (jsonValuesEqual(given[index], items[index])) positionsCorrect += 1;
      }
      const score = positionsCorrect === items.length ? weight : roundFraction(positionsCorrect, items.length, weight);
      return { score, correct: positionsCorrect === items.length };
    }

    const pairs = Object.entries(answerKey as Record<string, unknown>);
    if (pairs.length === 0) return { score: null, correct: null };
    const given = (answer?.structuredAnswer ?? null) as Record<string, unknown> | null;
    let matched = 0;
    for (const [left, right] of pairs) {
      if (given && jsonValuesEqual(given[left], right)) matched += 1;
    }
    const score = matched === pairs.length ? weight : roundFraction(matched, pairs.length, weight);
    return { score, correct: matched === pairs.length };
  }

  return { score: null, correct: null };
}

export function resolveFeedbackText(input: {
  correct: boolean | null;
  feedbackCorrect: string | null | undefined;
  feedbackIncorrect: string | null | undefined;
}) {
  if (input.correct === true) return input.feedbackCorrect || null;
  if (input.correct === false) return input.feedbackIncorrect || null;
  return null;
}

export type QuizFileUploadConfig = { allowedTypes: string[]; maxSizeMb: number };
export function readFileUploadConfig(value: unknown): QuizFileUploadConfig {
  const parsed = value && typeof value === "object" ? (value as { allowedTypes?: unknown; maxSizeMb?: unknown }) : {};
  const allowedTypes = Array.isArray(parsed.allowedTypes)
    ? parsed.allowedTypes.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim().toLowerCase())
    : [];
  const maxSizeMb = typeof parsed.maxSizeMb === "number" && Number.isFinite(parsed.maxSizeMb) && parsed.maxSizeMb > 0
    ? Math.min(parsed.maxSizeMb, 200)
    : 0;

  return { allowedTypes, maxSizeMb };
}

export type AnswerValidation = { type?: string; min?: number | null; max?: number | null; pattern?: string | null; message?: string | null };

/**
 * Validasi jawaban ala Google Forms: angka (rentang), panjang teks, pola regex,
 * dan jumlah pilihan untuk kotak centang.
 */
export function answerValidationProblem(input: { validation: AnswerValidation | null | undefined; answer: GradableAnswer | undefined }) {
  const config = input.validation;
  if (!config?.type || config.type === "NONE") return null;

  if (config.type === "CHECKBOX") {
    const count = (input.answer?.selectedOptions ?? []).filter((label) => label !== "OTHER").length;
    if (config.min !== null && config.min !== undefined && count < config.min) return `pilih minimal ${config.min} opsi`;
    if (config.max !== null && config.max !== undefined && count > config.max) return `pilih maksimal ${config.max} opsi`;
    return null;
  }

  const value = input.answer?.shortAnswer?.trim() ?? "";
  if (!value) return null;

  if (config.type === "NUMBER") {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return "harus berupa angka";
    if (config.min !== null && config.min !== undefined && numeric < config.min) return `nilai minimal ${config.min}`;
    if (config.max !== null && config.max !== undefined && numeric > config.max) return `nilai maksimal ${config.max}`;
  }

  if (config.type === "LENGTH") {
    if (config.min !== null && config.min !== undefined && value.length < config.min) return `minimal ${config.min} karakter`;
    if (config.max !== null && config.max !== undefined && value.length > config.max) return `maksimal ${config.max} karakter`;
  }

  if (config.type === "TEXT" && config.pattern) {
    try {
      if (!new RegExp(config.pattern).test(value)) return config.message || "format jawaban tidak sesuai";
    } catch {
      return null;
    }
  }

  return null;
}


