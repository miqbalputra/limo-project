export const BANK_SOAL_PREVIEW_STORAGE_KEY = "limo:bank-soal-preview";

export type BankSoalDraftOption = { label: string; content: string; isCorrect: boolean };

export type BankSoalDraft = {
  kelasId?: string;
  kelasLabel?: string;
  type: string;
  question: string;
  stimulusText?: string;
  mediaUrl?: string;
  expectedAnswer?: string;
  structuredPayload?: unknown;
  rubric?: unknown;
  language?: string;
  direction?: string;
  cognitiveLevel?: string;
  skill?: string;
  difficulty?: string;
  standard?: string;
  assessmentType?: string;
  explanation?: string;
  options?: BankSoalDraftOption[];
};

export type BankSoalPreviewRecord = { savedAt: number; draft: BankSoalDraft };

export function writePreviewDraft(draft: BankSoalDraft) {
  if (typeof window === "undefined") return;
  const record: BankSoalPreviewRecord = { savedAt: Date.now(), draft };
  window.localStorage.setItem(BANK_SOAL_PREVIEW_STORAGE_KEY, JSON.stringify(record));
}
