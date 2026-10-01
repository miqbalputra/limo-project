"use client";

import { useState } from "react";
import { ShareExamButton } from "@/components/dashboard/share-exam-button";
import { QuizPreview } from "@/components/dashboard/quiz-preview";
import { formatUiLabel } from "@/lib/ui-labels";
import { questionTypesByGroup } from "@/lib/question-types";
import { BuilderSettingsPanel } from "@/components/builder/builder-settings-panel";
import { BuilderHeaderCard } from "@/components/builder/builder-header-card";
import { QuestionOptionsEditor } from "@/components/builder/question-options-editor";
import { QuestionGridEditor, QuestionScaleEditor } from "@/components/builder/question-grid-scale-editors";
import { QuestionMatchingEditor, QuestionSequenceEditor, QuestionRubricEditor, QuestionMetaPanel } from "@/components/builder/question-structure-editors";
import { QuestionExtraFields } from "@/components/builder/question-extra-fields";
import { QuestionSectionManager } from "@/components/builder/question-section-manager";
import { BankSoalPicker, ImportQuestions } from "@/components/builder/question-source-panels";
import { useFormBuilder } from "@/components/dashboard/use-form-builder";
import { CHOICE_TYPES, MANUAL_TYPES, SCALE_TYPES, STIMULUS_TYPES, newQuestion, type QuizFormState } from "@/lib/quiz-builder";

type KelasOption = { id: string; name: string };

const QUESTION_TYPE_GROUPS = questionTypesByGroup();
const ALL_QUESTION_TYPES = QUESTION_TYPE_GROUPS.flatMap((entry) => entry.types);

export function QuizBuilder({
  ujianId,
  status,
  shareToken,
  initial,
  kelasOptions,
  importOptions = [],
}: {
  ujianId?: string;
  status?: string;
  shareToken?: string | null;
  initial: QuizFormState;
  kelasOptions: KelasOption[];
  importOptions?: { id: string; title: string }[];
}) {
  const {
    form,
    id,
    currentStatus,
    saveState,
    error,
    notice,
    busy,
    setBusy,
    setError,
    setForm,
    historyDepth,
    patchForm,
    patchQuestion,
    changeType,
    updateScale,
    addGridRow,
    updateGridRow,
    removeGridRow,
    setGridCorrect,
    addSection,
    patchSection,
    removeSection,
    moveSection,
    setBranchRule,
    addPair,
    setPair,
    removePair,
    addSequenceItem,
    setSequenceItem,
    removeSequenceItem,
    addRubricRow,
    setRubricRow,
    removeRubricRow,
    uploadMedia,
    uploadHeaderImage,
    uploadOptionMedia,
    duplicateForm,
    duplicateQuestion,
    removeQuestion,
    moveQuestion,
    reorderQuestion,
    moveOption,
    moveGridRow,
    updateOption,
    addOption,
    removeOption,
    save,
    undo,
    redo,
  } = useFormBuilder({ ujianId, status, initial });

  const [tab, setTab] = useState<"questions" | "settings">("questions");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [collapsedQuestions, setCollapsedQuestions] = useState<Record<string, boolean>>({});
  const [questionSearch, setQuestionSearch] = useState("");
  const [dragOption, setDragOption] = useState<{ key: string; index: number } | null>(null);
  const [dragRow, setDragRow] = useState<{ key: string; index: number } | null>(null);

  const questionTerm = questionSearch.trim().toLowerCase();
  const visibleQuestionEntries = form.questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => !questionTerm
      || question.question.toLowerCase().includes(questionTerm)
      || question.helpText.toLowerCase().includes(questionTerm));

  function addQuestion(type = "PILIHAN_GANDA") {
    setForm((current) => ({ ...current, questions: [...current.questions, newQuestion(type, current.sections[current.sections.length - 1]?.key ?? "")] }));
    setTab("questions");
  }

  return (
    <div className="space-y-4">
      <BuilderHeaderCard
        status={currentStatus}
        saveState={saveState}
        canUndo={historyDepth.undo > 1}
        canRedo={historyDepth.redo > 0}
        formId={id}
        busy={busy}
        form={form}
        kelasOptions={kelasOptions}
        onPatch={patchForm}
        onUndo={undo}
        onRedo={redo}
        onPreview={() => setPreviewOpen(true)}
        onDuplicate={() => void duplicateForm()}
        onSave={() => void save()}
        onPublish={async () => {
          setBusy(true);
          await save({ publish: true });
          setBusy(false);
        }}
      />

      <div className="flex gap-2">
        <button type="button" onClick={() => setTab("questions")} className={tab === "questions" ? "tailadmin-button-primary px-4 py-2" : "tailadmin-button-outline px-4 py-2"}>Pertanyaan</button>
        <button type="button" onClick={() => setTab("settings")} className={tab === "settings" ? "tailadmin-button-primary px-4 py-2" : "tailadmin-button-outline px-4 py-2"}>Pengaturan</button>
      </div>

      {error ? <p className="tailadmin-alert-error" role="alert">{error}</p> : null}
      {notice ? <p className="tailadmin-alert-success" role="status">{notice}</p> : null}

      {tab === "questions" ? (
        <div className="space-y-3">
          <QuestionSectionManager sections={form.sections} onAdd={addSection} onPatch={patchSection} onRemove={removeSection} onMove={moveSection} />

          {id && importOptions.length > 0 ? (
            <ImportQuestions formId={id} options={importOptions} onError={setError} />
          ) : null}

          {form.questions.length > 1 ? (
            <div className="tailadmin-card flex flex-wrap items-center gap-3 p-4">
              <input value={questionSearch} onChange={(event) => setQuestionSearch(event.target.value)} placeholder="Cari soal berdasarkan pertanyaan atau petunjuk" aria-label="Cari soal" className="tailadmin-input sm:max-w-sm" />
              <span className="text-theme-xs text-gray-500">{questionTerm ? `${visibleQuestionEntries.length} dari ${form.questions.length} soal cocok` : `${form.questions.length} soal`}</span>
            </div>
          ) : null}

          {id ? (
            <BankSoalPicker formId={id} onError={setError} />
          ) : null}

          {visibleQuestionEntries.map(({ question, index }) => (
            <article
              key={question.key}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragKey) reorderQuestion(dragKey, question.key);
                setDragKey(null);
              }}
              className={`tailadmin-card p-5 transition ${dragKey === question.key ? "opacity-50 ring-2 ring-limo-blue-300" : ""}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    draggable
                    onDragStart={() => setDragKey(question.key)}
                    onDragEnd={() => setDragKey(null)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Tarik untuk mengurutkan soal ${index + 1}`}
                    className="flex min-h-11 min-w-11 cursor-grab select-none items-center justify-center rounded-lg border border-gray-200 text-theme-xs text-gray-400 hover:bg-gray-50"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-4"><circle cx="9" cy="7" r="1.6" /><circle cx="15" cy="7" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="17" r="1.6" /><circle cx="15" cy="17" r="1.6" /></svg>
                  </span>
                  <p className="text-theme-sm font-bold text-gray-700">Soal {index + 1}</p>
                  {question.question.trim() ? <span className="hidden max-w-48 truncate text-theme-xs text-gray-400 sm:inline">· {question.question}</span> : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => setCollapsedQuestions((current) => ({ ...current, [question.key]: !current[question.key] }))} aria-expanded={!collapsedQuestions[question.key]} aria-label={`${collapsedQuestions[question.key] ? "Buka" : "Lipat"} soal ${index + 1}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50">{collapsedQuestions[question.key] ? "Buka" : "Lipat"}</button>
                  <button type="button" onClick={() => moveQuestion(question.key, -1)} disabled={index === 0} aria-label="Naikkan soal" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">↑</button>
                  <button type="button" onClick={() => moveQuestion(question.key, 1)} disabled={index === form.questions.length - 1} aria-label="Turunkan soal" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">↓</button>
                  <button type="button" onClick={() => duplicateQuestion(question.key)} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50">Duplikat</button>
                  <button type="button" onClick={() => removeQuestion(question.key)} disabled={form.questions.length <= 1} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-error-200 px-3 text-theme-xs text-error-600 hover:bg-error-50 disabled:opacity-40">Hapus</button>
                </div>
              </div>

              {collapsedQuestions[question.key] ? null : (
              <div className="mt-3 grid gap-3">
                <select value={question.type} onChange={(event) => changeType(question.key, event.target.value)} aria-label={`Tipe soal ${index + 1}`} className="tailadmin-input sm:max-w-xs">
                  {QUESTION_TYPE_GROUPS.map((entry) => (
                    <optgroup key={entry.group} label={entry.group}>
                      {entry.types.map((value) => <option key={value} value={value}>{formatUiLabel(value)}</option>)}
                    </optgroup>
                  ))}
                </select>

                {form.sections.length > 1 ? (
                  <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                    Bagian soal ini
                    <select value={question.sectionKey} onChange={(event) => patchQuestion(question.key, { sectionKey: event.target.value })} className="mt-1 tailadmin-input sm:max-w-xs">
                      {form.sections.map((section, sectionIndex) => <option key={section.key} value={section.key}>Bagian {sectionIndex + 1}: {section.title}</option>)}
                    </select>
                  </label>
                ) : null}

                <textarea
                  value={question.question}
                  onChange={(event) => patchQuestion(question.key, { question: event.target.value })}
                  placeholder="Tulis pertanyaan"
                  aria-label={`Pertanyaan soal ${index + 1}`}
                  dir="auto"
                  rows={2}
                  className="tailadmin-input"
                />

                <input
                  value={question.helpText}
                  onChange={(event) => patchQuestion(question.key, { helpText: event.target.value })}
                  placeholder="Deskripsi / petunjuk soal (opsional)"
                  aria-label={`Deskripsi soal ${index + 1}`}
                  dir="auto"
                  className="tailadmin-input"
                />

                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                    Gambar soal (opsional)
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadMedia(question.key, file);
                        event.target.value = "";
                      }}
                      className="mt-1 block text-theme-xs"
                    />
                  </label>
                  {question.mediaUrl ? (
                    <span className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-theme-xs text-gray-600">
                      {question.mediaUrl.startsWith("/api/v1/public/quiz-media/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={question.mediaUrl} alt="Gambar soal" className="h-10 w-10 rounded object-cover" />
                      ) : null}
                      <button type="button" onClick={() => patchQuestion(question.key, { mediaUrl: "" })} className="font-semibold text-error-600">Hapus gambar</button>
                    </span>
                  ) : null}
                </div>

                <input
                  value={question.mediaUrl.startsWith("/api/v1/public/quiz-media/") ? "" : question.mediaUrl}
                  onChange={(event) => patchQuestion(question.key, { mediaUrl: event.target.value })}
                  placeholder="Tautan media / YouTube (opsional) — akan ditampilkan sebagai video/gambar"
                  aria-label={`Tautan media soal ${index + 1}`}
                  dir="auto"
                  className="tailadmin-input"
                />

                {CHOICE_TYPES.has(question.type) || question.type === "GRID" ? (
                  <QuestionOptionsEditor
                    question={question}
                    index={index}
                    dragOption={dragOption}
                    onDragOptionChange={setDragOption}
                    onMoveOption={moveOption}
                    onUpdateOption={updateOption}
                    onAddOption={addOption}
                    onRemoveOption={removeOption}
                    onUploadOptionMedia={uploadOptionMedia}
                    onPatchQuestion={patchQuestion}
                  />
                ) : null}

                {question.type === "GRID" ? (
                  <QuestionGridEditor
                    question={question}
                    dragRow={dragRow}
                    onDragRowChange={setDragRow}
                    onMoveGridRow={moveGridRow}
                    onUpdateGridRow={updateGridRow}
                    onSetGridCorrect={setGridCorrect}
                    onAddGridRow={addGridRow}
                    onRemoveGridRow={removeGridRow}
                    onPatchQuestion={patchQuestion}
                  />
                ) : null}

                {SCALE_TYPES.has(question.type) ? (
                  <QuestionScaleEditor question={question} onUpdateScale={updateScale} onPatchQuestion={patchQuestion} />
                ) : null}

                {question.type === "TANGGAL" || question.type === "WAKTU" ? (
                  <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                    Kunci jawaban
                    <input type={question.type === "TANGGAL" ? "date" : "time"} value={question.expectedAnswer} onChange={(event) => patchQuestion(question.key, { expectedAnswer: event.target.value })} className="mt-2 tailadmin-input sm:max-w-xs" />
                  </label>
                ) : null}

                {["ISIAN_SINGKAT", "CLOZE", "TANGGAL", "WAKTU"].includes(question.type) ? (
                  <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                    Kunci alternatif yang juga diterima (opsional, satu per baris)
                    <textarea
                      value={question.acceptedAnswers.join("\n")}
                      onChange={(event) => patchQuestion(question.key, { acceptedAnswers: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })}
                      dir="auto"
                      rows={2}
                      placeholder="Contoh:&#10;DKI Jakarta&#10;jakarta"
                      className="mt-2 tailadmin-input"
                    />
                  </label>
                ) : null}

                {STIMULUS_TYPES.has(question.type) ? (
                  <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                    Stimulus / bacaan / konteks
                    <textarea value={question.stimulusText} onChange={(event) => patchQuestion(question.key, { stimulusText: event.target.value })} aria-label={`Stimulus soal ${index + 1}`} dir="auto" rows={3} placeholder="Teks bacaan, dialog, instruksi audio, atau konteks roleplay" className="mt-2 tailadmin-input" />
                  </label>
                ) : null}

                {question.type === "MENJODOHKAN" ? (
                  <QuestionMatchingEditor
                    question={question}
                    index={index}
                    onSetPair={setPair}
                    onAddPair={addPair}
                    onRemovePair={removePair}
                  />
                ) : null}

                {question.type === "URUTAN" ? (
                  <QuestionSequenceEditor
                    question={question}
                    index={index}
                    onSetSequenceItem={setSequenceItem}
                    onAddSequenceItem={addSequenceItem}
                    onRemoveSequenceItem={removeSequenceItem}
                  />
                ) : null}

                {MANUAL_TYPES.has(question.type) ? (
                  <QuestionRubricEditor
                    question={question}
                    index={index}
                    onSetRubricRow={setRubricRow}
                    onAddRubricRow={addRubricRow}
                    onRemoveRubricRow={removeRubricRow}
                  />
                ) : null}

                <QuestionMetaPanel question={question} index={index} onPatchQuestion={patchQuestion} />

                <QuestionExtraFields
                  question={question}
                  index={index}
                  sections={form.sections}
                  onPatchQuestion={patchQuestion}
                  onSetBranchRule={setBranchRule}
                />
              </div>
              )}
            </article>
          ))}

          <section className="tailadmin-card p-4">
            <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Tambah soal</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_QUESTION_TYPES.map((value) => (
                <button key={value} type="button" onClick={() => addQuestion(value)} className="tailadmin-button-outline px-3 py-2 text-theme-xs">+ {formatUiLabel(value)}</button>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <BuilderSettingsPanel form={form} onPatch={patchForm} onUploadHeaderImage={uploadHeaderImage} />
      )}

      {currentStatus === "PUBLISHED" && id ? (
        <section className="tailadmin-card p-5">
          <h2 className="font-semibold text-gray-900">Bagikan kuis</h2>
          <p className="mt-1 text-theme-xs text-gray-500">Tautan publik untuk dikerjakan tanpa login, atau dibagikan ke wali/siswa.</p>
          <div className="mt-3"><ShareExamButton ujianId={id} hasToken={Boolean(shareToken)} /></div>
        </section>
      ) : null}

      {previewOpen ? <QuizPreview form={form} onClose={() => setPreviewOpen(false)} /> : null}
    </div>
  );
}
