"use client";

import { formatUiLabel } from "@/lib/ui-labels";
import type { QuizQuestion } from "@/lib/quiz-builder";

/** Editor pasangan jawaban untuk soal menjodohkan. */
export function QuestionMatchingEditor({
  question,
  index,
  onSetPair,
  onAddPair,
  onRemovePair,
}: {
  question: QuizQuestion;
  index: number;
  onSetPair: (_key: string, _index: number, _field: "left" | "right", _value: string) => void;
  onAddPair: (_key: string) => void;
  onRemovePair: (_key: string, _index: number) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <p className="text-theme-sm font-semibold text-gray-700">Pasangan jawaban</p>
      <p className="mt-1 text-theme-xs text-gray-500">Isi item kiri dan pasangan kanannya. Minimal dua pasangan.</p>
      <div className="mt-2 grid gap-2">
        {question.pairs.map((pair, pairIndex) => (
          <div key={pairIndex} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input value={pair.left} onChange={(event) => onSetPair(question.key, pairIndex, "left", event.target.value)} aria-label={`Item kiri ${pairIndex + 1} soal ${index + 1}`} dir="auto" placeholder={`Item ${pairIndex + 1}`} className="tailadmin-input" />
            <input value={pair.right} onChange={(event) => onSetPair(question.key, pairIndex, "right", event.target.value)} aria-label={`Pasangan kanan ${pairIndex + 1} soal ${index + 1}`} dir="auto" placeholder={`Pasangan benar ${pairIndex + 1}`} className="tailadmin-input" />
            <button type="button" onClick={() => onRemovePair(question.key, pairIndex)} disabled={question.pairs.length <= 2} aria-label={`Hapus pasangan ${pairIndex + 1}`} className="rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">Hapus</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onAddPair(question.key)} disabled={question.pairs.length >= 10} className="tailadmin-button-outline mt-2 px-3 py-2 text-theme-xs">+ Tambah pasangan</button>
    </div>
  );
}

/** Editor urutan benar untuk soal urutan. */
export function QuestionSequenceEditor({
  question,
  index,
  onSetSequenceItem,
  onAddSequenceItem,
  onRemoveSequenceItem,
}: {
  question: QuizQuestion;
  index: number;
  onSetSequenceItem: (_key: string, _index: number, _value: string) => void;
  onAddSequenceItem: (_key: string) => void;
  onRemoveSequenceItem: (_key: string, _index: number) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <p className="text-theme-sm font-semibold text-gray-700">Urutan benar</p>
      <p className="mt-1 text-theme-xs text-gray-500">Isi dari langkah pertama sampai terakhir. Minimal dua item.</p>
      <div className="mt-2 grid gap-2">
        {question.sequenceItems.map((item, itemIndex) => (
          <div key={itemIndex} className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
            <span className="text-theme-sm font-bold text-gray-500">{itemIndex + 1}.</span>
            <input value={item} onChange={(event) => onSetSequenceItem(question.key, itemIndex, event.target.value)} aria-label={`Item urutan ${itemIndex + 1} soal ${index + 1}`} dir="auto" placeholder={`Urutan ${itemIndex + 1}`} className="tailadmin-input" />
            <button type="button" onClick={() => onRemoveSequenceItem(question.key, itemIndex)} disabled={question.sequenceItems.length <= 2} aria-label={`Hapus item urutan ${itemIndex + 1}`} className="rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">Hapus</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onAddSequenceItem(question.key)} disabled={question.sequenceItems.length >= 20} className="tailadmin-button-outline mt-2 px-3 py-2 text-theme-xs">+ Tambah item</button>
    </div>
  );
}

/** Editor rubrik penilaian manual (berbicara, menulis, bermain peran, media). */
export function QuestionRubricEditor({
  question,
  index,
  onSetRubricRow,
  onAddRubricRow,
  onRemoveRubricRow,
}: {
  question: QuizQuestion;
  index: number;
  onSetRubricRow: (_key: string, _index: number, _patch: Partial<QuizQuestion["rubric"][number]>) => void;
  onAddRubricRow: (_key: string) => void;
  onRemoveRubricRow: (_key: string, _index: number) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <p className="text-theme-sm font-semibold text-gray-700">Rubrik penilaian</p>
      <p className="mt-1 text-theme-xs text-gray-500">Kriteria untuk penilaian manual (berbicara, menulis, bermain peran).</p>
      <div className="mt-2 grid gap-2">
        {question.rubric.length === 0 ? <p className="rounded-lg bg-gray-50 px-3 py-2 text-theme-xs text-gray-500">Belum ada kriteria. Tambahkan agar guru dapat menilai dengan acuan.</p> : null}
        {question.rubric.map((row, rowIndex) => (
          <div key={rowIndex} className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
            <input value={row.name} onChange={(event) => onSetRubricRow(question.key, rowIndex, { name: event.target.value })} aria-label={`Kriteria rubrik ${rowIndex + 1} soal ${index + 1}`} dir="auto" placeholder={`Kriteria ${rowIndex + 1}, contoh: Kelancaran`} className="tailadmin-input" />
            <input type="number" min={1} value={row.max} onChange={(event) => onSetRubricRow(question.key, rowIndex, { max: event.target.value })} aria-label={`Skor maksimum kriteria ${rowIndex + 1} soal ${index + 1}`} placeholder="Skor maks" className="tailadmin-input" />
            <button type="button" onClick={() => onRemoveRubricRow(question.key, rowIndex)} aria-label={`Hapus kriteria rubrik ${rowIndex + 1}`} className="rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50">Hapus</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onAddRubricRow(question.key)} disabled={question.rubric.length >= 10} className="tailadmin-button-outline mt-2 px-3 py-2 text-theme-xs">+ Tambah kriteria</button>
    </div>
  );
}

const SKILLS = ["VOCABULARY", "GRAMMAR", "READING", "LISTENING", "SPEAKING", "WRITING", "PRONUNCIATION", "LITERACY", "NUMERACY"];

/** Panel "Metadata & pedagogi" per soal (bahasa, arah, level, keterampilan, dst.). */
export function QuestionMetaPanel({
  question,
  index,
  onPatchQuestion,
}: {
  question: QuizQuestion;
  index: number;
  onPatchQuestion: (_key: string, _patch: Partial<QuizQuestion>) => void;
}) {
  return (
    <details className="rounded-xl border border-gray-200 p-3">
      <summary className="cursor-pointer text-theme-sm font-semibold text-gray-700">Metadata &amp; pedagogi</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Bahasa konten
          <input value={question.language} onChange={(event) => onPatchQuestion(question.key, { language: event.target.value })} aria-label={`Bahasa konten soal ${index + 1}`} dir="auto" placeholder="id, ar, en" className="mt-1 tailadmin-input" />
        </label>
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Arah konten
          <select value={question.direction} onChange={(event) => onPatchQuestion(question.key, { direction: event.target.value })} aria-label={`Arah konten soal ${index + 1}`} className="mt-1 tailadmin-input">
            <option value="">Otomatis</option>
            <option value="ltr">LTR</option>
            <option value="rtl">RTL Arab</option>
          </select>
        </label>
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Level kognitif
          <select value={question.cognitiveLevel} onChange={(event) => onPatchQuestion(question.key, { cognitiveLevel: event.target.value })} aria-label={`Level kognitif soal ${index + 1}`} className="mt-1 tailadmin-input">
            <option value="LOTS">LOTS - Pemahaman dasar</option>
            <option value="MOTS">MOTS - Penerapan</option>
            <option value="HOTS">HOTS - Analisis/evaluasi</option>
          </select>
        </label>
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Keterampilan
          <select value={question.skill} onChange={(event) => onPatchQuestion(question.key, { skill: event.target.value })} aria-label={`Keterampilan soal ${index + 1}`} className="mt-1 tailadmin-input">
            {SKILLS.map((value) => <option key={value} value={value}>{formatUiLabel(value)}</option>)}
          </select>
        </label>
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Kesulitan
          <select value={question.difficulty} onChange={(event) => onPatchQuestion(question.key, { difficulty: event.target.value })} aria-label={`Kesulitan soal ${index + 1}`} className="mt-1 tailadmin-input">
            <option value="EASY">Mudah</option>
            <option value="MEDIUM">Sedang</option>
            <option value="HARD">Sulit</option>
          </select>
        </label>
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Standar / kurikulum
          <input value={question.standard} onChange={(event) => onPatchQuestion(question.key, { standard: event.target.value })} aria-label={`Standar soal ${index + 1}`} dir="auto" placeholder="CEFR Pre-A1, A1, AKM Literasi" className="mt-1 tailadmin-input" />
        </label>
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Tipe asesmen
          <select value={question.assessmentType} onChange={(event) => onPatchQuestion(question.key, { assessmentType: event.target.value })} aria-label={`Tipe asesmen soal ${index + 1}`} className="mt-1 tailadmin-input">
            <option value="FORMATIVE">Formatif</option>
            <option value="SUMMATIVE">Sumatif</option>
            <option value="PLACEMENT">Penempatan</option>
            <option value="DIAGNOSTIC">Diagnostik</option>
          </select>
        </label>
      </div>
    </details>
  );
}
