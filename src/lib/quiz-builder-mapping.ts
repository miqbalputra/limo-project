import type { QuizFormState, QuizQuestion, QuizRubricRow } from "@/lib/quiz-builder";

export type QuizFormQuestionDto = {
  id: string;
  type: string;
  question: string;
  helpText: string | null;
  explanation: string | null;
  expectedAnswer: string | null;
  required: boolean;
  points: number;
  mediaUrl: string | null;
  allowOther: boolean;
  shuffleOptions: boolean;
  sectionIndex: number;
  branchRules: unknown;
  scaleMin: number;
  scaleMax: number;
  scaleMinLabel: string;
  scaleMaxLabel: string;
  gridRows: string[];
  gridMultiple: boolean;
  gridCorrect: string[];
  validationType: string | null;
  validationMin: number | null;
  validationMax: number | null;
  validationPattern: string;
  validationMessage: string;
  acceptedAnswers: string[];
  feedbackCorrect: string;
  feedbackIncorrect: string;
  uploadAllowedTypes: string[];
  uploadMaxSizeMb: number;
  stimulusText: string;
  language: string;
  direction: string;
  cognitiveLevel: string;
  skill: string;
  difficulty: string;
  standard: string;
  assessmentType: string;
  rubric: QuizRubricRow[];
  pairs: Array<{ left: string; right: string }>;
  sequenceItems: string[];
  options: Array<{ label: string; content: string; mediaUrl: string | null }>;
  correctLabels: string[];
};

export type QuizFormDto = {
  id: string;
  kelasId: string | null;
  title: string;
  description: string | null;
  mode: string;
  deliveryMode: string;
  durationMinutes: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  passingScore: number | string | null;
  showScoreImmediately: boolean;
  showAnswersAfterSubmit: boolean;
  collectRespondentName: boolean;
  showResultToWali: boolean;
  showResultToSiswa: boolean | null;
  secureMode: boolean | null;
  themeColor: string | null;
  headerImageUrl: string | null;
  confirmationMessage: string | null;
  collectRespondentEmail: boolean | null;
  sendCopyToRespondent: boolean | null;
  oneResponsePerEmail: boolean | null;
  notifyGuruOnResponse: boolean | null;
  presentationMode: string | null;
  releaseMode: string | null;
  examDate: string | null;
  availableFrom: string | null;
  availableUntil: string | null;
  sections: Array<{ title: string; description: string | null }>;
  questions: QuizFormQuestionDto[];
};

const OPTION_TYPES = new Set(["PILIHAN_GANDA", "MULTI_SELECT", "DROPDOWN", "SKALA", "RATING", "GRID"]);

export function toQuizFormState(item: QuizFormDto): QuizFormState {
  const sectionKeys = item.sections.map((_, index) => `s-${item.id}-${index}`);
  if (sectionKeys.length === 0) sectionKeys.push(`s-${item.id}-0`);

  return {
    kelasId: item.kelasId ?? "",
    title: item.title,
    description: item.description ?? "",
    mode: item.mode,
    deliveryMode: item.deliveryMode,
    durationMinutes: item.durationMinutes,
    maxAttempts: item.maxAttempts,
    shuffleQuestions: item.shuffleQuestions,
    shuffleOptions: item.shuffleOptions,
    passingScore: item.passingScore === null || item.passingScore === undefined ? "" : String(item.passingScore),
    showScoreImmediately: item.showScoreImmediately,
    showAnswersAfterSubmit: item.showAnswersAfterSubmit,
    collectRespondentName: item.collectRespondentName,
    showResultToWali: item.showResultToWali,
    showResultToSiswa: item.showResultToSiswa ?? true,
    secureMode: item.secureMode ?? false,
    themeColor: item.themeColor ?? "blue",
    headerImageUrl: item.headerImageUrl ?? "",
    confirmationMessage: item.confirmationMessage ?? "",
    collectRespondentEmail: item.collectRespondentEmail ?? false,
    sendCopyToRespondent: item.sendCopyToRespondent ?? false,
    oneResponsePerEmail: item.oneResponsePerEmail ?? false,
    notifyGuruOnResponse: item.notifyGuruOnResponse ?? false,
    presentationMode: item.presentationMode ?? "ALL",
    releaseMode: item.releaseMode ?? "IMMEDIATE",
    examDate: item.examDate ?? "",
    availableFrom: item.availableFrom ?? "",
    availableUntil: item.availableUntil ?? "",
    sections: item.sections.length > 0
      ? item.sections.map((section, index) => ({ key: sectionKeys[index], title: section.title, description: section.description ?? "" }))
      : [{ key: sectionKeys[0], title: "Bagian 1", description: "" }],
    questions: item.questions.map((question) => toQuizQuestion(question, sectionKeys)),
  };
}

function toQuizQuestion(question: QuizFormQuestionDto, sectionKeys: string[]): QuizQuestion {
  const branchRules = Array.isArray(question.branchRules)
    ? (question.branchRules as Array<{ label: string; goToSectionIndex: number | null }>).map((rule) => ({
        label: rule.label,
        goToSectionKey: rule.goToSectionIndex !== null ? (sectionKeys[rule.goToSectionIndex] ?? null) : null,
      }))
    : [];

  return {
    key: `q-${question.id}`,
    type: question.type,
    question: question.question,
    helpText: question.helpText ?? "",
    required: question.required,
    points: question.points,
    allowOther: question.allowOther,
    shuffleOptions: question.shuffleOptions,
    mediaUrl: question.mediaUrl ?? "",
    explanation: question.explanation ?? "",
    expectedAnswer: question.expectedAnswer ?? (question.type === "BENAR_SALAH" ? "benar" : ""),
    sectionKey: sectionKeys[question.sectionIndex] ?? sectionKeys[0],
    branchRules,
    scaleMin: question.scaleMin,
    scaleMax: question.scaleMax,
    scaleMinLabel: question.scaleMinLabel,
    scaleMaxLabel: question.scaleMaxLabel,
    gridRows: question.gridRows,
    gridMultiple: question.gridMultiple,
    gridCorrect: question.gridCorrect,
    validationType: question.validationType ?? "NONE",
    validationMin: question.validationMin === null || question.validationMin === undefined ? "" : String(question.validationMin),
    validationMax: question.validationMax === null || question.validationMax === undefined ? "" : String(question.validationMax),
    validationPattern: question.validationPattern ?? "",
    validationMessage: question.validationMessage ?? "",
    acceptedAnswers: question.acceptedAnswers ?? [],
    feedbackCorrect: question.feedbackCorrect ?? "",
    feedbackIncorrect: question.feedbackIncorrect ?? "",
    uploadAllowedTypes: question.uploadAllowedTypes ?? [],
    uploadMaxSizeMb: question.uploadMaxSizeMb ?? 0,
    options: OPTION_TYPES.has(question.type)
      ? question.options.map((option) => ({ content: option.content, isCorrect: question.correctLabels.includes(option.label), mediaUrl: option.mediaUrl ?? "" }))
      : [],
    stimulusText: question.stimulusText ?? "",
    language: question.language ?? "",
    direction: question.direction ?? "",
    cognitiveLevel: question.cognitiveLevel,
    skill: question.skill,
    difficulty: question.difficulty,
    standard: question.standard ?? "",
    assessmentType: question.assessmentType,
    rubric: question.rubric ?? [],
    pairs: question.pairs ?? [],
    sequenceItems: question.sequenceItems ?? [],
  };
}
