"use client";

import { QUESTION_OPTION_LABELS as LABELS, type QuizQuestion } from "@/lib/quiz-builder";

/**
 * Editor tabel pilihan (grid): baris pernyataan, drag + tombol urut,
 * multi-pilih per baris, dan kunci kolom per baris.
 */
export function QuestionGridEditor({
  question,
  dragRow,
  onDragRowChange,
  onMoveGridRow,
  onUpdateGridRow,
  onSetGridCorrect,
  onAddGridRow,
  onRemoveGridRow,
  onPatchQuestion,
}: {
  question: QuizQuestion;
  dragRow: { key: string; index: number } | null;
  onDragRowChange: (_value: { key: string; index: number } | null) => void;
  onMoveGridRow: (_key: string, _from: number, _to: number) => void;
  onUpdateGridRow: (_key: string, _index: number, _value: string) => void;
  onSetGridCorrect: (_key: string, _index: number, _label: string) => void;
  onAddGridRow: (_key: string) => void;
  onRemoveGridRow: (_key: string, _index: number) => void;
  onPatchQuestion: (_key: string, _patch: Partial<QuizQuestion>) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-theme-sm font-semibold text-gray-700">Baris pernyataan</p>
        <label className="flex items-center gap-2 text-theme-xs text-gray-600">
          <input type="checkbox" checked={question.gridMultiple} onChange={(event) => onPatchQuestion(question.key, { gridMultiple: event.target.checked })} className="accent-limo-blue-500" />
          Boleh pilih lebih dari satu per baris
        </label>
      </div>
      <div className="mt-2 grid gap-2">
        {question.gridRows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragRow && dragRow.key === question.key) onMoveGridRow(question.key, dragRow.index, rowIndex);
              onDragRowChange(null);
            }}
            className={`flex flex-wrap items-center gap-2 rounded-xl border p-2 ${dragRow && dragRow.key === question.key && dragRow.index === rowIndex ? "border-dashed border-limo-blue-400 opacity-60" : "border-gray-200"}`}
          >
            <span
              draggable
              onDragStart={() => onDragRowChange({ key: question.key, index: rowIndex })}
              onDragEnd={() => onDragRowChange(null)}
              role="button"
              tabIndex={0}
              aria-label={`Tarik untuk mengurutkan baris ${rowIndex + 1}`}
              className="flex min-h-11 min-w-9 shrink-0 cursor-grab select-none items-center justify-center text-theme-xs text-gray-400"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-4"><circle cx="9" cy="7" r="1.6" /><circle cx="15" cy="7" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="17" r="1.6" /><circle cx="15" cy="17" r="1.6" /></svg>
            </span>
            <input value={row} onChange={(event) => onUpdateGridRow(question.key, rowIndex, event.target.value)} placeholder={`Pernyataan ${rowIndex + 1}`} dir="auto" className="tailadmin-input flex-1" />
            <label className="flex items-center gap-1 text-theme-xs text-gray-500">
              Kunci
              <select value={question.gridCorrect[rowIndex] ?? ""} onChange={(event) => onSetGridCorrect(question.key, rowIndex, event.target.value)} aria-label={`Kunci baris ${rowIndex + 1}`} className="tailadmin-input py-1.5">
                <option value="">-</option>
                {question.options.map((_, columnIndex) => <option key={columnIndex} value={LABELS[columnIndex]}>{LABELS[columnIndex]}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => onMoveGridRow(question.key, rowIndex, rowIndex - 1)} disabled={rowIndex === 0} aria-label={`Naikkan baris ${rowIndex + 1}`} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">↑</button>
            <button type="button" onClick={() => onMoveGridRow(question.key, rowIndex, rowIndex + 1)} disabled={rowIndex === question.gridRows.length - 1} aria-label={`Turunkan baris ${rowIndex + 1}`} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">↓</button>
            <button type="button" onClick={() => onRemoveGridRow(question.key, rowIndex)} disabled={question.gridRows.length <= 1} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">Hapus</button>
          </div>
        ))}
        <button type="button" onClick={() => onAddGridRow(question.key)} disabled={question.gridRows.length >= 20} className="w-fit rounded-lg border border-gray-200 px-3 py-1.5 text-theme-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40">+ Tambah baris</button>
        {question.gridCorrect.some((label) => !label) ? (
          <p className="text-theme-xs text-warning-700">Beberapa baris belum diberi kunci; baris tanpa kunci akan dinilai salah.</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Editor skala linier dan rating bintang: rentang, label ujung, dan jawaban benar.
 */
export function QuestionScaleEditor({
  question,
  onUpdateScale,
  onPatchQuestion,
}: {
  question: QuizQuestion;
  onUpdateScale: (_key: string, _patch: { scaleMin?: number; scaleMax?: number; scaleMinLabel?: string; scaleMaxLabel?: string; expectedAnswer?: string }) => void;
  onPatchQuestion: (_key: string, _patch: Partial<QuizQuestion>) => void;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-2">
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Nilai minimum
        <input type="number" min={0} max={9} value={question.scaleMin} onChange={(event) => onUpdateScale(question.key, { scaleMin: Number(event.target.value) })} className="mt-1 tailadmin-input" />
      </label>
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Nilai maksimum
        <input type="number" min={1} max={10} value={question.scaleMax} onChange={(event) => onUpdateScale(question.key, { scaleMax: Number(event.target.value) })} className="mt-1 tailadmin-input" />
      </label>
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Label minimum (opsional)
        <input value={question.scaleMinLabel} onChange={(event) => onPatchQuestion(question.key, { scaleMinLabel: event.target.value })} dir="auto" className="mt-1 tailadmin-input" />
      </label>
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Label maksimum (opsional)
        <input value={question.scaleMaxLabel} onChange={(event) => onPatchQuestion(question.key, { scaleMaxLabel: event.target.value })} dir="auto" className="mt-1 tailadmin-input" />
      </label>
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500 sm:col-span-2">
        Jawaban benar
        <select value={question.expectedAnswer} onChange={(event) => onUpdateScale(question.key, { expectedAnswer: event.target.value })} className="mt-1 tailadmin-input sm:max-w-xs">
          {question.options.map((option) => <option key={option.content} value={option.content}>{option.content}</option>)}
        </select>
      </label>
    </div>
  );
}
