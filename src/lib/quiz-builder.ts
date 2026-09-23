export type QuizSection = {
  key: string;
  title: string;
  description: string;
};

export type QuizBranchRule = {
  label: string;
  goToSectionKey: string | null;
};

export type QuizQuestion = {
  key: string;
  type: string;
  question: string;
  helpText: string;
  required: boolean;
  points: number;
  allowOther: boolean;
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
  options: { content: string; isCorrect: boolean; mediaUrl: string }[];
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
  themeColor: string;
  headerImageUrl: string;
  confirmationMessage: string;
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

export function newQuestion(type = "PILIHAN_GANDA", sectionKey = ""): QuizQuestion {
  const withOptions = type === "PILIHAN_GANDA" || type === "MULTI_SELECT" || type === "DROPDOWN";
  const grid = type === "GRID";
  return {
    key: newQuestionKey(),
    type,
    question: "",
    helpText: "",
    required: true,
    points: 1,
    allowOther: false,
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
    options: withOptions ? [{ content: "", isCorrect: false, mediaUrl: "" }, { content: "", isCorrect: false, mediaUrl: "" }] : grid ? [{ content: "", isCorrect: false, mediaUrl: "" }, { content: "", isCorrect: false, mediaUrl: "" }, { content: "", isCorrect: false, mediaUrl: "" }] : [],
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
    themeColor: "blue",
    headerImageUrl: "",
    confirmationMessage: "",
    availableFrom: "",
    availableUntil: "",
    sections: [{ key: sectionKey, title: "Bagian 1", description: "" }],
    questions: [newQuestion("PILIHAN_GANDA", sectionKey)],
  };
}
