"use client";

import { useState } from "react";
import { QUESTION_OPTION_LABELS as LABELS, questionHasOptions, type QuizQuestion, type QuizSection } from "@/lib/quiz-builder";

export function OptionsEditor({ question, onPatch, onMoveOption, onUpdateOption, onAddOption, onRemoveOption, onUploadOptionMedia }: {
  question: QuizQuestion;
  onPatch: (_key: string, _patch: Partial<QuizQuestion>) => void;
  onMoveOption: (_key: string, _index: number, _direction: -1 | 1) => void;
  onUpdateOption: (_key: string, _index: number, _patch: Partial<QuizQuestion["options"][number]>) => void;
  onAddOption: (_key: string) => void;
  onRemoveOption: (_key: string, _index: number) => void;
  onUploadOptionMedia: (_key: string, _index: number, _file: File) => void;
}) {
  const isCheckbox = question.type === "MULTI_SELECT";
  const dragIndex = useState<number | null>(null);

  return (
    <div className="grid gap-1.5">
      {question.options.map((option, index) => (
        <div
          key={index}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (dragIndex[0] !== null) onMoveOption(question.key, dragIndex[0], index > dragIndex[0] ? 1 : -1);
            dragIndex[1](null);
          }}
          className="flex items-center gap-2 rounded-xl px-1 py-1 transition hover:bg-gray-50"
        >
          <span
            draggable
            onDragStart={() => dragIndex[1](index)}
            onDragEnd={() => dragIndex[1](null)}
            role="button"
            tabIndex={0}
            aria-label={`Tarik untuk mengurutkan opsi ${LABELS[index]}`}
            className="flex size-8 cursor-grab select-none items-center justify-center rounded-full text-theme-xs font-bold text-gray-400 hover:bg-gray-100"
          >
            {LABELS[index]}
          </span>
          <input
            type={isCheckbox ? "checkbox" : "radio"}
            name={`correct-${question.key}`}
            checked={option.isCorrect}
            onChange={() => {
              if (isCheckbox) {
                onUpdateOption(question.key, index, { isCorrect: !option.isCorrect });
              } else {
                onPatch(question.key, { options: question.options.map((item, position) => ({ ...item, isCorrect: position === index })) });
              }
            }}
            aria-label={`Tandai jawaban benar opsi ${LABELS[index]}`}
            title="Jawaban benar"
            className="size-4 shrink-0 accent-success-600"
          />
          <input
            value={option.content}
            onChange={(event) => onUpdateOption(question.key, index, { content: event.target.value })}
            placeholder={`Opsi ${LABELS[index]}`}
            aria-label={`Teks opsi ${LABELS[index]}`}
            dir="auto"
            className="min-w-0 flex-1 border-0 border-b border-transparent bg-transparent px-1 py-1.5 text-theme-sm text-gray-800 focus:border-limo-blue-500 focus:outline-none"
          />
          {option.mediaUrl ? (
            <button type="button" onClick={() => onUpdateOption(question.key, index, { mediaUrl: "" })} className="text-theme-xs font-semibold text-error-600">Hapus gambar</button>
          ) : null}
          <label className="cursor-pointer rounded-lg px-2 py-1 text-theme-xs font-semibold text-limo-blue-700 hover:bg-limo-blue-50" title="Lampirkan gambar opsi">
            Gambar
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onUploadOptionMedia(question.key, index, file); }} />
          </label>
          <button type="button" onClick={() => onRemoveOption(question.key, index)} disabled={question.options.length <= 2} aria-label={`Hapus opsi ${LABELS[index]}`} className="grid size-8 place-items-center rounded-full text-gray-400 hover:bg-error-50 hover:text-error-600 disabled:opacity-30">✕</button>
        </div>
      ))}
      <div className="mt-1 flex flex-wrap items-center gap-3 pl-10">
        <button type="button" onClick={() => onAddOption(question.key)} disabled={question.options.length >= 10} className="text-theme-sm font-medium text-limo-blue-700 hover:text-limo-blue-800 disabled:opacity-40">+ Tambah opsi</button>
        {(question.type === "PILIHAN_GANDA" || question.type === "MULTI_SELECT") ? (
          <label className="flex items-center gap-2 text-theme-sm text-gray-600">
            <input type="checkbox" checked={question.allowOther} onChange={(event) => onPatch(question.key, { allowOther: event.target.checked })} className="accent-limo-blue-500" />
            &quot;Lainnya&quot;
          </label>
        ) : null}
      </div>
    </div>
  );
}

export function GridEditor({ question, onPatch, onMoveGridRow, onUpdateGridRow, onSetGridCorrect, onAddGridRow, onRemoveGridRow }: {
  question: QuizQuestion;
  onPatch: (_key: string, _patch: Partial<QuizQuestion>) => void;
  onMoveGridRow: (_key: string, _index: number, _direction: -1 | 1) => void;
  onUpdateGridRow: (_key: string, _index: number, _value: string) => void;
  onSetGridCorrect: (_key: string, _index: number, _label: string) => void;
  onAddGridRow: (_key: string) => void;
  onRemoveGridRow: (_key: string, _index: number) => void;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-gray-200 p-3">
      <div className="grid gap-1.5">
        <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Baris pernyataan</p>
        {question.gridRows.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-6 text-theme-xs font-bold text-gray-400">{index + 1}</span>
            <input value={row} onChange={(event) => onUpdateGridRow(question.key, index, event.target.value)} placeholder={`Baris ${index + 1}`} aria-label={`Baris ${index + 1}`} dir="auto" className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
            <select value={question.gridCorrect[index] ?? ""} onChange={(event) => onSetGridCorrect(question.key, index, event.target.value)} aria-label={`Kunci kolom untuk baris ${index + 1}`} title="Kunci kolom" className="rounded-lg border border-gray-200 px-2 py-1.5 text-theme-xs text-gray-700 focus:border-limo-blue-500 focus:outline-none">
              <option value="">— kunci —</option>
              {question.options.map((option, optionIndex) => (
                <option key={optionIndex} value={LABELS[optionIndex]}>{LABELS[optionIndex]} · {option.content || `Kolom ${optionIndex + 1}`}</option>
              ))}
            </select>
            <button type="button" onClick={() => onMoveGridRow(question.key, index, -1)} aria-label="Naikkan baris" className="rounded px-1.5 text-gray-400 hover:bg-gray-100">↑</button>
            <button type="button" onClick={() => onMoveGridRow(question.key, index, 1)} aria-label="Turunkan baris" className="rounded px-1.5 text-gray-400 hover:bg-gray-100">↓</button>
            <button type="button" onClick={() => onRemoveGridRow(question.key, index)} disabled={question.gridRows.length <= 1} aria-label={`Hapus baris ${index + 1}`} className="text-gray-400 hover:text-error-600 disabled:opacity-30">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => onAddGridRow(question.key)} className="w-fit text-theme-sm font-medium text-limo-blue-700 hover:text-limo-blue-800">+ Tambah baris</button>
      </div>
      <label className="flex items-center gap-2 text-theme-sm text-gray-600">
        <input type="checkbox" checked={question.gridMultiple} onChange={(event) => onPatch(question.key, { gridMultiple: event.target.checked })} className="accent-limo-blue-500" />
        Izinkan beberapa jawaban per baris (kisi-kisi kotak centang)
      </label>
    </div>
  );
}

export function ScaleEditor({ question, onUpdateScale }: {
  question: QuizQuestion;
  onUpdateScale: (_key: string, _patch: { scaleMin?: number; scaleMax?: number; scaleMinLabel?: string; scaleMaxLabel?: string; expectedAnswer?: string }) => void;
}) {
  return (
    <div className="grid gap-2 rounded-xl border border-gray-200 p-3 sm:grid-cols-2">
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Skala dari
        <input type="number" min={0} max={9} value={question.scaleMin} onChange={(event) => onUpdateScale(question.key, { scaleMin: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
      </label>
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Sampai
        <input type="number" min={1} max={10} value={question.scaleMax} onChange={(event) => onUpdateScale(question.key, { scaleMax: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
      </label>
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Label sisi kiri (opsional)
        <input value={question.scaleMinLabel} onChange={(event) => onUpdateScale(question.key, { scaleMinLabel: event.target.value })} dir="auto" className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
      </label>
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Label sisi kanan (opsional)
        <input value={question.scaleMaxLabel} onChange={(event) => onUpdateScale(question.key, { scaleMaxLabel: event.target.value })} dir="auto" className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
      </label>
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500 sm:col-span-2">
        Jawaban benar (skor penuh)
        <input type="number" min={question.scaleMin} max={question.scaleMax} value={question.expectedAnswer} onChange={(event) => onUpdateScale(question.key, { expectedAnswer: event.target.value })} className="mt-1 w-32 rounded-lg border border-gray-200 px-2 py-1.5 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
      </label>
    </div>
  );
}

export function MatchingEditor({ question, onSetPair, onAddPair, onRemovePair }: {
  question: QuizQuestion;
  onSetPair: (_key: string, _index: number, _field: "left" | "right", _value: string) => void;
  onAddPair: (_key: string) => void;
  onRemovePair: (_key: string, _index: number) => void;
}) {
  return (
    <div className="grid gap-2 rounded-xl border border-gray-200 p-3">
      <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Pasangan jawaban — pasangan &quot;kiri → kanan&quot; menjadi kunci</p>
      {question.pairs.map((pair, index) => (
        <div key={index} className="flex items-center gap-2">
          <input value={pair.left} onChange={(event) => onSetPair(question.key, index, "left", event.target.value)} placeholder={`Soal ${index + 1}`} aria-label={`Pasangan kiri ${index + 1}`} dir="auto" className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
          <span className="text-gray-400">→</span>
          <input value={pair.right} onChange={(event) => onSetPair(question.key, index, "right", event.target.value)} placeholder={`Jodoh ${index + 1}`} aria-label={`Pasangan kanan ${index + 1}`} dir="auto" className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
          <button type="button" onClick={() => onRemovePair(question.key, index)} disabled={question.pairs.length <= 2} aria-label={`Hapus pasangan ${index + 1}`} className="text-gray-400 hover:text-error-600 disabled:opacity-30">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onAddPair(question.key)} className="w-fit text-theme-sm font-medium text-limo-blue-700 hover:text-limo-blue-800">+ Tambah pasangan</button>
    </div>
  );
}

export function SequenceEditor({ question, onSetSequenceItem, onAddSequenceItem, onRemoveSequenceItem }: {
  question: QuizQuestion;
  onSetSequenceItem: (_key: string, _index: number, _value: string) => void;
  onAddSequenceItem: (_key: string) => void;
  onRemoveSequenceItem: (_key: string, _index: number) => void;
}) {
  return (
    <div className="grid gap-2 rounded-xl border border-gray-200 p-3">
      <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Urutan yang benar — tulis dari posisi pertama</p>
      {question.sequenceItems.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="w-6 text-theme-xs font-bold text-gray-400">{index + 1}</span>
          <input value={item} onChange={(event) => onSetSequenceItem(question.key, index, event.target.value)} placeholder={`Item ${index + 1}`} aria-label={`Item urutan ${index + 1}`} dir="auto" className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
          <button type="button" onClick={() => onRemoveSequenceItem(question.key, index)} disabled={question.sequenceItems.length <= 2} aria-label={`Hapus item ${index + 1}`} className="text-gray-400 hover:text-error-600 disabled:opacity-30">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onAddSequenceItem(question.key)} className="w-fit text-theme-sm font-medium text-limo-blue-700 hover:text-limo-blue-800">+ Tambah item</button>
    </div>
  );
}

export function RubricEditor({ question, onSetRubricRow, onAddRubricRow, onRemoveRubricRow }: {
  question: QuizQuestion;
  onSetRubricRow: (_key: string, _index: number, _patch: Partial<QuizQuestion["rubric"][number]>) => void;
  onAddRubricRow: (_key: string) => void;
  onRemoveRubricRow: (_key: string, _index: number) => void;
}) {
  return (
    <div className="grid gap-2 rounded-xl border border-gray-200 p-3">
      <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Rubrik penilaian manual (opsional)</p>
      {question.rubric.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <input value={row.name} onChange={(event) => onSetRubricRow(question.key, index, { name: event.target.value })} placeholder={`Kriteria ${index + 1}`} aria-label={`Kriteria rubrik ${index + 1}`} dir="auto" className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
          <input type="number" min={1} value={row.max} onChange={(event) => onSetRubricRow(question.key, index, { max: event.target.value })} placeholder="Maks" aria-label={`Nilai maksimum kriteria ${index + 1}`} className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
          <button type="button" onClick={() => onRemoveRubricRow(question.key, index)} disabled={question.rubric.length <= 1} aria-label={`Hapus kriteria ${index + 1}`} className="text-gray-400 hover:text-error-600 disabled:opacity-30">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onAddRubricRow(question.key)} className="w-fit text-theme-sm font-medium text-limo-blue-700 hover:text-limo-blue-800">+ Tambah kriteria</button>
    </div>
  );
}

export function FileUploadConfig({ question, onPatch }: {
  question: QuizQuestion;
  onPatch: (_key: string, _patch: Partial<QuizQuestion>) => void;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-2">
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Tipe berkas diizinkan (satu per baris, kosong = semua)
        <textarea value={question.uploadAllowedTypes.join("\n")} onChange={(event) => onPatch(question.key, { uploadAllowedTypes: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })} rows={2} placeholder="application/pdf&#10;image/png" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
      </label>
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Ukuran maksimum (MB, 0 = tanpa batas)
        <input type="number" min={0} max={200} value={question.uploadMaxSizeMb} onChange={(event) => onPatch(question.key, { uploadMaxSizeMb: Number(event.target.value) || 0 })} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
      </label>
      <p className="rounded-xl bg-limo-blue-50 px-4 py-3 text-theme-sm text-limo-blue-700 sm:col-span-2">Responden mengunggah satu berkas. Soal ini dinilai manual oleh guru.</p>
    </div>
  );
}

export function AnswerKeyExtras({ question, onPatch, sections, onSetBranchRule }: {
  question: QuizQuestion;
  onPatch: (_key: string, _patch: Partial<QuizQuestion>) => void;
  sections: QuizSection[];
  onSetBranchRule: (_questionKey: string, _label: string, _goToSectionKey: string | null) => void;
}) {
  return (
    <div className="grid gap-3">
      {question.type === "BENAR_SALAH" ? (
        <div className="flex flex-wrap gap-2">
          {["benar", "salah"].map((value) => (
            <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-theme-sm font-semibold ${question.expectedAnswer === value ? "border-success-600 bg-success-50 text-success-700" : "border-gray-200 text-gray-700"}`}>
              <input type="radio" name={`key-${question.key}`} checked={question.expectedAnswer === value} onChange={() => onPatch(question.key, { expectedAnswer: value })} className="accent-success-600" />
              {value === "benar" ? "Benar" : "Salah"}
            </label>
          ))}
        </div>
      ) : null}

      {question.type === "ISIAN_SINGKAT" || question.type === "CLOZE" ? (
        <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Kunci jawaban
          <input value={question.expectedAnswer} onChange={(event) => onPatch(question.key, { expectedAnswer: event.target.value })} placeholder="Jawaban benar" dir="auto" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
        </label>
      ) : null}

      {["ISIAN_SINGKAT", "CLOZE", "TANGGAL", "WAKTU"].includes(question.type) ? (
        <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Kunci alternatif yang juga diterima (satu per baris)
          <textarea
            value={question.acceptedAnswers.join("\n")}
            onChange={(event) => onPatch(question.key, { acceptedAnswers: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })}
            dir="auto"
            rows={2}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none"
          />
        </label>
      ) : null}

      {question.type === "ISIAN_SINGKAT" || question.type === "ESAI" || question.type === "MULTI_SELECT" ? (
        <div className="grid gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-2">
          <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Validasi jawaban
            <select value={question.validationType} onChange={(event) => onPatch(question.key, { validationType: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-theme-sm focus:border-limo-blue-500 focus:outline-none">
              <option value="NONE">Tidak ada</option>
              {question.type === "ISIAN_SINGKAT" ? <option value="NUMBER">Angka (rentang)</option> : null}
              {question.type !== "MULTI_SELECT" ? <option value="LENGTH">Panjang teks</option> : null}
              {question.type === "ISIAN_SINGKAT" ? <option value="TEXT">Cocok pola (regex)</option> : null}
              {question.type === "MULTI_SELECT" ? <option value="CHECKBOX">Jumlah pilihan</option> : null}
            </select>
          </label>
          {question.validationType === "NUMBER" || question.validationType === "LENGTH" || question.validationType === "CHECKBOX" ? (
            <>
              <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                {question.validationType === "NUMBER" ? "Nilai minimum" : question.validationType === "CHECKBOX" ? "Jumlah minimum" : "Panjang minimum"}
                <input type="number" min={0} value={question.validationMin} onChange={(event) => onPatch(question.key, { validationMin: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
              </label>
              <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                {question.validationType === "NUMBER" ? "Nilai maksimum" : question.validationType === "CHECKBOX" ? "Jumlah maksimum" : "Panjang maksimum"}
                <input type="number" min={0} value={question.validationMax} onChange={(event) => onPatch(question.key, { validationMax: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
              </label>
            </>
          ) : null}
          {question.validationType === "TEXT" ? (
            <>
              <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                Pola regex
                <input value={question.validationPattern} onChange={(event) => onPatch(question.key, { validationPattern: event.target.value })} placeholder="Contoh: ^[A-Z]{3}$" dir="auto" className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
              </label>
              <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                Pesan bila tidak sesuai
                <input value={question.validationMessage} onChange={(event) => onPatch(question.key, { validationMessage: event.target.value })} dir="auto" className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
              </label>
            </>
          ) : null}
        </div>
      ) : null}

      {questionHasOptions(question.type) && sections.length > 1 ? (
        <div className="rounded-xl border border-gray-200 p-3">
          <p className="text-theme-sm font-semibold text-gray-700">Lompatan antar bagian</p>
          <p className="mt-1 text-theme-xs text-gray-500">Setelah responden memilih opsi, arahkan ke bagian tertentu.</p>
          <div className="mt-2 grid gap-2">
            {question.options.map((option, optionIndex) => {
              const rule = question.branchRules.find((item) => item.label === LABELS[optionIndex]);
              return (
                <div key={optionIndex} className="flex items-center gap-2 text-theme-sm">
                  <span className="w-6 shrink-0 font-bold text-gray-500">{LABELS[optionIndex]}</span>
                  <span className="min-w-0 flex-1 truncate text-gray-600">{option.content || `Opsi ${LABELS[optionIndex]}`}</span>
                  <select value={rule?.goToSectionKey ?? ""} onChange={(event) => onSetBranchRule(question.key, LABELS[optionIndex], event.target.value || null)} aria-label={`Tujuan opsi ${LABELS[optionIndex]}`} className="w-56 rounded-lg border border-gray-200 px-2 py-1.5 text-theme-xs focus:border-limo-blue-500 focus:outline-none">
                    <option value="">Bagian berikutnya</option>
                    {sections.map((section, sectionIndex) => <option key={section.key} value={section.key}>Bagian {sectionIndex + 1}: {section.title}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
