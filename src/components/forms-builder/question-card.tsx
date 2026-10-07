"use client";

import { useState } from "react";
import { formatUiLabel } from "@/lib/ui-labels";
import { questionTypesByGroup } from "@/lib/question-types";
import { questionKeySummary } from "@/components/forms-builder/form-state";
import { AnswerKeyExtras, FileUploadConfig, GridEditor, MatchingEditor, OptionsEditor, RubricEditor, ScaleEditor, SequenceEditor } from "@/components/forms-builder/editors";
import type { QuizQuestion, QuizSection } from "@/lib/quiz-builder";

const QUESTION_TYPE_GROUPS = questionTypesByGroup();

export function QuestionCard({ question, index, active, sections, onFocus, onPatch, onChangeType, onDelete, onDuplicate, onMove, store }: {
  question: QuizQuestion;
  index: number;
  active: boolean;
  sections: QuizSection[];
  onFocus: () => void;
  onPatch: (_key: string, _patch: Partial<QuizQuestion>) => void;
  onChangeType: (_key: string, _type: string) => void;
  onDelete: (_key: string) => void;
  onDuplicate: (_key: string) => void;
  onMove: (_key: string, _direction: -1 | 1) => void;
  store: {
    sections: QuizSection[];
    updateScale: (_key: string, _patch: { scaleMin?: number; scaleMax?: number; scaleMinLabel?: string; scaleMaxLabel?: string; expectedAnswer?: string }) => void;
    addGridRow: (_key: string) => void;
    updateGridRow: (_key: string, _index: number, _value: string) => void;
    removeGridRow: (_key: string, _index: number) => void;
    setGridCorrect: (_key: string, _index: number, _label: string) => void;
    moveGridRow: (_key: string, _index: number, _direction: -1 | 1) => void;
    moveOption: (_key: string, _index: number, _direction: -1 | 1) => void;
    updateOption: (_key: string, _index: number, _patch: Partial<QuizQuestion["options"][number]>) => void;
    addOption: (_key: string) => void;
    removeOption: (_key: string, _index: number) => void;
    uploadOptionMedia: (_key: string, _index: number, _file: File) => void;
    addPair: (_key: string) => void;
    setPair: (_key: string, _index: number, _field: "left" | "right", _value: string) => void;
    clearPairMedia: (_key: string, _index: number, _field: "left" | "right") => void;
    uploadPairMedia: (_key: string, _index: number, _field: "left" | "right", _file: File) => void;
    removePair: (_key: string, _index: number) => void;
    addSequenceItem: (_key: string) => void;
    setSequenceItem: (_key: string, _index: number, _value: string) => void;
    removeSequenceItem: (_key: string, _index: number) => void;
    addRubricRow: (_key: string) => void;
    setRubricRow: (_key: string, _index: number, _patch: Partial<QuizQuestion["rubric"][number]>) => void;
    removeRubricRow: (_key: string, _index: number) => void;
    setBranchRule: (_questionKey: string, _label: string, _goToSectionKey: string | null) => void;
    uploadMedia: (_key: string, _file: File) => void;
    reorderQuestion: (_dragKey: string, _targetKey: string) => void;
  };
}) {
  const [keyMode, setKeyMode] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const summary = questionKeySummary(question);

  return (
    <article
      onMouseDown={onFocus}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        const dragKey = event.dataTransfer.getData("text/limo-question");
        if (dragKey) store.reorderQuestion(dragKey, question.key);
      }}
      className={`rounded-2xl border bg-white transition ${active ? "border-limo-blue-200 shadow-theme-md" : "border-gray-200/80 opacity-80 shadow-theme-xs hover:opacity-100"}`}
    >
      {active ? (
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span
              draggable
              onDragStart={(event) => event.dataTransfer.setData("text/limo-question", question.key)}
              onDragEnd={(event) => event.dataTransfer.clearData("text/limo-question")}
              role="button"
              tabIndex={0}
              aria-label={`Tarik untuk mengurutkan soal ${index + 1}`}
              className="flex size-8 cursor-grab select-none items-center justify-center rounded-lg text-gray-300 hover:bg-gray-100 hover:text-gray-400"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-4"><circle cx="9" cy="7" r="1.6" /><circle cx="15" cy="7" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="17" r="1.6" /><circle cx="15" cy="17" r="1.6" /></svg>
            </span>
            <textarea
              value={question.question}
              onChange={(event) => onPatch(question.key, { question: event.target.value })}
              placeholder="Pertanyaan tanpa judul"
              aria-label={`Pertanyaan soal ${index + 1}`}
              dir="auto"
              rows={Math.max(1, Math.ceil(question.question.length / 80))}
              className="min-w-0 flex-1 resize-none border-0 border-b border-gray-100 bg-transparent px-1 py-1 text-theme-md font-medium text-gray-900 placeholder:text-gray-400 focus:border-limo-blue-500 focus:outline-none"
            />
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => onDuplicate(question.key)} aria-label="Duplikat soal" title="Duplikat" className="grid size-9 place-items-center rounded-full text-gray-400 hover:bg-gray-100">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4.5" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
              </button>
              <button type="button" onClick={() => onDelete(question.key)} disabled={index === 0 && store.sections.length === 1} aria-label="Hapus soal" title="Hapus" className="grid size-9 place-items-center rounded-full text-gray-400 hover:bg-error-50 hover:text-error-600 disabled:opacity-30">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4.5" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
              </button>
              <button type="button" onClick={() => onMove(question.key, -1)} aria-label="Naikkan soal" className="grid size-9 place-items-center rounded-full text-gray-400 hover:bg-gray-100">↑</button>
              <button type="button" onClick={() => onMove(question.key, 1)} aria-label="Turunkan soal" className="grid size-9 place-items-center rounded-full text-gray-400 hover:bg-gray-100">↓</button>
            </div>
          </div>

          <input
            value={question.helpText}
            onChange={(event) => onPatch(question.key, { helpText: event.target.value })}
            placeholder="Deskripsi (opsional)"
            aria-label={`Deskripsi soal ${index + 1}`}
            dir="auto"
            className="mt-1 w-full border-0 bg-transparent px-1 py-1 text-theme-sm text-gray-500 placeholder:text-gray-300 focus:outline-none"
          />

          <div className="mt-3">
            {question.mediaUrl && question.mediaUrl.startsWith("/api/v1/public/quiz-media/") ? (
              <span className="mb-2 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-theme-xs text-gray-600">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={question.mediaUrl} alt="Gambar soal" className="h-10 w-10 rounded object-cover" />
                <button type="button" onClick={() => onPatch(question.key, { mediaUrl: "" })} className="font-semibold text-error-600">Hapus gambar</button>
              </span>
            ) : null}
            <div className="flex flex-wrap items-center gap-3 text-theme-xs">
              <label className="cursor-pointer rounded-lg px-2 py-1 font-semibold text-limo-blue-700 hover:bg-limo-blue-50">
                {question.mediaUrl && question.mediaUrl.startsWith("/api/v1/public/quiz-media/") ? "Ganti gambar" : "+ Gambar soal"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) store.uploadMedia(question.key, file); }} />
              </label>
              <input
                value={question.mediaUrl.startsWith("/api/v1/public/quiz-media/") ? "" : question.mediaUrl}
                onChange={(event) => onPatch(question.key, { mediaUrl: event.target.value })}
                placeholder="Tautan media / YouTube (opsional)"
                aria-label={`Tautan media soal ${index + 1}`}
                dir="auto"
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-theme-xs focus:border-limo-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-3 grid gap-3">
            {["PILIHAN_GANDA", "MULTI_SELECT", "DROPDOWN", "GRID"].includes(question.type) ? (
              <div className="grid gap-2">
                {question.type === "GRID" ? (
                  <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Kolom pilihan</p>
                ) : null}
                <OptionsEditor
                  question={question}
                  onPatch={onPatch}
                  onMoveOption={store.moveOption}
                  onUpdateOption={store.updateOption}
                  onAddOption={store.addOption}
                  onRemoveOption={store.removeOption}
                  onUploadOptionMedia={store.uploadOptionMedia}
                />
              </div>
            ) : null}
            {question.type === "GRID" ? (
              <GridEditor question={question} onPatch={onPatch} onMoveGridRow={store.moveGridRow} onUpdateGridRow={store.updateGridRow} onSetGridCorrect={store.setGridCorrect} onAddGridRow={store.addGridRow} onRemoveGridRow={store.removeGridRow} />
            ) : null}
            {["SKALA", "RATING"].includes(question.type) ? (
              <ScaleEditor question={question} onUpdateScale={store.updateScale} />
            ) : null}
            {question.type === "MENJODOHKAN" ? (
              <MatchingEditor question={question} onSetPair={store.setPair} onClearPairMedia={store.clearPairMedia} onUploadPairMedia={store.uploadPairMedia} onAddPair={store.addPair} onRemovePair={store.removePair} />
            ) : null}
            {question.type === "URUTAN" ? (
              <SequenceEditor question={question} onSetSequenceItem={store.setSequenceItem} onAddSequenceItem={store.addSequenceItem} onRemoveSequenceItem={store.removeSequenceItem} />
            ) : null}
            {question.type === "ESAI" ? (
              <p className="rounded-xl bg-gray-50 px-4 py-3 text-theme-sm text-gray-500">Jawaban paragraf panjang — dinilai manual oleh guru.</p>
            ) : null}
            {["SPEAKING", "WRITING", "ROLEPLAY", "GAMBAR", "LISTENING", "READING"].includes(question.type) ? (
              <RubricEditor question={question} onSetRubricRow={store.setRubricRow} onAddRubricRow={store.addRubricRow} onRemoveRubricRow={store.removeRubricRow} />
            ) : null}
            {question.type === "FILE_UPLOAD" ? (
              <FileUploadConfig question={question} onPatch={onPatch} />
            ) : null}
          </div>

          {keyMode ? (
            <div className="mt-4 rounded-2xl border border-success-200 bg-success-50/50 p-4">
              <p className="text-theme-sm font-semibold text-success-700">Kunci jawaban</p>
              <div className="mt-3">
                <AnswerKeyExtras question={question} onPatch={onPatch} sections={store.sections} onSetBranchRule={store.setBranchRule} />
                {summary && ["ESAI", "FILE_UPLOAD", "GAMBAR", "LISTENING", "READING", "SPEAKING", "WRITING", "ROLEPLAY"].includes(question.type) ? (
                  <p className="text-theme-xs text-gray-500">{summary} — kunci diatur saat koreksi hasil.</p>
                ) : null}
                <div className="mt-3 grid gap-3 rounded-xl border border-success-100 bg-white p-3 sm:grid-cols-2">
                  <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                    Umpan balik jika benar
                    <textarea value={question.feedbackCorrect} onChange={(event) => onPatch(question.key, { feedbackCorrect: event.target.value })} dir="auto" rows={2} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
                  </label>
                  <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                    Umpan balik jika salah
                    <textarea value={question.feedbackIncorrect} onChange={(event) => onPatch(question.key, { feedbackIncorrect: event.target.value })} dir="auto" rows={2} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
                  </label>
                  <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500 sm:col-span-2">
                    Pembahasan (tampil setelah submit bila diizinkan)
                    <input value={question.explanation} onChange={(event) => onPatch(question.key, { explanation: event.target.value })} dir="auto" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
                  </label>
                </div>
              </div>
            </div>
          ) : null}

          {metaOpen ? (
            <div className="mt-3 rounded-2xl border border-gray-200 p-4">
              <p className="text-theme-sm font-semibold text-gray-700">Metadata & pedagogi</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                  Bahasa konten
                  <input value={question.language} onChange={(event) => onPatch(question.key, { language: event.target.value })} aria-label={`Bahasa konten soal ${index + 1}`} dir="auto" placeholder="id, ar, en" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
                </label>
                <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                  Arah konten
                  <select value={question.direction} onChange={(event) => onPatch(question.key, { direction: event.target.value })} aria-label={`Arah konten soal ${index + 1}`} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none">
                    <option value="">Otomatis</option>
                    <option value="ltr">LTR</option>
                    <option value="rtl">RTL Arab</option>
                  </select>
                </label>
                <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                  Level kognitif
                  <select value={question.cognitiveLevel} onChange={(event) => onPatch(question.key, { cognitiveLevel: event.target.value })} aria-label={`Level kognitif soal ${index + 1}`} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none">
                    <option value="LOTS">LOTS — Pemahaman dasar</option>
                    <option value="MOTS">MOTS — Penerapan</option>
                    <option value="HOTS">HOTS — Analisis/evaluasi</option>
                  </select>
                </label>
                <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                  Kesulitan
                  <select value={question.difficulty} onChange={(event) => onPatch(question.key, { difficulty: event.target.value })} aria-label={`Kesulitan soal ${index + 1}`} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none">
                    <option value="EASY">Mudah</option>
                    <option value="MEDIUM">Sedang</option>
                    <option value="HARD">Sulit</option>
                  </select>
                </label>
                <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                  Tipe asesmen
                  <select value={question.assessmentType} onChange={(event) => onPatch(question.key, { assessmentType: event.target.value })} aria-label={`Tipe asesmen soal ${index + 1}`} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none">
                    <option value="FORMATIVE">Formatif</option>
                    <option value="SUMMATIVE">Sumatif</option>
                    <option value="PLACEMENT">Penempatan</option>
                    <option value="DIAGNOSTIC">Diagnostik</option>
                  </select>
                </label>
                <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                  Standar / kurikulum (opsional)
                  <input value={question.standard} onChange={(event) => onPatch(question.key, { standard: event.target.value })} aria-label={`Standar soal ${index + 1}`} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
                </label>
              </div>
            </div>
          ) : null}

          {["READING", "LISTENING", "CLOZE", "GAMBAR", "ROLEPLAY", "SPEAKING", "WRITING"].includes(question.type) ? (
            <label className="mt-3 block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
              Stimulus / bacaan / konteks
              <textarea value={question.stimulusText} onChange={(event) => onPatch(question.key, { stimulusText: event.target.value })} aria-label={`Stimulus soal ${index + 1}`} dir="auto" rows={3} placeholder="Teks bacaan, dialog, instruksi audio, atau konteks roleplay" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
            </label>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
            <div className="flex flex-wrap items-center gap-1">
              <select value={question.type} onChange={(event) => onChangeType(question.key, event.target.value)} aria-label={`Tipe soal ${index + 1}`} className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-theme-sm text-gray-700 hover:bg-gray-100 focus:border-limo-blue-500 focus:outline-none">
                {QUESTION_TYPE_GROUPS.map((entry) => (
                  <optgroup key={entry.group} label={entry.group}>
                    {entry.types.map((value) => <option key={value} value={value}>{formatUiLabel(value)}</option>)}
                  </optgroup>
                ))}
              </select>
              <button type="button" onClick={() => setKeyMode((current) => !current)} aria-pressed={keyMode} className={`rounded-lg px-3 py-1.5 text-theme-sm font-semibold ${keyMode ? "bg-success-50 text-success-700" : "text-gray-600 hover:bg-gray-100"}`}>
                Kunci jawaban
              </button>
              <button type="button" onClick={() => setMetaOpen((current) => !current)} aria-expanded={metaOpen} className={`rounded-lg px-3 py-1.5 text-theme-sm font-semibold ${metaOpen ? "bg-limo-blue-50 text-limo-blue-700" : "text-gray-600 hover:bg-gray-100"}`}>
                Metadata
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {sections.length > 1 ? (
                <select value={question.sectionKey} onChange={(event) => onPatch(question.key, { sectionKey: event.target.value })} aria-label={`Bagian soal ${index + 1}`} className="rounded-lg border border-gray-200 px-2 py-1.5 text-theme-xs text-gray-600 focus:border-limo-blue-500 focus:outline-none">
                  {sections.map((section, sectionIndex) => <option key={section.key} value={section.key}>Bagian {sectionIndex + 1}: {section.title}</option>)}
                </select>
              ) : null}
              <label className="flex items-center gap-1 text-theme-xs font-semibold text-gray-600">
                Poin
                <input type="number" min={0.1} step={0.1} value={question.points} onChange={(event) => onPatch(question.key, { points: Number(event.target.value) || 1 })} aria-label={`Poin soal ${index + 1}`} className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-theme-sm" />
              </label>
              <label className="flex cursor-pointer items-center gap-1 text-theme-xs font-semibold text-gray-600">
                <input type="checkbox" checked={question.required} onChange={(event) => onPatch(question.key, { required: event.target.checked })} className="accent-limo-blue-500" />
                Wajib
              </label>
              {["PILIHAN_GANDA", "MULTI_SELECT", "DROPDOWN", "GRID"].includes(question.type) ? (
                <label className="flex cursor-pointer items-center gap-1 text-theme-xs font-semibold text-gray-600">
                  <input type="checkbox" checked={question.shuffleOptions} onChange={(event) => onPatch(question.key, { shuffleOptions: event.target.checked })} className="accent-limo-blue-500" />
                  Acak opsi
                </label>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <button type="button" onClick={onFocus} className="w-full p-5 text-left">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 flex-1 truncate text-theme-md font-medium text-gray-800" dir="auto">
              {question.question.trim() || `Pertanyaan ${index + 1}`}
            </p>
            <span className="shrink-0 rounded-full bg-gray-50 px-2.5 py-1 text-theme-xs font-semibold text-gray-500">{formatUiLabel(question.type)}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-theme-xs text-gray-400">
            {question.required ? <span className="text-error-500">* Wajib</span> : null}
            <span>{question.points} poin</span>
            {summary ? <span className={summary.includes("belum") ? "text-warning-600" : ""}>{summary}</span> : null}
          </div>
        </button>
      )}
    </article>
  );
}
