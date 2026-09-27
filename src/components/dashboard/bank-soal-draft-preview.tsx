"use client";

import { useMemo, useSyncExternalStore } from "react";
import { BankSoalPreview, type BankSoalPreviewData } from "@/components/dashboard/bank-soal-preview";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { BANK_SOAL_PREVIEW_STORAGE_KEY, type BankSoalDraft } from "@/lib/bank-soal-draft";

const EMPTY_SNAPSHOT = "";

function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function getStorageSnapshot() {
  if (typeof window === "undefined") return EMPTY_SNAPSHOT;
  return window.localStorage.getItem(BANK_SOAL_PREVIEW_STORAGE_KEY) ?? EMPTY_SNAPSHOT;
}

function getServerSnapshot() {
  return EMPTY_SNAPSHOT;
}

function toPreviewData(draft: BankSoalDraft): BankSoalPreviewData {
  return {
    type: draft.type,
    question: draft.question,
    stimulusText: draft.stimulusText,
    mediaUrl: draft.mediaUrl,
    expectedAnswer: draft.expectedAnswer,
    structuredPayload: draft.structuredPayload,
    rubric: draft.rubric,
    explanation: draft.explanation,
    language: draft.language,
    direction: draft.direction,
    cognitiveLevel: draft.cognitiveLevel,
    skill: draft.skill,
    difficulty: draft.difficulty,
    standard: draft.standard,
    assessmentType: draft.assessmentType,
    options: draft.options,
    kelasLabel: draft.kelasLabel,
  };
}

export function BankSoalDraftPreview() {
  const raw = useSyncExternalStore(subscribeToStorage, getStorageSnapshot, getServerSnapshot);

  const draft = useMemo(() => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { draft?: BankSoalDraft };
      return parsed?.draft ? toPreviewData(parsed.draft) : null;
    } catch {
      return null;
    }
  }, [raw]);

  if (!draft) {
    return <EmptyState icon="exam" title="Belum ada draft untuk dipratinjau" description="Buka builder soal, isi pertanyaan, lalu klik “Pratinjau di tab baru”." />;
  }

  return (
    <div className="space-y-4">
      <p role="status" className="rounded-xl border border-warning-100 bg-warning-50 p-3 text-theme-xs font-semibold text-warning-800">
        Pratinjau draft yang sedang disusun — soal ini belum tentu sudah disimpan.
      </p>
      <BankSoalPreview data={draft} />
    </div>
  );
}
