"use client";

import { QUESTION_OPTION_LABELS as LABELS, questionHasOptions, type QuizQuestion } from "@/lib/quiz-builder";

/**
 * Editor opsi jawaban untuk soal pilihan ganda, kotak centang, dropdown, dan
 * kolom tabel (grid). Termasuk pengurutan (drag + tombol), gambar opsi, dan
 * opsi "Lainnya".
 */
export function QuestionOptionsEditor({
  question,
  index,
  dragOption,
  onDragOptionChange,
  onMoveOption,
  onUpdateOption,
  onAddOption,
  onRemoveOption,
  onUploadOptionMedia,
  onPatchQuestion,
}: {
  question: QuizQuestion;
  index: number;
  dragOption: { key: string; index: number } | null;
  onDragOptionChange: (_value: { key: string; index: number } | null) => void;
  onMoveOption: (_key: string, _from: number, _to: number) => void;
  onUpdateOption: (_key: string, _index: number, _patch: { content?: string; isCorrect?: boolean; mediaUrl?: string }) => void;
  onAddOption: (_key: string) => void;
  onRemoveOption: (_key: string, _index: number) => void;
  onUploadOptionMedia: (_key: string, _index: number, _file: File) => void;
  onPatchQuestion: (_key: string, _patch: Partial<QuizQuestion>) => void;
}) {
  const kind = question.type === "GRID" ? "kolom" : "opsi";

  return (
    <div className="grid gap-2">
      {question.type === "GRID" ? <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Kolom pilihan</p> : null}
      {question.options.map((option, optionIndex) => (
        <div
          key={optionIndex}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (dragOption && dragOption.key === question.key) onMoveOption(question.key, dragOption.index, optionIndex);
            onDragOptionChange(null);
          }}
          className={`rounded-xl border bg-white p-2 ${dragOption && dragOption.key === question.key && dragOption.index === optionIndex ? "border-dashed border-limo-blue-400 opacity-60" : "border-gray-200"}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              draggable
              onDragStart={() => onDragOptionChange({ key: question.key, index: optionIndex })}
              onDragEnd={() => onDragOptionChange(null)}
              role="button"
              tabIndex={0}
              aria-label={`Tarik untuk mengurutkan ${kind} ${LABELS[optionIndex]}`}
              className="flex min-h-11 min-w-9 shrink-0 cursor-grab select-none items-center justify-center text-theme-xs text-gray-400"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-4"><circle cx="9" cy="7" r="1.6" /><circle cx="15" cy="7" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="17" r="1.6" /><circle cx="15" cy="17" r="1.6" /></svg>
            </span>
            {question.type === "GRID" ? (
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-gray-300 text-theme-xs font-bold text-gray-500">{LABELS[optionIndex]}</span>
            ) : (
              <button
                type="button"
                onClick={() => onUpdateOption(question.key, optionIndex, { isCorrect: !option.isCorrect })}
                aria-pressed={option.isCorrect}
                aria-label={`Tandai opsi ${LABELS[optionIndex]} benar`}
                className={`grid size-8 shrink-0 place-items-center rounded-full border text-theme-xs font-bold ${option.isCorrect ? "border-success-500 bg-success-50 text-success-700" : "border-gray-300 text-gray-500"}`}
              >
                {option.isCorrect ? "✓" : LABELS[optionIndex]}
              </button>
            )}
            <input
              value={option.content}
              onChange={(event) => onUpdateOption(question.key, optionIndex, { content: event.target.value })}
              placeholder={`Opsi ${LABELS[optionIndex]}`}
              aria-label={`Opsi ${LABELS[optionIndex]} soal ${index + 1}`}
              dir="auto"
              className="tailadmin-input min-w-0 flex-1"
            />
            <button type="button" onClick={() => onMoveOption(question.key, optionIndex, optionIndex - 1)} disabled={optionIndex === 0} aria-label={`Naikkan ${kind} ${LABELS[optionIndex]}`} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">↑</button>
            <button type="button" onClick={() => onMoveOption(question.key, optionIndex, optionIndex + 1)} disabled={optionIndex === question.options.length - 1} aria-label={`Turunkan ${kind} ${LABELS[optionIndex]}`} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">↓</button>
            <label className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 focus-within:ring-2 focus-within:ring-limo-blue-500" title="Tambah gambar opsi">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="size-4"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m21 15-5-5L5 20" /></svg>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) onUploadOptionMedia(question.key, optionIndex, file);
                }}
              />
            </label>
            <button type="button" onClick={() => onRemoveOption(question.key, optionIndex)} disabled={question.options.length <= 2} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">Hapus</button>
          </div>
          {option.mediaUrl ? (
            <div className="mt-2 flex items-center gap-2 ps-10">
              {option.mediaUrl.startsWith("/api/v1/public/quiz-media/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={option.mediaUrl} alt={`Gambar opsi ${LABELS[optionIndex]}`} className="h-16 w-24 rounded-lg object-cover ring-1 ring-gray-200" />
              ) : null}
              <button type="button" onClick={() => onUpdateOption(question.key, optionIndex, { mediaUrl: "" })} className="text-theme-xs font-semibold text-error-600">Hapus gambar</button>
            </div>
          ) : null}
        </div>
      ))}
      <button type="button" onClick={() => onAddOption(question.key)} disabled={question.options.length >= 10} className="w-fit rounded-lg border border-gray-200 px-3 py-1.5 text-theme-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40">{question.type === "GRID" ? "+ Tambah kolom" : "+ Tambah opsi"}</button>
      {questionHasOptions(question.type) ? (
        <label className="mt-1 flex items-center gap-2 text-theme-sm text-gray-700">
          <input type="checkbox" checked={question.allowOther} onChange={(event) => onPatchQuestion(question.key, { allowOther: event.target.checked })} className="accent-limo-blue-500" />
          Tambahkan opsi &quot;Lainnya&quot;
        </label>
      ) : null}
    </div>
  );
}
