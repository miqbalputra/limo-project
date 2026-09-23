"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ArabicTextField, LocalizedContent } from "@/components/localized-content";
import { useConfirmDialog } from "@/components/dashboard/use-confirm-dialog";
import { requestJson } from "@/lib/api-json-client";
import { formatUiLabel } from "@/lib/ui-labels";

type DraftAnswer = {
  ujianSoalId: string;
  selectedOption?: string;
  selectedOptions?: string[];
  shortAnswer?: string;
  essayAnswer?: string;
  structuredAnswer?: Record<string, unknown>;
};

type QuestionValidation = { type?: string; min?: number | null; max?: number | null; pattern?: string | null; message?: string | null } | null;

type AttemptQuestion = {
  id: string;
  weight: string;
  required: boolean;
  sectionIndex: number;
  branchRules: { label: string; goToSectionIndex: number | null }[];
  bankSoal: {
    type: string;
    question: string;
    helpText: string | null;
    stimulusText: string | null;
    mediaUrl: string | null;
    language: string | null;
    direction: string | null;
    allowOther: boolean;
    scale: { min: number | null; max: number | null; minLabel: string | null; maxLabel: string | null; kind: string | null };
    grid: { rows: string[]; multiple: boolean };
    validation: QuestionValidation;
    options: { label: string; content: string; mediaUrl: string | null }[];
  };
};

type AttemptSection = { id: string; order: number; title: string; description: string | null };

type AttemptContext = {
  id: string;
  status: string;
  expiresAt: Date | string | null;
  draftAnswers: unknown;
  draftSavedAt: Date | string | null;
  siswa: { id: string; name: string; nomorInduk: string };
  ujian: {
    id: string;
    title: string;
    durationMinutes: number;
    sections: AttemptSection[];
    questions: AttemptQuestion[];
  };
};

const CHOICE_TYPES = new Set(["PILIHAN_GANDA", "MULTI_SELECT", "DROPDOWN"]);
const SCALE_TYPES = new Set(["SKALA", "RATING"]);

function isAnswerFilled(answer: DraftAnswer | undefined) {
  if (!answer) return false;
  if (answer.selectedOption) return answer.selectedOption === "OTHER" ? Boolean(answer.shortAnswer?.trim()) : true;
  if (answer.selectedOptions?.length) return answer.selectedOptions.includes("OTHER") ? Boolean(answer.shortAnswer?.trim()) : true;
  if (answer.structuredAnswer) return Object.values(answer.structuredAnswer).some((value) => (Array.isArray(value) ? value.length > 0 : Boolean(value)));
  return Boolean(answer.shortAnswer?.trim() || answer.essayAnswer?.trim());
}

function validationMessage(question: AttemptQuestion, answer: DraftAnswer | undefined) {
  const config = question.bankSoal.validation;
  if (!config || config.type === "NONE" || config.type === undefined) return "";
  const value = answer?.shortAnswer?.trim() ?? "";
  if (!value) return "";
  if (config.type === "NUMBER") {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return "Jawaban harus berupa angka.";
    if (config.min !== null && config.min !== undefined && numeric < config.min) return `Nilai minimal ${config.min}.`;
    if (config.max !== null && config.max !== undefined && numeric > config.max) return `Nilai maksimal ${config.max}.`;
  } else if (config.type === "LENGTH") {
    if (config.min !== null && config.min !== undefined && value.length < config.min) return `Jawaban minimal ${config.min} karakter.`;
    if (config.max !== null && config.max !== undefined && value.length > config.max) return `Jawaban maksimal ${config.max} karakter.`;
  } else if (config.type === "TEXT" && config.pattern) {
    try {
      if (!new RegExp(config.pattern).test(value)) return config.message || "Format jawaban tidak sesuai.";
    } catch {
      return "";
    }
  }
  return "";
}

export function OnlineExamPlayer({ attempt }: { attempt: AttemptContext }) {
  const router = useRouter();
  const saveTimerRef = useRef<number | null>(null);
  const saveDraftRef = useRef<((_keepalive?: boolean) => Promise<void>) | null>(null);
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>(() => {
    const entries = normalizeDraft(attempt.draftAnswers).map((answer) => [answer.ujianSoalId, answer] as const);
    return Object.fromEntries(entries);
  });
  const [currentSection, setCurrentSection] = useState(0);
  const [uploadingId, setUploadingId] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(attempt.draftSavedAt ? "saved" : "idle");
  const [isOnline, setIsOnline] = useState(true);
  const { confirm, dialog } = useConfirmDialog();

  useEffect(() => {
    if (!attempt.expiresAt) return;
    const expiresAt = new Date(attempt.expiresAt).getTime();
    const update = () => setRemainingSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [attempt.expiresAt]);

  function buildAnswers(): DraftAnswer[] {
    return attempt.ujian.questions.map((question) => answers[question.id] ?? { ujianSoalId: question.id });
  }

  function setAnswer(questionId: string, patch: Partial<DraftAnswer>) {
    setAnswers((current) => ({ ...current, [questionId]: { ...current[questionId], ujianSoalId: questionId, ...patch } }));
    scheduleDraftSave();
  }

  async function saveDraft(keepalive = false) {
    const payload = buildAnswers();
    if (!payload.length) return;
    if (!navigator.onLine) {
      setSaveState("error");
      return;
    }
    setSaveState("saving");
    try {
      await requestJson(`/api/v1/wali/attempt/${attempt.id}`, { method: "PATCH", body: { answers: payload }, keepalive, fallbackMessage: "Draf gagal disimpan" });
      setSaveState("saved");
    } catch (caught) {
      setSaveState("error");
      if (!navigator.onLine) setError("Koneksi terputus. Draf akan dicoba lagi saat koneksi kembali.");
      if (caught instanceof Error && caught.message.includes("habis")) setError(caught.message);
    }
  }

  useEffect(() => {
    saveDraftRef.current = saveDraft;
  });

  function scheduleDraftSave() {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveDraftRef.current?.();
    }, 800);
  }

  useEffect(() => {
    const flushDraft = () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      void saveDraftRef.current?.(true);
    };
    const updateConnection = () => setIsOnline(navigator.onLine);
    const saveOnReconnect = () => {
      setIsOnline(true);
      void saveDraftRef.current?.();
    };
    updateConnection();
    document.addEventListener("visibilitychange", flushDraft);
    window.addEventListener("pagehide", flushDraft);
    window.addEventListener("online", saveOnReconnect);
    window.addEventListener("offline", updateConnection);
    return () => {
      document.removeEventListener("visibilitychange", flushDraft);
      window.removeEventListener("pagehide", flushDraft);
      window.removeEventListener("online", saveOnReconnect);
      window.removeEventListener("offline", updateConnection);
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, [attempt.id]);

  async function uploadFileAnswer(questionId: string, file: File) {
    setError("");
    setUploadingId(questionId);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await requestJson<{ item: { id: string; name: string } }>(`/api/v1/wali/attempt/${attempt.id}/upload`, { method: "POST", body: formData, fallbackMessage: "Gagal mengunggah berkas" });
      setAnswer(questionId, { structuredAnswer: { fileId: result.data.item.id, name: result.data.item.name } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mengunggah berkas");
    } finally {
      setUploadingId("");
    }
  }

  function sectionQuestions(index: number) {
    return attempt.ujian.questions.filter((question) => question.sectionIndex === index);
  }

  function resolveBranchTarget(questions: AttemptQuestion[]) {
    for (const question of questions) {
      if (question.bankSoal.type !== "PILIHAN_GANDA") continue;
      const selected = answers[question.id]?.selectedOption;
      if (!selected) continue;
      const rule = question.branchRules.find((item) => item.label === selected);
      if (rule && rule.goToSectionIndex !== null) return rule.goToSectionIndex;
    }
    return null;
  }

  function sectionProblem(questions: AttemptQuestion[]) {
    for (const question of questions) {
      if (question.required && !isAnswerFilled(answers[question.id])) return "Masih ada soal wajib yang belum diisi pada bagian ini.";
      const message = validationMessage(question, answers[question.id]);
      if (message) return message;
    }
    return "";
  }

  function goNext() {
    const sections = attempt.ujian.sections;
    const problem = sectionProblem(sectionQuestions(currentSection));
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    const target = resolveBranchTarget(sectionQuestions(currentSection)) ?? currentSection + 1;
    if (target >= sections.length) {
      void onSubmitFinal();
    } else {
      setCurrentSection(target);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function onSubmitFinal() {
    if (!isOnline) {
      setError("Koneksi internet terputus. Sambungkan kembali sebelum mengumpulkan jawaban.");
      return;
    }
    const sections = attempt.ujian.sections;
    for (let index = 0; index < sections.length; index += 1) {
      const problem = sectionProblem(sectionQuestions(index));
      if (problem) {
        setCurrentSection(index);
        setError(problem);
        return;
      }
    }
    if (!(await confirm({ title: "Kumpulkan jawaban?", description: "Jawaban tidak bisa diubah setelah submit.", confirmLabel: "Ya, kumpulkan", variant: "destructive" }))) {
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await requestJson(`/api/v1/wali/attempt/${attempt.id}/submit`, { method: "POST", body: { answers: buildAnswers() }, fallbackMessage: "Jawaban gagal dikumpulkan" });
      router.push(`/wali/tugas/${attempt.siswa.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Jawaban gagal dikumpulkan");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmitFinal();
  }

  const sections = attempt.ujian.sections.length > 0 ? attempt.ujian.sections : [{ id: "single", order: 0, title: "", description: null }];
  const isLastSection = currentSection >= sections.length - 1;
  const visibleQuestions = sectionQuestions(currentSection);
  const activeSection = sections[currentSection];
  const answeredCount = attempt.ujian.questions.filter((question) => isAnswerFilled(answers[question.id])).length;
  const progress = attempt.ujian.questions.length > 0 ? Math.round((answeredCount / attempt.ujian.questions.length) * 100) : 0;
  const expiresAt = attempt.expiresAt ? new Date(attempt.expiresAt) : null;
  const submitDisabled = isSubmitting || remainingSeconds === 0 || !isOnline;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="tailadmin-card sticky top-4 z-10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-500">{attempt.siswa.name}</p>
            <h2 className="font-semibold text-gray-900">{attempt.ujian.title}</h2>
            <p className="mt-1 text-theme-xs text-gray-500">
              {sections.length > 1 ? `Bagian ${currentSection + 1} dari ${sections.length} · ` : ""}{attempt.ujian.questions.length} soal · {progress}% terisi{expiresAt ? ` · batas ${expiresAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {saveState !== "idle" ? <span aria-live="polite" className={`rounded-full px-3 py-1 text-center text-theme-xs font-semibold ${saveState === "error" ? "bg-error-50 text-error-700" : saveState === "saving" ? "bg-warning-50 text-warning-700" : "bg-success-50 text-success-700"}`}>{saveState === "saving" ? "Menyimpan draf..." : saveState === "error" ? "Draf belum tersimpan" : "Draf tersimpan"}</span> : null}
              {remainingSeconds !== null ? <span aria-live="polite" className={`rounded-full px-3 py-1 text-center text-theme-xs font-semibold ${remainingSeconds <= 60 ? "bg-error-50 text-error-700" : "bg-limo-blue-50 text-limo-blue-600"}`}>Sisa waktu {formatDuration(remainingSeconds)}</span> : null}
            </div>
            <button disabled={submitDisabled} className="tailadmin-button-primary px-4 py-2">{!isOnline ? "Menunggu koneksi" : isSubmitting ? "Mengumpulkan..." : remainingSeconds === 0 ? "Waktu Habis" : "Kumpulkan Jawaban"}</button>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progres pengisian">
          <div className="h-full rounded-full bg-limo-blue-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        {!isOnline ? <p role="alert" className="mt-3 tailadmin-alert-error">Koneksi internet terputus. Jawaban tetap ada di halaman ini, tetapi draf dan submit akan dilanjutkan setelah koneksi pulih.</p> : null}
        {error ? <p role="alert" className="mt-3 tailadmin-alert-error">{error}</p> : null}
      </section>

      {activeSection && (activeSection.title || activeSection.description) && sections.length > 1 ? (
        <section className="rounded-2xl border-l-4 border-limo-blue-400 bg-limo-blue-50 p-5">
          {activeSection.title ? <h3 className="text-lg font-bold text-limo-blue-800">{activeSection.title}</h3> : null}
          {activeSection.description ? <p className="mt-1 whitespace-pre-wrap text-theme-sm text-limo-blue-700">{activeSection.description}</p> : null}
        </section>
      ) : null}

      {visibleQuestions.map((question, index) => (
        <section key={question.id} className="tailadmin-card min-w-0 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-theme-sm font-semibold text-limo-blue-500">Soal {index + 1} / {formatUiLabel(question.bankSoal.type)}{question.required ? " *" : ""}</p>
            <span className="w-fit rounded-full bg-gray-50 px-3 py-1 text-theme-xs font-semibold text-gray-500">Bobot {question.weight}</span>
          </div>
          {question.bankSoal.stimulusText ? <LocalizedContent as="p" text={question.bankSoal.stimulusText} language={question.bankSoal.language} direction={question.bankSoal.direction} className="mt-4 rounded-2xl bg-gray-50 p-4 text-theme-sm leading-7 text-gray-700">{question.bankSoal.stimulusText}</LocalizedContent> : null}
          <MediaBlock type={question.bankSoal.type} mediaUrl={question.bankSoal.mediaUrl} />
          <LocalizedContent as="p" text={question.bankSoal.question} language={question.bankSoal.language} direction={question.bankSoal.direction} className="mt-4 text-lg font-semibold leading-8 text-gray-900">{question.bankSoal.question}</LocalizedContent>
          {question.bankSoal.helpText ? <LocalizedContent as="p" text={question.bankSoal.helpText} language={question.bankSoal.language} direction="auto" className="mt-1 text-theme-sm text-gray-500">{question.bankSoal.helpText}</LocalizedContent> : null}
          <AnswerInput question={question} answer={answers[question.id]} uploading={uploadingId === question.id} onUploadFile={(file) => void uploadFileAnswer(question.id, file)} onChange={(patch) => setAnswer(question.id, patch)} />
        </section>
      ))}

      <section className="tailadmin-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" disabled={currentSection === 0} onClick={() => { setError(""); setCurrentSection((value) => Math.max(0, value - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="tailadmin-button-outline px-5 py-3 disabled:opacity-40">Sebelumnya</button>
        {isLastSection ? (
          <button type="button" disabled={submitDisabled} onClick={() => void onSubmitFinal()} className="tailadmin-button-primary px-6 py-3">{isSubmitting ? "Mengumpulkan..." : "Kumpulkan Jawaban"}</button>
        ) : (
          <button type="button" onClick={goNext} className="tailadmin-button-primary px-6 py-3">Berikutnya</button>
        )}
      </section>
      {dialog}
    </form>
  );
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function mediaEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const videoId = parsed.searchParams.get("v");
      if (videoId) return `https://www.youtube-nocookie.com/embed/${videoId}`;
    }
    if (host === "youtu.be") {
      const videoId = parsed.pathname.slice(1).split("/")[0];
      if (videoId) return `https://www.youtube-nocookie.com/embed/${videoId}`;
    }
    if (host === "vimeo.com") {
      const videoId = parsed.pathname.split("/").filter(Boolean)[0];
      if (videoId) return `https://player.vimeo.com/video/${videoId}`;
    }
  } catch {
    return null;
  }
  return null;
}

function MediaBlock({ type, mediaUrl }: { type: string; mediaUrl: string | null }) {
  if (!mediaUrl) return null;
  if (type === "LISTENING") return <audio controls src={mediaUrl} className="mt-4 w-full" />;
  const embed = mediaEmbedUrl(mediaUrl);
  if (embed) {
    return (
      <div className="mt-4 aspect-video w-full overflow-hidden rounded-2xl border border-gray-100">
        <iframe src={embed} title="Media soal" className="h-full w-full" allowFullScreen />
      </div>
    );
  }
  if (type === "GAMBAR" || mediaUrl.startsWith("/api/v1/public/quiz-media/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={mediaUrl} alt="Media soal" className="mt-4 max-h-72 rounded-2xl border border-gray-100 object-contain" />;
  }
  return <a href={mediaUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-theme-sm font-semibold text-limo-blue-500 hover:text-limo-blue-600">Buka media soal</a>;
}

function AnswerInput({ question, answer, uploading, onUploadFile, onChange }: { question: AttemptQuestion; answer?: DraftAnswer; uploading: boolean; onUploadFile: (_file: File) => void; onChange: (_patch: Partial<DraftAnswer>) => void }) {
  const type = question.bankSoal.type;
  const options = question.bankSoal.options;

  if (CHOICE_TYPES.has(type) && type !== "DROPDOWN") {
    const multi = type === "MULTI_SELECT";
    return (
      <div className="mt-4 grid gap-2">
        {options.map((option) => {
          const selected = multi ? answer?.selectedOptions?.includes(option.label) ?? false : answer?.selectedOption === option.label;
          return (
            <label key={option.label} className="flex cursor-pointer gap-3 rounded-xl border border-gray-200 bg-white p-3 text-theme-sm text-gray-700 hover:bg-gray-25">
              <input
                type={multi ? "checkbox" : "radio"}
                name={`selected-${question.id}`}
                value={option.label}
                checked={selected}
                onChange={() => onChange(multi ? { selectedOptions: selected ? (answer?.selectedOptions ?? []).filter((item) => item !== option.label) : [...(answer?.selectedOptions ?? []), option.label] } : { selectedOption: option.label })}
                className="mt-1 accent-limo-blue-500"
              />
              <span className="flex-1"><b>{option.label}.</b> <LocalizedContent text={option.content} language={question.bankSoal.language} direction="auto">{option.content}</LocalizedContent></span>
              {option.mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={option.mediaUrl} alt={`Opsi ${option.label}`} className="h-16 w-24 shrink-0 rounded-lg object-cover ring-1 ring-gray-100" />
              ) : null}
            </label>
          );
        })}
      </div>
    );
  }

  if (type === "DROPDOWN") {
    return (
      <select value={answer?.selectedOption ?? ""} onChange={(event) => onChange({ selectedOption: event.target.value })} className="mt-4 tailadmin-input sm:max-w-sm">
        <option value="">Pilih jawaban</option>
        {options.map((option) => <option key={option.label} value={option.label}>{option.content}</option>)}
      </select>
    );
  }

  if (SCALE_TYPES.has(type)) {
    if (type === "RATING") {
      return (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {options.map((option) => {
            const active = answer?.selectedOption === option.label;
            return (
              <button key={option.label} type="button" onClick={() => onChange({ selectedOption: option.label })} aria-label={`Beri ${option.content} bintang`} className={`grid size-11 place-items-center rounded-xl border text-xl transition ${active ? "border-limo-blue-500 bg-limo-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                {active ? "★" : "☆"}
              </button>
            );
          })}
        </div>
      );
    }
    return (
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-theme-xs text-gray-400">{question.bankSoal.scale.minLabel ?? ""}</span>
        {options.map((option) => {
          const active = answer?.selectedOption === option.label;
          return (
            <button key={option.label} type="button" onClick={() => onChange({ selectedOption: option.label })} aria-label={`Pilih nilai ${option.content}`} className={`grid size-11 place-items-center rounded-xl border font-semibold transition ${active ? "border-limo-blue-500 bg-limo-blue-50 text-limo-blue-700" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}>
              {option.content}
            </button>
          );
        })}
        <span className="text-theme-xs text-gray-400">{question.bankSoal.scale.maxLabel ?? ""}</span>
      </div>
    );
  }

  if (type === "TANGGAL" || type === "WAKTU") {
    return <input type={type === "TANGGAL" ? "date" : "time"} value={answer?.shortAnswer ?? ""} onChange={(event) => onChange({ shortAnswer: event.target.value })} className="mt-4 tailadmin-input sm:max-w-xs" />;
  }

  if (type === "GRID") {
    const structured = (answer?.structuredAnswer ?? {}) as Record<string, unknown>;
    const rows = question.bankSoal.grid.rows;
    const multiple = question.bankSoal.grid.multiple;
    const toggle = (rowIndex: number, label: string) => {
      const key = String(rowIndex);
      if (multiple) {
        const current = Array.isArray(structured[key]) ? (structured[key] as string[]) : [];
        onChange({ structuredAnswer: { ...structured, [key]: current.includes(label) ? current.filter((item) => item !== label) : [...current, label] } });
      } else {
        onChange({ structuredAnswer: { ...structured, [key]: label } });
      }
    };
    return (
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-theme-sm">
          <thead>
            <tr>
              <th className="border-b border-gray-200 p-2" />
              {options.map((option) => <th key={option.label} className="border-b border-gray-200 p-2 text-center font-semibold text-gray-600">{option.content || option.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="border-b border-gray-100 p-2 text-gray-700">{row}</td>
                {options.map((option) => {
                  const value = structured[String(rowIndex)];
                  const checked = multiple ? Array.isArray(value) && value.includes(option.label) : value === option.label;
                  return (
                    <td key={option.label} className="border-b border-gray-100 p-2 text-center">
                      <input type={multiple ? "checkbox" : "radio"} name={`grid-${question.id}-${rowIndex}`} checked={checked} onChange={() => toggle(rowIndex, option.label)} className="accent-limo-blue-500" />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (type === "FILE_UPLOAD") {
    const rawName = answer?.structuredAnswer?.name;
    const fileName = typeof rawName === "string" ? rawName : "";
    return (
      <div className="mt-4">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-theme-sm font-semibold text-gray-700 hover:bg-gray-50">
          {uploading ? "Mengunggah..." : fileName ? "Ganti berkas" : "Pilih berkas"}
          <input type="file" className="hidden" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onUploadFile(file); }} />
        </label>
        {fileName ? <p className="mt-2 text-theme-sm text-gray-600">Berkas: {fileName}</p> : <p className="mt-2 text-theme-xs text-gray-400">PDF, dokumen, gambar, audio, video, atau zip.</p>}
      </div>
    );
  }

  if (["ISIAN_SINGKAT", "CLOZE", "GAMBAR", "LISTENING", "READING"].includes(type)) {
    return <ArabicTextField name={`short-${question.id}`} value={answer?.shortAnswer ?? ""} onChange={(event) => onChange({ shortAnswer: event.target.value })} language={question.bankSoal.language} direction="auto" placeholder="Tulis jawaban singkat" className="mt-4 tailadmin-input" />;
  }

  return <ArabicTextField as="textarea" name={`essay-${question.id}`} value={answer?.essayAnswer ?? ""} onChange={(event) => onChange({ essayAnswer: event.target.value })} language={question.bankSoal.language} direction="auto" placeholder="Tulis jawaban di sini. Jawaban akan ditinjau guru." className="mt-4 tailadmin-input min-h-32" />;
}

function normalizeDraft(value: unknown): DraftAnswer[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || !("ujianSoalId" in item) || typeof item.ujianSoalId !== "string") return [];
    const answer = item as Record<string, unknown>;
    return [{
      ujianSoalId: item.ujianSoalId,
      selectedOption: typeof answer.selectedOption === "string" ? answer.selectedOption : undefined,
      selectedOptions: Array.isArray(answer.selectedOptions) ? answer.selectedOptions.filter((option): option is string => typeof option === "string") : undefined,
      shortAnswer: typeof answer.shortAnswer === "string" ? answer.shortAnswer : undefined,
      essayAnswer: typeof answer.essayAnswer === "string" ? answer.essayAnswer : undefined,
      structuredAnswer: answer.structuredAnswer && typeof answer.structuredAnswer === "object" ? (answer.structuredAnswer as Record<string, unknown>) : undefined,
    }];
  });
}
