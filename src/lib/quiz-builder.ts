export type QuizQuestion = {
  key: string;
  type: string;
  question: string;
  required: boolean;
  points: number;
  allowOther: boolean;
  mediaUrl: string;
  explanation: string;
  expectedAnswer: string;
  options: { content: string; isCorrect: boolean }[];
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
  availableFrom: string;
  availableUntil: string;
  questions: QuizQuestion[];
};

let questionCounter = 0;

export function newQuestionKey() {
  questionCounter += 1;
  return `q-${Date.now()}-${questionCounter}`;
}

export function newQuestion(type = "PILIHAN_GANDA"): QuizQuestion {
  return {
    key: newQuestionKey(),
    type,
    question: "",
    required: true,
    points: 1,
    allowOther: false,
    mediaUrl: "",
    explanation: "",
    expectedAnswer: type === "BENAR_SALAH" ? "benar" : "",
    options: type === "PILIHAN_GANDA" || type === "MULTI_SELECT" ? [{ content: "", isCorrect: false }, { content: "", isCorrect: false }] : [],
  };
}

export function emptyQuizForm(): QuizFormState {
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
    availableFrom: "",
    availableUntil: "",
    questions: [newQuestion("PILIHAN_GANDA")],
  };
}
