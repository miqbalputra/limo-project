export const QUESTION_TYPE_VALUES = [
  "PILIHAN_GANDA",
  "MULTI_SELECT",
  "DROPDOWN",
  "BENAR_SALAH",
  "ISIAN_SINGKAT",
  "ESAI",
  "CLOZE",
  "SKALA",
  "RATING",
  "GRID",
  "TANGGAL",
  "WAKTU",
  "FILE_UPLOAD",
  "MENJODOHKAN",
  "URUTAN",
  "GAMBAR",
  "LISTENING",
  "READING",
  "SPEAKING",
  "WRITING",
  "ROLEPLAY",
] as const;

export type QuestionTypeValue = (typeof QUESTION_TYPE_VALUES)[number];

export type QuestionEditorKind =
  | "choice"
  | "boolean"
  | "short-text"
  | "paragraph"
  | "cloze"
  | "scale"
  | "rating"
  | "grid"
  | "date"
  | "time"
  | "file-upload"
  | "matching"
  | "sequence"
  | "media"
  | "manual";

export type QuestionTypeGroup = "Pilihan" | "Teks" | "Skala & kisi" | "Tanggal & berkas" | "Bahasa & performa";

export type QuestionTypeMeta = {
  group: QuestionTypeGroup;
  editor: QuestionEditorKind;
  hasOptions: boolean;
  singleCorrect: boolean;
  usesMedia: boolean;
  manualReview: boolean;
};

export const QUESTION_TYPE_GROUP_ORDER: QuestionTypeGroup[] = [
  "Pilihan",
  "Teks",
  "Skala & kisi",
  "Tanggal & berkas",
  "Bahasa & performa",
];

const META: Record<QuestionTypeValue, QuestionTypeMeta> = {
  PILIHAN_GANDA: { group: "Pilihan", editor: "choice", hasOptions: true, singleCorrect: true, usesMedia: false, manualReview: false },
  MULTI_SELECT: { group: "Pilihan", editor: "choice", hasOptions: true, singleCorrect: false, usesMedia: false, manualReview: false },
  DROPDOWN: { group: "Pilihan", editor: "choice", hasOptions: true, singleCorrect: true, usesMedia: false, manualReview: false },
  BENAR_SALAH: { group: "Pilihan", editor: "boolean", hasOptions: false, singleCorrect: false, usesMedia: false, manualReview: false },
  ISIAN_SINGKAT: { group: "Teks", editor: "short-text", hasOptions: false, singleCorrect: false, usesMedia: false, manualReview: false },
  ESAI: { group: "Teks", editor: "paragraph", hasOptions: false, singleCorrect: false, usesMedia: false, manualReview: true },
  CLOZE: { group: "Teks", editor: "cloze", hasOptions: false, singleCorrect: false, usesMedia: false, manualReview: false },
  SKALA: { group: "Skala & kisi", editor: "scale", hasOptions: true, singleCorrect: true, usesMedia: false, manualReview: false },
  RATING: { group: "Skala & kisi", editor: "rating", hasOptions: false, singleCorrect: false, usesMedia: false, manualReview: false },
  GRID: { group: "Skala & kisi", editor: "grid", hasOptions: true, singleCorrect: false, usesMedia: false, manualReview: false },
  TANGGAL: { group: "Tanggal & berkas", editor: "date", hasOptions: false, singleCorrect: false, usesMedia: false, manualReview: false },
  WAKTU: { group: "Tanggal & berkas", editor: "time", hasOptions: false, singleCorrect: false, usesMedia: false, manualReview: false },
  FILE_UPLOAD: { group: "Tanggal & berkas", editor: "file-upload", hasOptions: false, singleCorrect: false, usesMedia: false, manualReview: true },
  MENJODOHKAN: { group: "Bahasa & performa", editor: "matching", hasOptions: false, singleCorrect: false, usesMedia: false, manualReview: false },
  URUTAN: { group: "Bahasa & performa", editor: "sequence", hasOptions: false, singleCorrect: false, usesMedia: false, manualReview: false },
  GAMBAR: { group: "Bahasa & performa", editor: "media", hasOptions: false, singleCorrect: false, usesMedia: true, manualReview: true },
  LISTENING: { group: "Bahasa & performa", editor: "media", hasOptions: false, singleCorrect: false, usesMedia: true, manualReview: true },
  READING: { group: "Bahasa & performa", editor: "media", hasOptions: false, singleCorrect: false, usesMedia: true, manualReview: true },
  SPEAKING: { group: "Bahasa & performa", editor: "manual", hasOptions: false, singleCorrect: false, usesMedia: true, manualReview: true },
  WRITING: { group: "Bahasa & performa", editor: "manual", hasOptions: false, singleCorrect: false, usesMedia: true, manualReview: true },
  ROLEPLAY: { group: "Bahasa & performa", editor: "manual", hasOptions: false, singleCorrect: false, usesMedia: true, manualReview: true },
};

export const QUESTION_TYPE_META: Record<QuestionTypeValue, QuestionTypeMeta> = META;

export function isQuestionType(value: string): value is QuestionTypeValue {
  return (QUESTION_TYPE_VALUES as readonly string[]).includes(value);
}

export function questionTypeMeta(value: string): QuestionTypeMeta | undefined {
  return isQuestionType(value) ? META[value] : undefined;
}

export function questionTypesByGroup(): Array<{ group: QuestionTypeGroup; types: QuestionTypeValue[] }> {
  return QUESTION_TYPE_GROUP_ORDER.map((group) => ({
    group,
    types: QUESTION_TYPE_VALUES.filter((type) => META[type].group === group),
  }));
}
