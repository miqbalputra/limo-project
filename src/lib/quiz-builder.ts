export type QuizSection = {
  key: string;
  title: string;
  description: string;
};

export type QuizBranchRule = {
  label: string;
  goToSectionKey: string | null;
};

export type QuizRubricRow = {
  name: string;
  max: string;
};

export type QuizPair = {
  left: string;
  right: string;
};

export type QuizQuestion = {
  key: string;
  type: string;
  question: string;
  helpText: string;
  required: boolean;
  points: number;
  allowOther: boolean;
  shuffleOptions: boolean;
  mediaUrl: string;
  explanation: string;
  expectedAnswer: string;
  sectionKey: string;
  branchRules: QuizBranchRule[];
  scaleMin: number;
  scaleMax: number;
  scaleMinLabel: string;
  scaleMaxLabel: string;
  gridRows: string[];
  gridMultiple: boolean;
  gridCorrect: string[];
  validationType: string;
  validationMin: string;
  validationMax: string;
  validationPattern: string;
  validationMessage: string;
  acceptedAnswers: string[];
  feedbackCorrect: string;
  feedbackIncorrect: string;
  uploadAllowedTypes: string[];
  uploadMaxSizeMb: number;
  options: { content: string; isCorrect: boolean; mediaUrl: string }[];
  stimulusText: string;
  language: string;
  direction: string;
  cognitiveLevel: string;
  skill: string;
  difficulty: string;
  standard: string;
  assessmentType: string;
  rubric: QuizRubricRow[];
  pairs: QuizPair[];
  sequenceItems: string[];
};

export type QuizFormState = {
  kelasId: string;
  title: string;
  description: string;
  mode: string;
  deliveryMode: string;
  durationMinutes: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  passingScore: string;
  showScoreImmediately: boolean;
  showAnswersAfterSubmit: boolean;
  collectRespondentName: boolean;
  showResultToWali: boolean;
  showResultToSiswa: boolean;
  secureMode: boolean;
  themeColor: string;
  headerImageUrl: string;
  confirmationMessage: string;
  collectRespondentEmail: boolean;
  sendCopyToRespondent: boolean;
  oneResponsePerEmail: boolean;
  notifyGuruOnResponse: boolean;
  presentationMode: string;
  releaseMode: string;
  examDate: string;
  availableFrom: string;
  availableUntil: string;
  sections: QuizSection[];
  questions: QuizQuestion[];
};

let counter = 0;

export function newQuestionKey() {
  counter += 1;
  return `q-${Date.now()}-${counter}`;
}

export function newSectionKey() {
  counter += 1;
  return `s-${Date.now()}-${counter}`;
}

export const CHOICE_TYPES = new Set(["PILIHAN_GANDA", "MULTI_SELECT", "DROPDOWN"]);
export const SCALE_TYPES = new Set(["SKALA", "RATING"]);
export const MANUAL_TYPES = new Set(["SPEAKING", "WRITING", "ROLEPLAY", "GAMBAR", "LISTENING", "READING"]);
export const STIMULUS_TYPES = new Set(["READING", "LISTENING", "CLOZE", "GAMBAR", "ROLEPLAY", "SPEAKING", "WRITING"]);

export function questionHasOptions(type: string) {
  return CHOICE_TYPES.has(type);
}

export const QUESTION_OPTION_LABELS = "ABCDEFGHIJ".split("");

export function questionHasScale(type: string) {
  return SCALE_TYPES.has(type);
}

export function newRubricRow(): QuizRubricRow {
  return { name: "", max: "" };
}

export function newPair(): QuizPair {
  return { left: "", right: "" };
}

export function newQuestion(type = "PILIHAN_GANDA", sectionKey = ""): QuizQuestion {
  const blank = { content: "", isCorrect: false, mediaUrl: "" };
  const grid = type === "GRID";
  return {
    key: newQuestionKey(),
    type,
    question: "",
    helpText: "",
    required: true,
    points: 1,
    allowOther: false,
    shuffleOptions: false,
    mediaUrl: "",
    explanation: "",
    expectedAnswer: type === "BENAR_SALAH" ? "benar" : "",
    sectionKey,
    branchRules: [],
    scaleMin: 1,
    scaleMax: 5,
    scaleMinLabel: "",
    scaleMaxLabel: "",
    gridRows: grid ? ["", ""] : [],
    gridMultiple: false,
    gridCorrect: grid ? ["", ""] : [],
    validationType: "NONE",
    validationMin: "",
    validationMax: "",
    validationPattern: "",
    validationMessage: "",
    acceptedAnswers: [],
    feedbackCorrect: "",
    feedbackIncorrect: "",
    uploadAllowedTypes: [],
    uploadMaxSizeMb: 0,
    options: CHOICE_TYPES.has(type)
      ? [blank, blank]
      : grid
        ? [blank, blank, blank]
        : SCALE_TYPES.has(type)
          ? Array.from({ length: 5 }, (_, index) => ({ content: String(index + 1), isCorrect: index === 0, mediaUrl: "" }))
          : [],
    stimulusText: "",
    language: "",
    direction: "",
    cognitiveLevel: "LOTS",
    skill: "VOCABULARY",
    difficulty: "EASY",
    standard: "",
    assessmentType: "FORMATIVE",
    rubric: MANUAL_TYPES.has(type) ? [newRubricRow()] : [],
    pairs: type === "MENJODOHKAN" ? [newPair(), newPair()] : [],
    sequenceItems: type === "URUTAN" ? ["", "", ""] : [],
  };
}

export function emptyQuizForm(): QuizFormState {
  const sectionKey = newSectionKey();
  return {
    kelasId: "",
    title: "",
    description: "",
    mode: "UJIAN",
    deliveryMode: "ONLINE_VIA_WALI",
    durationMinutes: 30,
    maxAttempts: 1,
    shuffleQuestions: false,
    shuffleOptions: false,
    passingScore: "",
    showScoreImmediately: true,
    showAnswersAfterSubmit: false,
    collectRespondentName: false,
    showResultToWali: true,
    showResultToSiswa: true,
    secureMode: false,
    themeColor: "blue",
    headerImageUrl: "",
    confirmationMessage: "",
    collectRespondentEmail: false,
    sendCopyToRespondent: false,
    oneResponsePerEmail: false,
    notifyGuruOnResponse: false,
    presentationMode: "ALL",
    releaseMode: "IMMEDIATE",
    examDate: "",
    availableFrom: "",
    availableUntil: "",
    sections: [{ key: sectionKey, title: "Bagian 1", description: "" }],
    questions: [newQuestion("PILIHAN_GANDA", sectionKey)],
  };
}
