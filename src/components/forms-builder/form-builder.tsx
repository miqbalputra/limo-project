"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatUiLabel } from "@/lib/ui-labels";
import { QUESTION_TYPE_VALUES, questionTypeMeta } from "@/lib/question-types";
import { CHOICE_TYPES, type QuizFormState, type QuizQuestion } from "@/lib/quiz-builder";
import { useFormBuilderStore } from "@/components/forms-builder/form-store";
import { QuestionCard } from "@/components/forms-builder/question-card";
import { BankSoalSheet, ImportSheet, PreflightSheet, SettingsSheet, ShareSheet } from "@/components/forms-builder/sheets";
import { ThemeHeaderPreview } from "@/components/forms-builder/theme";

type SheetKind = null | "settings" | "preflight" | "share" | "bank" | "import";

const ADD_LABELS: Record<string, string> = {
  PILIHAN_GANDA: "Pilihan ganda",
  MULTI_SELECT: "Kotak centang",
  DROPDOWN: "Dropdown",
  BENAR_SALAH: "Benar/Salah",
  ISIAN_SINGKAT: "Isian singkat",
  ESAI: "Paragraf",
  CLOZE: "Isian celah",
  SKALA: "Skala linier",
  RATING: "Rating bintang",
  GRID: "Kisi-kisi",
  TANGGAL: "Tanggal",
  WAKTU: "Waktu",
  FILE_UPLOAD: "Unggah berkas",
  MENJODOHKAN: "Menjodohkan",
  URUTAN: "Urutkan",
  GAMBAR: "Gambar",
  LISTENING: "Menyimak",
  READING: "Membaca",
  SPEAKING: "Berbicara",
  WRITING: "Menulis",
  ROLEPLAY: "Bermain peran",
};

export function FormsBuilder({ ujianId, status, shareToken, initial, kelasOptions, importOptions }: {
  ujianId?: string;
  status?: string;
  shareToken?: string | null;
  initial: QuizFormState;
  kelasOptions: { id: string; name: string }[];
  importOptions?: { id: string; title: string }[];
}) {
  const store = useFormBuilderStore({ ujianId, status, initial });
  const { form, id, currentStatus, saveState, error, notice, busy, historyDepth, setBusy } = store;
  const [activeKey, setActiveKey] = useState<string | null>(form.questions[0]?.key ?? null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const effectiveActiveKey = form.questions.some((question) => question.key === activeKey) ? activeKey : (form.questions[form.questions.length - 1]?.key ?? null);

  const visibleQuestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return form.questions;
    return form.questions.filter((question) => question.question.toLowerCase().includes(term) || question.helpText.toLowerCase().includes(term));
  }, [form.questions, search]);

  const saveIndicator = saveState === "saving" ? "Menyimpan..." : saveState === "error" ? "Gagal menyimpan" : saveState === "idle" ? "Perubahan belum tersimpan" : "Semua perubahan tersimpan";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="sticky top-0 z-30 -mx-1 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white/95 px-3 py-2 shadow-theme-xs backdrop-blur">
        <Link href="/guru/ujian" aria-label="Kembali ke daftar asesmen" className="grid size-9 place-items-center rounded-full text-gray-500 hover:bg-gray-100">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true"><path d="M19 12H5m0 0 6-6m-6 6 6 6" /></svg>
        </Link>
        <span className="min-w-0 flex-1 truncate text-theme-sm font-semibold text-gray-700">{form.title || "Formulir tanpa judul"}</span>
        <span className={`hidden text-theme-xs font-semibold sm:inline ${saveState === "error" ? "text-error-600" : saveState === "saved" ? "text-success-600" : "text-gray-400"}`} role="status">{saveIndicator}</span>
        <button type="button" onClick={store.undo} disabled={historyDepth.undo <= 1} aria-label="Batalkan (Ctrl+Z)" className="grid size-9 place-items-center rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-30">↺</button>
        <button type="button" onClick={store.redo} disabled={historyDepth.redo <= 0} aria-label="Ulangi (Ctrl+Shift+Z)" className="grid size-9 place-items-center rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-30">↻</button>
        <button type="button" onClick={() => setPreviewOpen(true)} aria-label="Pratinjau formulir" className="grid size-9 place-items-center rounded-full text-gray-500 hover:bg-gray-100">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
        </button>
        <button type="button" onClick={() => setSheet("settings")} aria-label="Pengaturan formulir" className="grid size-9 place-items-center rounded-full text-gray-500 hover:bg-gray-100">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
        </button>
        <button
          type="button"
          onClick={async () => {
            setBusy(true);
            const item = await store.runPreflight();
            setBusy(false);
            if (item) {
              setSheet("preflight");
            }
          }}
          disabled={busy}
          className="tailadmin-button-primary px-5 py-2"
        >
          Kirim
        </button>
        {id && form.title.trim() ? (
          <button type="button" onClick={() => void store.duplicateForm()} aria-label="Duplikat formulir" className="grid size-9 place-items-center rounded-full text-gray-500 hover:bg-gray-100" title="Duplikat formulir">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4.5" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
          </button>
        ) : null}
      </div>

      {error ? <p className="tailadmin-alert-error mt-3" role="alert">{error}</p> : null}
      {notice ? <p className="tailadmin-alert-success mt-3" role="status">{notice}</p> : null}

      {store.restorableDraft ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-warning-200 bg-warning-50 p-4" role="alert">
          <p className="text-theme-sm text-warning-800">Ada draf lokal yang lebih lengkap dari sesi sebelumnya ({store.restorableDraft.questions.length} soal). Pulihkan?</p>
          <div className="flex gap-2">
            <button type="button" onClick={store.restoreDraft} className="tailadmin-button-primary px-4 py-2">Pulihkan draf</button>
            <button type="button" onClick={store.discardDraft} className="tailadmin-button-outline px-4 py-2">Abaikan</button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs">
          <div className="overflow-hidden rounded-xl">
            <ThemeHeaderPreview themeColor={form.themeColor} headerImageUrl={form.headerImageUrl} />
          </div>
          <input
            value={form.title}
            onChange={(event) => store.patchForm({ title: event.target.value })}
            placeholder="Judul formulir"
            aria-label="Judul formulir"
            dir="auto"
            className="mt-4 w-full border-0 border-b-2 border-transparent bg-transparent px-1 pb-1 text-2xl font-bold text-gray-900 placeholder:text-gray-300 hover:border-gray-200 focus:border-limo-blue-500 focus:outline-none"
          />
          <textarea
            value={form.description}
            onChange={(event) => store.patchForm({ description: event.target.value })}
            placeholder="Deskripsi formulir"
            aria-label="Deskripsi formulir"
            dir="auto"
            rows={2}
            className="mt-2 w-full resize-none border-0 bg-transparent px-1 text-theme-sm text-gray-500 placeholder:text-gray-300 focus:outline-none"
          />
          {currentStatus === "PUBLISHED" ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="inline-flex items-center gap-2 rounded-full bg-success-50 px-3 py-1 text-theme-xs font-semibold text-success-700">Sudah publish · <button type="button" className="underline" onClick={() => setSheet("share")}>lihat tautan</button></p>
              <button type="button" onClick={() => void store.closePublication()} disabled={busy} className="text-theme-xs font-semibold text-error-600 underline hover:text-error-700 disabled:opacity-40" title="Tutup publikasi — tautan berhenti menerima jawaban, dapat dibuka lagi kapanpun">
                Tutup publikasi
              </button>
            </div>
          ) : (
            <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-theme-xs font-semibold text-gray-500">Draf · publikasi tertutup, buka lagi lewat tombol Kirim</p>
          )}
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari soal..." aria-label="Cari soal" className="tailadmin-input max-w-xs" />
          {id ? (
            <>
              <button type="button" onClick={() => setSheet("bank")} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Pustaka soal</button>
              {importOptions && importOptions.length > 0 ? <button type="button" onClick={() => setSheet("import")} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Impor dari formulir lain</button> : null}
            </>
          ) : (
            <p className="text-theme-xs text-gray-400">Pustaka & impor tersedia setelah draf tersimpan otomatis.</p>
          )}
        </div>

        {form.sections.map((section, sectionIndex) => {
          const questions = visibleQuestions.filter((question) => question.sectionKey === section.key);
          return (
            <div key={section.key} className="grid gap-3">
              {sectionIndex > 0 ? (
                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">Bagian {sectionIndex + 1}</p>
                      <input value={section.title} onChange={(event) => store.patchSection(section.key, { title: event.target.value })} aria-label={`Judul bagian ${sectionIndex + 1}`} dir="auto" className="mt-1 w-full border-0 border-b border-transparent bg-transparent px-0 pb-1 text-lg font-semibold text-gray-900 focus:border-limo-blue-500 focus:outline-none" />
                      <input value={section.description} onChange={(event) => store.patchSection(section.key, { description: event.target.value })} placeholder="Deskripsi bagian (opsional)" aria-label={`Deskripsi bagian ${sectionIndex + 1}`} dir="auto" className="mt-1 w-full border-0 bg-transparent px-0 text-theme-sm text-gray-500 placeholder:text-gray-300 focus:outline-none" />
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => store.moveSection(section.key, -1)} disabled={sectionIndex === 0} aria-label="Naikkan bagian" className="grid size-9 place-items-center rounded-full text-gray-400 hover:bg-gray-100 disabled:opacity-30">↑</button>
                      <button type="button" onClick={() => store.moveSection(section.key, 1)} disabled={sectionIndex === form.sections.length - 1} aria-label="Turunkan bagian" className="grid size-9 place-items-center rounded-full text-gray-400 hover:bg-gray-100 disabled:opacity-30">↓</button>
                      <button type="button" onClick={() => store.removeSection(section.key)} disabled={form.sections.length <= 1} aria-label={`Hapus bagian ${sectionIndex + 1}`} className="grid size-9 place-items-center rounded-full text-gray-400 hover:bg-error-50 hover:text-error-600 disabled:opacity-30">✕</button>
                    </div>
                  </div>
                </section>
              ) : null}

              {questions.map((question) => (
                <QuestionCard
                  key={question.key}
                  question={question}
                  index={form.questions.findIndex((entry) => entry.key === question.key)}
                  active={effectiveActiveKey === question.key}
                  sections={form.sections}
                  onFocus={() => setActiveKey(question.key)}
                  onPatch={store.patchQuestion}
                  onChangeType={store.changeType}
                  onDelete={store.removeQuestion}
                  onDuplicate={store.duplicateQuestion}
                  onMove={store.moveQuestion}
                  store={{ ...store, sections: form.sections }}
                />
              ))}
              {questions.length === 0 && search.trim() ? <p className="rounded-2xl border border-dashed border-gray-200 p-4 text-center text-theme-sm text-gray-400">Tidak ada soal yang cocok di bagian ini.</p> : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddOpen((current) => !current);
                  }}
                  aria-expanded={addOpen}
                  className="rounded-full border border-limo-blue-200 bg-white px-4 py-2 text-theme-sm font-semibold text-limo-blue-700 shadow-theme-xs hover:bg-limo-blue-50"
                >
                  + Pertanyaan
                </button>
                <button type="button" onClick={store.addSection} className="rounded-full border border-gray-200 bg-white px-4 py-2 text-theme-sm font-semibold text-gray-600 shadow-theme-xs hover:bg-gray-50">
                  + Bagian baru
                </button>
              </div>
              {addOpen ? (
                <div className="grid gap-1.5 rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs sm:grid-cols-2">
                  {QUESTION_TYPE_VALUES.map((value) => (
                    <button key={value} type="button" onClick={() => { store.addQuestion(value); setAddOpen(false); setActiveKey(null); }} className="rounded-xl px-3 py-2 text-left text-theme-sm text-gray-700 hover:bg-limo-blue-50 hover:text-limo-blue-700">
                      <span className="font-medium">{ADD_LABELS[value] ?? formatUiLabel(value)}</span>
                      <span className="block text-theme-xs text-gray-400">{questionTypeMeta(value)?.manualReview ? "Dinilai manual" : questionTypeMeta(value)?.hasOptions ? "Pilihan + kunci" : "Tersimpan di pustaka"}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {sheet === "settings" ? <SettingsSheet form={form} kelasOptions={kelasOptions} onPatch={store.patchForm} onUploadHeaderImage={store.uploadHeaderImage} onClose={() => setSheet(null)} /> : null}
      {sheet === "preflight" && store.preflight ? (
        <PreflightSheet preflight={store.preflight} busy={busy} onPublish={async () => { const published = await store.publishNow(); if (published) { setSheet("share"); } }} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === "share" ? <ShareSheet ujianId={id} shareToken={shareToken ?? null} title={form.title} onClose={() => setSheet(null)} /> : null}
      {sheet === "bank" && id ? <BankSoalSheet formId={id} onBeforeReload={store.flushSave} onClose={() => setSheet(null)} /> : null}
      {sheet === "import" && id ? <ImportSheet formId={id} options={importOptions ?? []} onBeforeReload={store.flushSave} onClose={() => setSheet(null)} /> : null}

      {previewOpen ? <PreviewModal form={form} onClose={() => setPreviewOpen(false)} /> : null}
    </div>
  );
}

function PreviewModal({ form, onClose }: { form: QuizFormState; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-label="Pratinjau formulir" className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-theme-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <p className="text-theme-sm font-semibold text-gray-800">Pratinjau — seperti yang dilihat responden</p>
          <button type="button" onClick={onClose} aria-label="Tutup pratinjau" className="grid size-9 place-items-center rounded-full text-gray-400 hover:bg-gray-100">✕</button>
        </div>
        <div className="overflow-y-auto p-5">
          <ThemeHeaderPreview themeColor={form.themeColor} headerImageUrl={form.headerImageUrl} />
          <h2 className="mt-4 text-2xl font-bold text-gray-900" dir="auto">{form.title || "Judul formulir"}</h2>
          {form.description ? <p className="mt-2 text-theme-sm text-gray-500" dir="auto">{form.description}</p> : null}
          <ol className="mt-6 grid gap-6">
            {form.questions.map((question, index) => (
              <PreviewQuestion key={question.key} question={question} index={index} />
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}

function PreviewQuestion({ question, index }: { question: QuizQuestion; index: number }) {
  const isCheckbox = question.type === "MULTI_SELECT";
  const showOptions = CHOICE_TYPES.has(question.type);
  return (
    <li>
      <p className="text-theme-sm font-medium text-gray-900" dir="auto">
        {index + 1}. {question.question || "Pertanyaan tanpa judul"}
        {question.required ? <span className="text-error-500"> *</span> : null}
      </p>
      {question.helpText ? <p className="mt-0.5 text-theme-xs text-gray-400" dir="auto">{question.helpText}</p> : null}
      {question.stimulusText ? <p className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-theme-sm text-gray-600" dir="auto">{question.stimulusText}</p> : null}
      {showOptions ? (
        <ul className="mt-3 grid gap-2">
          {question.options.filter((option) => option.content.trim() || true).map((option, optionIndex) => (
            <li key={optionIndex} className="flex items-center gap-2 text-theme-sm text-gray-700">
              <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full border border-gray-300" />
              <span dir="auto">{option.content || `Opsi ${"ABCDEFGHIJ"[optionIndex]}`}</span>
            </li>
          ))}
          {question.allowOther ? <li className="flex items-center gap-2 text-theme-sm text-gray-500"><span aria-hidden="true" className="size-5 shrink-0 rounded-full border border-dashed border-gray-300" />Lainnya: ______</li> : null}
        </ul>
      ) : null}
      {question.type === "BENAR_SALAH" ? <div className="mt-3 flex gap-6 text-theme-sm text-gray-600"><span>○ Benar</span><span>○ Salah</span></div> : null}
      {question.type === "ISIAN_SINGKAT" ? <p className="mt-2 border-b border-gray-300 pb-1 text-theme-sm text-gray-400">Jawaban singkat</p> : null}
      {question.type === "ESAI" || question.type === "WRITING" ? <div className="mt-2 h-20 rounded-xl border border-gray-200" /> : null}
      {question.type === "CLOZE" ? <p className="mt-2 border-b border-gray-300 pb-1 text-theme-sm text-gray-400">Isi celah kalimat</p> : null}
      {["SKALA", "RATING"].includes(question.type) ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-theme-sm text-gray-600">
          <span>{question.scaleMinLabel || question.scaleMin}</span>
          {Array.from({ length: Math.max(0, question.scaleMax - question.scaleMin + 1) }, (_, offset) => question.scaleMin + offset).map((value) => (
            <span key={value} className="flex items-center gap-1"><span className="grid size-5 place-items-center rounded-full border border-gray-300" /><span className="text-theme-xs text-gray-400">{value}</span></span>
          ))}
          <span>{question.scaleMaxLabel || question.scaleMax}</span>
        </div>
      ) : null}
      {question.type === "GRID" ? (
        <table className="mt-3 w-full text-theme-sm">
          <thead><tr><th /><th className="p-1 font-medium text-gray-500" colSpan={question.options.length}>{isCheckbox ? "Kotak centang" : "Pilih satu per baris"}</th></tr><tr>{question.options.map((option, optionIndex) => <th key={optionIndex} className="p-1 font-medium text-gray-600" dir="auto">{option.content || "ABCDEFGHIJ"[optionIndex]}</th>)}</tr></thead>
          <tbody>
            {question.gridRows.map((row, rowIndex) => (
              <tr key={rowIndex}><td className="p-1 text-gray-700" dir="auto">{row || `Baris ${rowIndex + 1}`}</td>{question.options.map((_, colIndex) => <td key={colIndex} className="p-1 text-center"><span className="mx-auto block size-4 rounded-sm border border-gray-300" /></td>)}</tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {question.type === "MENJODOHKAN" ? (
        <ul className="mt-3 grid gap-1.5 text-theme-sm text-gray-600">
          {question.pairs.map((pair, pairIndex) => (
            <li key={pairIndex} className="flex items-center gap-2">
              <span dir="auto">{pair.left || null}</span>
              {pair.leftMediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pair.leftMediaUrl} alt={`Kiri ${pairIndex + 1}`} className="h-10 w-10 rounded object-cover ring-1 ring-gray-100" />
              ) : null}
              <span className="text-gray-300">→</span>
              <span className="rounded-lg border border-gray-200 px-2 py-0.5 text-theme-xs text-gray-400">pilih jodoh</span>
            </li>
          ))}
        </ul>
      ) : null}
      {question.type === "URUTAN" ? (
        <ol className="mt-3 grid gap-1.5 text-theme-sm text-gray-600">
          {question.sequenceItems.map((item, itemIndex) => <li key={itemIndex} className="flex items-center gap-2"><span className="grid size-5 place-items-center rounded-full bg-gray-100 text-theme-xs">{itemIndex + 1}</span><span dir="auto">{item}</span></li>)}
        </ol>
      ) : null}
      {question.type === "TANGGAL" ? <p className="mt-2 border-b border-gray-300 pb-1 text-theme-sm text-gray-400">Tanggal: __/__/____</p> : null}
      {question.type === "WAKTU" ? <p className="mt-2 border-b border-gray-300 pb-1 text-theme-sm text-gray-400">Waktu: __:__</p> : null}
      {question.type === "FILE_UPLOAD" ? <p className="mt-2 rounded-xl border border-dashed border-gray-300 p-3 text-center text-theme-xs text-gray-400">Unggah berkas di sini</p> : null}
      {["GAMBAR", "LISTENING", "READING", "SPEAKING", "ROLEPLAY"].includes(question.type) ? <p className="mt-2 text-theme-xs text-gray-400">Media {formatUiLabel(question.type)} ditampilkan di halaman pengerjaan.</p> : null}
    </li>
  );
}
