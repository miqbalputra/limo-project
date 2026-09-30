"use client";

import { QUESTION_OPTION_LABELS as LABELS, questionHasOptions, type QuizQuestion, type QuizSection } from "@/lib/quiz-builder";

/**
 * Sisa field kartu soal: umpan balik benar/salah, konfigurasi unggah berkas,
 * branching antar bagian, kunci benar/salah, kunci + validasi jawaban,
 * pembahasan, dan footer (wajib diisi, poin, acak opsi).
 */
export function QuestionExtraFields({
  question,
  index,
  sections,
  onPatchQuestion,
  onSetBranchRule,
}: {
  question: QuizQuestion;
  index: number;
  sections: QuizSection[];
  onPatchQuestion: (_key: string, _patch: Partial<QuizQuestion>) => void;
  onSetBranchRule: (_questionKey: string, _label: string, _goToSectionKey: string | null) => void;
}) {
  return (
    <>
      <div className="grid gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-2">
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Umpan balik jika benar (opsional)
          <textarea value={question.feedbackCorrect} onChange={(event) => onPatchQuestion(question.key, { feedbackCorrect: event.target.value })} dir="auto" rows={2} className="mt-1 tailadmin-input" />
        </label>
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Umpan balik jika salah (opsional)
          <textarea value={question.feedbackIncorrect} onChange={(event) => onPatchQuestion(question.key, { feedbackIncorrect: event.target.value })} dir="auto" rows={2} className="mt-1 tailadmin-input" />
        </label>
      </div>

      {question.type === "FILE_UPLOAD" ? (
        <div className="grid gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-2">
          <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Tipe berkas diizinkan (satu per baris, kosong = semua)
            <textarea value={question.uploadAllowedTypes.join("\n")} onChange={(event) => onPatchQuestion(question.key, { uploadAllowedTypes: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })} rows={2} placeholder="application/pdf&#10;image/png" className="mt-1 tailadmin-input" />
          </label>
          <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Ukuran maksimum (MB, 0 = tanpa batas)
            <input type="number" min={0} max={200} value={question.uploadMaxSizeMb} onChange={(event) => onPatchQuestion(question.key, { uploadMaxSizeMb: Number(event.target.value) || 0 })} className="mt-1 tailadmin-input" />
          </label>
          <p className="rounded-xl bg-limo-blue-50 px-4 py-3 text-theme-sm text-limo-blue-700 sm:col-span-2">Responden akan mengunggah satu berkas (PDF, dokumen, gambar, audio, video, atau zip). Dinilai manual oleh guru.</p>
        </div>
      ) : null}

      {questionHasOptions(question.type) && sections.length > 1 ? (
        <div className="rounded-xl border border-gray-200 p-3">
          <p className="text-theme-sm font-semibold text-gray-700">Lompatan antar bagian (branching)</p>
          <p className="mt-1 text-theme-xs text-gray-500">Setelah responden memilih, arahkan ke bagian tertentu.</p>
          <div className="mt-2 grid gap-2">
            {question.options.map((option, optionIndex) => {
              const rule = question.branchRules.find((item) => item.label === LABELS[optionIndex]);
              return (
                <div key={optionIndex} className="flex items-center gap-2 text-theme-sm">
                  <span className="w-6 shrink-0 font-bold text-gray-500">{LABELS[optionIndex]}</span>
                  <span className="min-w-0 flex-1 truncate text-gray-600">{option.content || `Opsi ${LABELS[optionIndex]}`}</span>
                  <select value={rule?.goToSectionKey ?? ""} onChange={(event) => onSetBranchRule(question.key, LABELS[optionIndex], event.target.value || null)} aria-label={`Tujuan opsi ${LABELS[optionIndex]}`} className="tailadmin-input sm:max-w-xs">
                    <option value="">Bagian berikutnya</option>
                    {sections.map((section, sectionIndex) => <option key={section.key} value={section.key}>Bagian {sectionIndex + 1}: {section.title}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {question.type === "BENAR_SALAH" ? (
        <div className="flex flex-wrap gap-2">
          {["benar", "salah"].map((value) => (
            <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-theme-sm font-semibold ${question.expectedAnswer === value ? "border-limo-blue-500 bg-limo-blue-50 text-limo-blue-700" : "border-gray-200 text-gray-700"}`}>
              <input type="radio" name={`key-${question.key}`} checked={question.expectedAnswer === value} onChange={() => onPatchQuestion(question.key, { expectedAnswer: value })} className="accent-limo-blue-500" />
              {value === "benar" ? "Benar" : "Salah"}
            </label>
          ))}
        </div>
      ) : null}

      {["ISIAN_SINGKAT", "CLOZE", "ESAI", "MULTI_SELECT"].includes(question.type) ? (
        <div className="grid gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-2">
          {question.type === "ISIAN_SINGKAT" || question.type === "CLOZE" ? (
            <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
              Kunci jawaban
              <input value={question.expectedAnswer} onChange={(event) => onPatchQuestion(question.key, { expectedAnswer: event.target.value })} placeholder="Jawaban benar" dir="auto" className="mt-2 tailadmin-input" />
            </label>
          ) : null}
          <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Validasi jawaban
            <select value={question.validationType} onChange={(event) => onPatchQuestion(question.key, { validationType: event.target.value })} className="mt-2 tailadmin-input">
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
                {question.validationType === "NUMBER" ? "Nilai minimum" : question.validationType === "CHECKBOX" ? "Jumlah pilihan minimum" : "Panjang minimum"}
                <input type="number" min={0} value={question.validationMin} onChange={(event) => onPatchQuestion(question.key, { validationMin: event.target.value })} className="mt-2 tailadmin-input" />
              </label>
              <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                {question.validationType === "NUMBER" ? "Nilai maksimum" : question.validationType === "CHECKBOX" ? "Jumlah pilihan maksimum" : "Panjang maksimum"}
                <input type="number" min={0} value={question.validationMax} onChange={(event) => onPatchQuestion(question.key, { validationMax: event.target.value })} className="mt-2 tailadmin-input" />
              </label>
            </>
          ) : null}
          {question.validationType === "TEXT" ? (
            <>
              <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                Pola regex
                <input value={question.validationPattern} onChange={(event) => onPatchQuestion(question.key, { validationPattern: event.target.value })} placeholder="Contoh: ^[A-Z]{3}$" dir="auto" className="mt-2 tailadmin-input" />
              </label>
              <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                Pesan bila tidak sesuai
                <input value={question.validationMessage} onChange={(event) => onPatchQuestion(question.key, { validationMessage: event.target.value })} dir="auto" className="mt-2 tailadmin-input" />
              </label>
            </>
          ) : null}
        </div>
      ) : null}

      <input
        value={question.explanation}
        onChange={(event) => onPatchQuestion(question.key, { explanation: event.target.value })}
        placeholder="Pembahasan / feedback (opsional, tampil setelah submit)"
        aria-label={`Pembahasan soal ${index + 1}`}
        dir="auto"
        className="tailadmin-input"
      />

      <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3">
        <label className="flex items-center gap-2 text-theme-sm text-gray-700">
          <input type="checkbox" checked={question.required} onChange={(event) => onPatchQuestion(question.key, { required: event.target.checked })} className="accent-limo-blue-500" />
          Wajib diisi
        </label>
        <label className="flex items-center gap-2 text-theme-sm text-gray-700">
          Poin
          <input type="number" min={0.1} step={0.1} value={question.points} onChange={(event) => onPatchQuestion(question.key, { points: Number(event.target.value) || 1 })} className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-theme-sm" />
        </label>
        {questionHasOptions(question.type) || question.type === "GRID" ? (
          <label className="flex items-center gap-2 text-theme-sm text-gray-700">
            <input type="checkbox" checked={question.shuffleOptions} onChange={(event) => onPatchQuestion(question.key, { shuffleOptions: event.target.checked })} className="accent-limo-blue-500" />
            Acak urutan opsi
          </label>
        ) : null}
      </div>
    </>
  );
}
