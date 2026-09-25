"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArabicTextField, LocalizedContent } from "@/components/localized-content";
import { AudioRecorder } from "@/components/quiz/audio-recorder";
import { requestJson } from "@/lib/api-json-client";
import { canRecordAudio, formatFileSize, uploadAcceptAttribute } from "@/lib/quiz-upload";
import { accentTextOn, darken, themeAccent } from "@/lib/quiz-theme";
import { clearQueuedUploads, loadQueuedUploads, removeQueuedUpload, saveQueuedUpload } from "@/lib/upload-queue";

type QuizIntro = {
  title: string;
  description: string | null;
  mode: string;
  durationMinutes: number;
  questionCount: number;
  passingScore: number | null;
  collectRespondentName: boolean;
  collectRespondentEmail: boolean;
  showScoreImmediately: boolean;
  showAnswersAfterSubmit: boolean;
  shuffleQuestions: boolean;
  themeColor: string | null;
  headerImageUrl: string | null;
  confirmationMessage: string | null;
  programName: string;
  className: string;
};

type PublicSection = { index: number; title: string; description: string | null };

type BranchRule = { label: string; goToSectionIndex: number | null };

type PublicQuestion = {
  id: string;
  weight: number;
  required: boolean;
  sectionIndex: number;
  branchRules: BranchRule[];
  type: string;
  question: string;
  helpText: string | null;
  stimulusText: string | null;
  mediaUrl: string | null;
  language: string | null;
  direction: string | null;
  allowOther: boolean;
  scaleMin: number | null;
  scaleMax: number | null;
  scaleMinLabel: string | null;
  scaleMaxLabel: string | null;
  kind: string | null;
  gridRows: string[];
  gridMultiple: boolean;
  uploadAllowedTypes: string[];
  uploadMaxSizeMb: number;
  validation: { type: string; min: number | null; max: number | null; pattern: string | null; message: string | null } | null;
  options: { label: string; content: string; mediaUrl: string | null }[];
};

type DraftAnswer = {
  ujianSoalId: string;
  selectedOption?: string;
  selectedOptions?: string[];
  shortAnswer?: string;
  essayAnswer?: string;
  structuredAnswer?: Record<string, string | string[]>;
};

type AttemptContext = {
  response: { id: string; status: string; expiresAt: string | null; draftAnswers: unknown; respondentName: string };
  quiz: { title: string; description: string | null; durationMinutes: number; passingScore: number | null; showScoreImmediately: boolean; showAnswersAfterSubmit: boolean; themeColor: string | null; headerImageUrl: string | null; confirmationMessage: string | null; presentationMode?: string };
  sections: PublicSection[];
  questions: PublicQuestion[];
};

type FeedbackItem = {
  ujianSoalId: string;
  question: string;
  correct: boolean | null;
  correctOption: string | null;
  correctAnswer: string | null;
  explanation: string | null;
  feedbackText: string | null;
};

type QuizResult = {
  respondentName: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  passed: boolean | null;
  passingScore: number | null;
  submittedAt: string | null;
  showScoreImmediately: boolean;
  showAnswersAfterSubmit: boolean;
  releasePending?: boolean;
  feedback: FeedbackItem[];
};

function isAnswerFilled(answer: DraftAnswer | undefined) {
  if (!answer) return false;
  const otherText = answer.shortAnswer?.trim();
  if (answer.selectedOption) return answer.selectedOption === "OTHER" ? Boolean(otherText) : true;
  if (answer.selectedOptions?.length) return answer.selectedOptions.includes("OTHER") ? Boolean(otherText) : true;
  if (answer.structuredAnswer) return Object.values(answer.structuredAnswer).some((value) => (Array.isArray(value) ? value.length > 0 : Boolean(value)));
  return Boolean(otherText || answer.essayAnswer?.trim());
}

export function PublicQuizRunner({ token }: { token: string }) {
  const [phase, setPhase] = useState<"loading" | "intro" | "quiz" | "result" | "error">("loading");
  const [intro, setIntro] = useState<QuizIntro | null>(null);
  const [error, setError] = useState("");
  const [respondentName, setRespondentName] = useState("");
  const [respondentEmail, setRespondentEmail] = useState("");
  const [context, setContext] = useState<AttemptContext | null>(null);
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [uploadingId, setUploadingId] = useState("");
  const [currentSection, setCurrentSection] = useState(0);
  const [errorQuestionId, setErrorQuestionId] = useState("");
  const [queuedUploads, setQueuedUploads] = useState<Record<string, File>>({});
  const saveTimerRef = useRef<number | null>(null);
  const expiresAtRef = useRef<string | null>(null);
  const submitRef = useRef<((_auto?: boolean) => Promise<void>) | null>(null);
  const storageKey = `limo-quiz-${token}`;
  const queueKey = `quiz:${context?.response.id ?? token}`;

  useEffect(() => {
    let active = true;
    async function boot() {
      const savedId = window.localStorage.getItem(storageKey);
      if (savedId) {
        try {
          const resumed = await requestJson<AttemptContext>(`/api/v1/public/quiz/${token}/responses/${savedId}`);
          if (!active) return;
          if (resumed.data.response.status === "IN_PROGRESS") {
            setContext(resumed.data);
            setAnswers(restoreDraft(resumed.data.response.draftAnswers));
            expiresAtRef.current = resumed.data.response.expiresAt;
            setRemainingSeconds(resumed.data.response.expiresAt ? Math.max(0, Math.ceil((new Date(resumed.data.response.expiresAt).getTime() - Date.now()) / 1000)) : null);
            setPhase("quiz");
            return;
          }
          window.localStorage.removeItem(storageKey);
        } catch {
          window.localStorage.removeItem(storageKey);
        }
      }
      const response = await requestJson<{ quiz: QuizIntro }>(`/api/v1/public/quiz/${token}`);
      if (!active) return;
      setIntro(response.data.quiz);
      setPhase("intro");
    }
    boot().catch((caught) => {
      if (!active) return;
      setError(caught instanceof Error ? caught.message : "Kuis tidak dapat dibuka");
      setPhase("error");
    });
    return () => {
      active = false;
    };
  }, [token, storageKey]);

  async function start() {
    setError("");
    setPhase("loading");
    try {
      const started = await requestJson<{ responseId: string }>(`/api/v1/public/quiz/${token}/responses`, {
        method: "POST",
        body: { respondentName: respondentName.trim() || "Responden", respondentEmail: respondentEmail.trim() },
        fallbackMessage: "Kuis gagal dimulai",
      });
      const ctx = await requestJson<AttemptContext>(`/api/v1/public/quiz/${token}/responses/${started.data.responseId}`);
      window.localStorage.setItem(storageKey, started.data.responseId);
      setContext(ctx.data);
      setAnswers(restoreDraft(ctx.data.response.draftAnswers));
      expiresAtRef.current = ctx.data.response.expiresAt;
      setCurrentSection(0);
      setRemainingSeconds(ctx.data.response.expiresAt ? Math.max(0, Math.ceil((new Date(ctx.data.response.expiresAt).getTime() - Date.now()) / 1000)) : null);
      setPhase("quiz");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kuis gagal dimulai");
      setPhase(intro ? "intro" : "error");
    }
  }

  useEffect(() => {
    if (phase !== "quiz" || !expiresAtRef.current) return;
    const expiresAt = new Date(expiresAtRef.current).getTime();
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0) {
        window.clearInterval(timer);
        void submitRef.current?.(true);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  function buildAnswers(): DraftAnswer[] {
    if (!context) return [];
    return context.questions.map((question) => answers[question.id] ?? { ujianSoalId: question.id });
  }

  function setAnswer(questionId: string, patch: Partial<DraftAnswer>) {
    setAnswers((current) => ({ ...current, [questionId]: { ...current[questionId], ujianSoalId: questionId, ...patch } }));
    scheduleSave();
  }

  function enqueueUpload(questionId: string, file: File) {
    setQueuedUploads((current) => ({ ...current, [questionId]: file }));
    void saveQueuedUpload(queueKey, questionId, file);
  }

  function dequeueUpload(questionId: string) {
    setQueuedUploads((current) => {
      if (!(questionId in current)) return current;
      const next = { ...current };
      delete next[questionId];
      return next;
    });
    void removeQueuedUpload(queueKey, questionId);
  }

  async function flushQueuedUploads(entries: [string, File][]) {
    if (!context) return;
    for (const [questionId, file] of entries) {
      try {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("ujianSoalId", questionId);
        const uploaded = await requestJson<{ item: { id: string; name: string } }>(`/api/v1/public/quiz/${token}/responses/${context.response.id}/upload`, { method: "POST", body: formData, fallbackMessage: "Gagal mengunggah berkas" });
        setAnswer(questionId, { structuredAnswer: { fileId: uploaded.data.item.id, name: uploaded.data.item.name } });
        dequeueUpload(questionId);
        setError("");
      } catch {
        return;
      }
    }
  }

  useEffect(() => {
    if (phase !== "quiz") return;
    const onOnline = () => { void flushQueuedUploads(Object.entries(queuedUploads)); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedUploads, phase, context?.response.id]);

  useEffect(() => {
    if (phase !== "quiz" || !context) return;
    let active = true;
    void loadQueuedUploads(queueKey).then((items) => {
      if (!active || items.length === 0) return;
      const restored = Object.fromEntries(items.map((item) => [item.questionId, item.file]));
      setQueuedUploads((current) => ({ ...restored, ...current }));
      if (navigator.onLine) void flushQueuedUploads(Object.entries(restored));
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueKey, phase]);

  async function uploadFileAnswer(questionId: string, file: File) {
    if (!context) return;
    setError("");

    const question = context.questions.find((item) => item.id === questionId);
    const maxSizeMb = question?.uploadMaxSizeMb ?? 0;
    if (maxSizeMb > 0 && file.size > maxSizeMb * 1024 * 1024) {
      setError(`Ukuran berkas maksimal ${maxSizeMb} MB (berkas ${formatFileSize(file.size)}).`);
      return;
    }

    if (!navigator.onLine) {
      enqueueUpload(questionId, file);
      setError("Koneksi terputus. Berkas akan diunggah otomatis setelah koneksi pulih.");
      return;
    }

    setUploadingId(questionId);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("ujianSoalId", questionId);
      const result = await requestJson<{ item: { id: string; name: string } }>(`/api/v1/public/quiz/${token}/responses/${context.response.id}/upload`, { method: "POST", body: formData, fallbackMessage: "Gagal mengunggah berkas" });
      setAnswer(questionId, { structuredAnswer: { fileId: result.data.item.id, name: result.data.item.name } });
      dequeueUpload(questionId);
    } catch (caught) {
      enqueueUpload(questionId, file);
      setError(`${caught instanceof Error ? caught.message : "Gagal mengunggah berkas"} Berkas disimpan di antrean dan dicoba lagi saat koneksi pulih.`);
    } finally {
      setUploadingId("");
    }
  }

  function scheduleSave() {
    if (!context) return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveDraft();
    }, 800);
  }

  async function saveDraft() {
    if (!context) return;
    if (!navigator.onLine) {
      setSaveState("error");
      return;
    }
    setSaveState("saving");
    try {
      await requestJson(`/api/v1/public/quiz/${token}/responses/${context.response.id}`, { method: "PATCH", body: { answers: buildAnswers() }, fallbackMessage: "Draf gagal disimpan" });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  function firstProblem(questions: PublicQuestion[]) {
    for (const question of questions) {
      const label = question.question ? `"${question.question.slice(0, 50)}"` : "ini";
      if (question.required && !isAnswerFilled(answers[question.id])) {
        return { message: `Soal wajib belum diisi: ${label}.`, questionId: question.id };
      }
      const config = question.validation;
      if (!config || config.type === "NONE") continue;
      const value = answers[question.id]?.shortAnswer?.trim() ?? "";
      if (!value) continue;
      let detail = "";
      if (config.type === "NUMBER") {
        const numeric = Number(value);
        if (Number.isNaN(numeric)) detail = "Jawaban harus berupa angka.";
        else if (config.min !== null && numeric < config.min) detail = `Nilai minimal ${config.min}.`;
        else if (config.max !== null && numeric > config.max) detail = `Nilai maksimal ${config.max}.`;
      } else if (config.type === "LENGTH") {
        if (config.min !== null && value.length < config.min) detail = `Jawaban minimal ${config.min} karakter.`;
        else if (config.max !== null && value.length > config.max) detail = `Jawaban maksimal ${config.max} karakter.`;
      } else if (config.type === "TEXT" && config.pattern) {
        try {
          if (!new RegExp(config.pattern).test(value)) detail = config.message || "Format jawaban tidak sesuai.";
        } catch {
          continue;
        }
      }
      if (detail) return { message: `${detail} (${label})`, questionId: question.id };
    }
    return null;
  }

  function focusProblem(questionId: string) {
    setErrorQuestionId(questionId);
    window.requestAnimationFrame(() => {
      document.getElementById(`q-${questionId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function focusQuestion(questionId: string | undefined) {
    if (!questionId) return;
    window.requestAnimationFrame(() => {
      const element = document.getElementById(`q-${questionId}`);
      element?.scrollIntoView({ behavior: "smooth", block: "start" });
      element?.focus();
    });
  }

  function resolveBranchTarget(questions: PublicQuestion[]) {
    for (const question of questions) {
      if (!["PILIHAN_GANDA", "DROPDOWN", "MULTI_SELECT"].includes(question.type)) continue;
      const answer = answers[question.id];
      const labels = question.type === "MULTI_SELECT"
        ? (answer?.selectedOptions ?? [])
        : [answer?.selectedOption ?? ""];

      for (const label of labels) {
        if (!label) continue;
        const rule = question.branchRules.find((item) => item.label.toUpperCase() === label.toUpperCase());
        if (rule && rule.goToSectionIndex !== null) return rule.goToSectionIndex;
      }
    }
    return null;
  }

  async function sendAnswers() {
    if (!context) return;
    setReviewOpen(false);
    setSubmitting(true);
    setError("");
    try {
      await requestJson(`/api/v1/public/quiz/${token}/responses/${context.response.id}/submit`, { method: "POST", body: { answers: buildAnswers() }, fallbackMessage: "Jawaban gagal dikumpulkan" });
      window.localStorage.removeItem(storageKey);
      await clearQueuedUploads(queueKey);
      const detail = await requestJson<{ result: QuizResult }>(`/api/v1/public/quiz/${token}/responses/${context.response.id}/result`);
      setResult(detail.data.result);
      setPhase("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Jawaban gagal dikumpulkan");
    } finally {
      setSubmitting(false);
    }
  }

  async function submit(auto = false) {
    if (!context) return;
    if (!auto) {
      const problem = firstProblem(context.questions);
      if (problem) {
        setError(`Lengkapi jawaban sebelum mengumpulkan. ${problem.message}`);
        const section = context.questions.find((question) => question.id === problem.questionId)?.sectionIndex;
        if (section !== undefined) setCurrentSection(section);
        focusProblem(problem.questionId);
        return;
      }
      setReviewOpen(true);
      return;
    }
    await sendAnswers();
  }

  function clearSection() {
    if (!context) return;
    const visible = context.questions.filter((question) => question.sectionIndex === currentSection);
    if (visible.length === 0) return;
    if (!window.confirm("Bersihkan jawaban pada bagian ini?")) return;
    setAnswers((current) => {
      const next = { ...current };
      for (const question of visible) delete next[question.id];
      return next;
    });
    setError("");
    setSaveState("idle");
    scheduleSave();
  }

  useEffect(() => {
    submitRef.current = submit;
  });

  function goNext() {
    if (!context) return;
    const sections = context.sections;
    const visible = context.questions.filter((question) => question.sectionIndex === currentSection);
    const problem = firstProblem(visible);
    if (problem) {
      setError(`Lengkapi bagian ini sebelum lanjut. ${problem.message}`);
      focusProblem(problem.questionId);
      return;
    }
    setError("");
    setErrorQuestionId("");
    const target = resolveBranchTarget(visible) ?? currentSection + 1;
    if (target >= sections.length) {
      void submit(false);
    } else {
      setCurrentSection(target);
      setQuestionIndex(0);
      focusQuestion(context?.questions.find((question) => question.sectionIndex === target)?.id);
    }
  }

  function goPrevious() {
    setError("");
    if (onePerPage && questionIndex > 0) {
      setQuestionIndex((value) => value - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (currentSection > 0) {
      setCurrentSection((value) => Math.max(0, value - 1));
      setQuestionIndex(0);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goNextOnePerPage() {
    if (!context) return;
    const visible = context.questions.filter((question) => question.sectionIndex === currentSection);
    const current = visible[questionIndex];
    if (current) {
      const problem = firstProblem([current]);
      if (problem) {
        setError(`Lengkapi jawaban sebelum lanjut. ${problem.message}`);
        focusProblem(problem.questionId);
        return;
      }
    }
    setError("");
    setErrorQuestionId("");
    if (questionIndex < visible.length - 1) {
      setQuestionIndex((value) => value + 1);
      focusQuestion(visible[questionIndex + 1]?.id);
      return;
    }
    goNext();
  }

  const sections = context?.sections ?? [];
  const isLastSection = currentSection >= sections.length - 1;
  const visibleQuestions = context ? context.questions.filter((question) => question.sectionIndex === currentSection) : [];
  const onePerPage = context?.quiz.presentationMode === "ONE_PER_PAGE";
  const shownQuestions = onePerPage ? visibleQuestions.slice(questionIndex, questionIndex + 1) : visibleQuestions;
  const activeSection = sections[currentSection];
  const accent = themeAccent(intro?.themeColor ?? context?.quiz.themeColor);

  const progress = useMemo(() => {
    if (!context) return 0;
    const answered = context.questions.filter((question) => isAnswerFilled(answers[question.id])).length;
    return Math.round((answered / context.questions.length) * 100);
  }, [answers, context]);

  if (phase === "loading") {
    return <div className="grid min-h-[60vh] place-items-center text-theme-sm text-gray-500">Memuat kuis...</div>;
  }

  if (phase === "error") {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <div className="tailadmin-card p-6 text-center">
          <h1 className="text-xl font-bold text-gray-900">Kuis tidak dapat dibuka</h1>
          <p className="mt-3 text-theme-sm text-gray-600">{error || "Tautan mungkin sudah berubah atau kuis belum dibuka."}</p>
        </div>
      </div>
    );
  }

  if (phase === "intro" && intro) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
        <div className="tailadmin-card overflow-hidden p-6 sm:p-8">
          {intro.headerImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={intro.headerImageUrl} alt="Header kuis" className="-m-6 mb-5 h-44 w-[calc(100%+3rem)] object-cover sm:-m-8 sm:mb-6 sm:h-56 sm:w-[calc(100%+4rem)]" />
          ) : null}
          <p className="text-theme-xs font-bold uppercase tracking-widest" style={{ color: darken(accent, 0.15) }}>{intro.programName} / {intro.className}</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">{intro.title}</h1>
          {intro.description ? <p className="mt-3 whitespace-pre-wrap text-theme-sm leading-7 text-gray-600">{intro.description}</p> : null}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <InfoTile label="Soal" value={String(intro.questionCount)} />
            <InfoTile label="Durasi" value={`${intro.durationMinutes} menit`} />
            <InfoTile label="KKM" value={intro.passingScore === null ? "-" : String(intro.passingScore)} />
          </div>
          {error ? <p role="alert" className="mt-4 tailadmin-alert-error">{error}</p> : null}
          {intro.collectRespondentName ? (
            <label className="mt-6 block text-theme-sm font-semibold text-gray-700">
              Nama Anda
              <input value={respondentName} onChange={(event) => setRespondentName(event.target.value)} placeholder="Tulis nama lengkap" className="tailadmin-input mt-2" />
            </label>
          ) : null}
          {intro.collectRespondentEmail ? (
            <label className="mt-4 block text-theme-sm font-semibold text-gray-700">
              Email Anda
              <input type="email" value={respondentEmail} onChange={(event) => setRespondentEmail(event.target.value)} placeholder="nama@email.com" className="tailadmin-input mt-2" />
              <span className="mt-1 block text-theme-xs font-normal text-gray-500">Dipakai untuk salinan jawaban dan mencegah respons ganda.</span>
            </label>
          ) : null}
          <button type="button" onClick={() => void start()} disabled={(intro.collectRespondentName && respondentName.trim().length < 2) || (intro.collectRespondentEmail && !/^\S+@\S+\.\S+$/.test(respondentEmail.trim()))} className="tailadmin-button-primary mt-6 w-full py-3" style={{ backgroundColor: accent, color: accentTextOn(accent) }}>
            Mulai Kerjakan
          </button>
        </div>
      </div>
    );
  }

  if (phase === "quiz" && context) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {context.quiz.headerImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={context.quiz.headerImageUrl} alt="Header kuis" className="mb-4 h-32 w-full rounded-2xl object-cover sm:h-44" />
        ) : null}
        <section className="tailadmin-card sticky top-3 z-10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate font-semibold text-gray-900">{context.quiz.title}</h1>
              <p className="mt-1 text-theme-xs text-gray-500">
                {sections.length > 1 ? `Bagian ${currentSection + 1} dari ${sections.length} · ` : ""}{onePerPage ? `Soal ${questionIndex + 1} dari ${visibleQuestions.length} · ` : ""}{progress}% terisi
              </p>
            </div>
            <div className="flex items-center gap-2">
              {saveState !== "idle" ? <span className={`rounded-full px-3 py-1 text-theme-xs font-semibold ${saveState === "error" ? "bg-error-50 text-error-700" : saveState === "saving" ? "bg-warning-50 text-warning-700" : "bg-success-50 text-success-700"}`}>{saveState === "saving" ? "Menyimpan..." : saveState === "error" ? "Belum tersimpan" : "Tersimpan"}</span> : null}
              {Object.keys(queuedUploads).length > 0 ? <span aria-live="polite" className="rounded-full bg-warning-50 px-3 py-1 text-theme-xs font-semibold text-warning-700">{Object.keys(queuedUploads).length} berkas menunggu koneksi</span> : null}
              {remainingSeconds !== null ? <span aria-live="polite" className={`rounded-full px-3 py-1 text-theme-xs font-semibold ${remainingSeconds <= 60 ? "bg-error-50 text-error-700" : "bg-limo-blue-50 text-limo-blue-600"}`}>Sisa {formatDuration(remainingSeconds)}</span> : null}
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progres pengisian">
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: accent }} />
          </div>
          {error ? <p role="alert" className="mt-3 tailadmin-alert-error">{error}</p> : null}
        </section>

        {activeSection && (activeSection.title || activeSection.description) ? (
          <section className="mt-4 rounded-2xl border-l-4 p-5" style={{ backgroundColor: `${accent}14`, borderLeftColor: accent }}>
            {activeSection.title ? <h2 className="text-lg font-bold" style={{ color: darken(accent, 0.25) }}>{activeSection.title}</h2> : null}
            {activeSection.description ? <p className="mt-1 whitespace-pre-wrap text-theme-sm text-gray-700">{activeSection.description}</p> : null}
          </section>
        ) : null}

        <div className="mt-4 space-y-4">
          {shownQuestions.map((question, index) => (
            <section key={question.id} id={`q-${question.id}`} tabIndex={-1} role="group" aria-labelledby={`q-text-${question.id}`} aria-describedby={question.helpText ? `q-help-${question.id}` : undefined} className={`tailadmin-card p-5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-limo-blue-400 ${errorQuestionId === question.id ? "ring-2 ring-error-400" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-full text-theme-xs font-bold text-white" style={{ backgroundColor: accent, color: accentTextOn(accent) }}>{onePerPage ? questionIndex + 1 : index + 1}</span>
                <span className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">{question.required ? "Wajib" : "Opsional"} · {question.weight} poin</span>
              </div>
              {question.stimulusText ? <LocalizedContent as="p" text={question.stimulusText} language={question.language} direction={question.direction} className="mt-3 rounded-2xl bg-gray-50 p-4 text-theme-sm leading-7 text-gray-700">{question.stimulusText}</LocalizedContent> : null}
              <MediaBlock type={question.type} mediaUrl={question.mediaUrl} />
              <LocalizedContent as="p" id={`q-text-${question.id}`} text={question.question} language={question.language} direction={question.direction} className="mt-3 text-lg font-semibold leading-8 text-gray-900">{question.question}</LocalizedContent>
              {question.helpText ? <LocalizedContent as="p" id={`q-help-${question.id}`} text={question.helpText} language={question.language} direction="auto" className="mt-1 text-theme-sm text-gray-500">{question.helpText}</LocalizedContent> : null}
              <AnswerInput
                accent={accent}
                question={question}
                answer={answers[question.id]}
                uploading={uploadingId === question.id}
                onUploadFile={(file) => uploadFileAnswer(question.id, file)}
                onChange={(patch) => setAnswer(question.id, patch)}
              />
            </section>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3 tailadmin-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={submitting || (onePerPage ? currentSection === 0 && questionIndex === 0 : currentSection === 0)} onClick={goPrevious} className="tailadmin-button-outline px-5 py-3 disabled:opacity-40">Sebelumnya</button>
            <button type="button" disabled={submitting} onClick={clearSection} className="tailadmin-button-outline px-4 py-3 text-error-700 disabled:opacity-40">Bersihkan</button>
          </div>
          {(onePerPage ? isLastSection && questionIndex >= visibleQuestions.length - 1 : isLastSection) ? (
            <button type="button" disabled={submitting} onClick={() => void submit(false)} className="tailadmin-button-primary px-6 py-3" style={{ backgroundColor: accent, color: accentTextOn(accent) }}>{submitting ? "Mengirim..." : "Kumpulkan Jawaban"}</button>
          ) : (
            <button type="button" onClick={() => (onePerPage ? goNextOnePerPage() : goNext())} className="tailadmin-button-primary px-6 py-3" style={{ backgroundColor: accent, color: accentTextOn(accent) }}>Berikutnya</button>
          )}
        </div>

        {reviewOpen && context ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4" role="presentation">
            <section role="dialog" aria-modal="true" aria-labelledby="quiz-review-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-theme-xl">
              <h2 id="quiz-review-title" className="text-lg font-semibold text-gray-900">Tinjau jawaban</h2>
              <p className="mt-1 text-theme-sm text-gray-500">Periksa kelengkapan sebelum mengirim. Jawaban tidak dapat diubah setelah dikirim.</p>
              <ul className="mt-4 space-y-2 text-theme-sm">
                {context.sections.map((section, sectionIdx) => {
                  const questions = context.questions.filter((question) => question.sectionIndex === sectionIdx);
                  const answered = questions.filter((question) => isAnswerFilled(answers[question.id])).length;
                  const unanswered = questions.length - answered;
                  return (
                    <li key={sectionIdx} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 px-3 py-2">
                      <span className="font-semibold text-gray-700">{section.title || `Bagian ${sectionIdx + 1}`}</span>
                      <span className={unanswered > 0 ? "text-warning-700" : "text-success-700"}>{answered}/{questions.length} terisi{unanswered > 0 ? ` · ${unanswered} kosong` : ""}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setReviewOpen(false)} disabled={submitting} className="tailadmin-button-outline px-4 py-2.5">Kembali</button>
                <button type="button" onClick={() => void sendAnswers()} disabled={submitting} className="tailadmin-button-primary px-5 py-2.5" style={{ backgroundColor: accent, color: accentTextOn(accent) }}>{submitting ? "Mengirim..." : "Kirim sekarang"}</button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    );
  }

  if (phase === "result" && result) {
    const showScore = result.showScoreImmediately && !result.releasePending;
    return (
      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <div className="tailadmin-card p-6 sm:p-8">
          <h1 className="text-center text-2xl font-extrabold tracking-tight text-gray-900">Terima kasih, {result.respondentName}!</h1>
          <p className="mt-3 text-center text-theme-sm text-gray-600">Jawaban Anda sudah kami terima.</p>
          {context?.quiz.confirmationMessage ? <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-gray-50 p-4 text-center text-theme-sm text-gray-700">{context.quiz.confirmationMessage}</p> : null}
          {showScore ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <InfoTile label="Skor" value={result.score === null ? "-" : String(result.score)} />
              <InfoTile label="KKM" value={result.passingScore === null ? "-" : String(result.passingScore)} />
              <InfoTile label="Status" value={result.passed === null ? "Menunggu peninjauan" : result.passed ? "Lulus" : "Belum lulus"} />
            </div>
          ) : (
            <p className="mt-6 rounded-2xl bg-limo-blue-50 p-4 text-center text-theme-sm text-limo-blue-700">{result.releasePending ? "Nilai akan dirilis oleh guru setelah peninjauan." : "Skor akan diinformasikan oleh guru."}</p>
          )}
          {result.showAnswersAfterSubmit && result.feedback.length > 0 ? (
            <section className="mt-8">
              <h2 className="font-semibold text-gray-900">Pembahasan</h2>
              <ol className="mt-3 space-y-3">
                {result.feedback.map((item, index) => (
                  <li key={item.ujianSoalId} className="rounded-xl border border-gray-200 p-4 text-theme-sm">
                    <p className="font-semibold text-gray-800">{index + 1}. {item.question}</p>
                    <p className="mt-1 text-gray-600">Kunci: {item.correctAnswer ?? item.correctOption ?? "-"}</p>
                    {item.correct !== null ? (
                      <p className={`mt-1 font-semibold ${item.correct ? "text-success-700" : "text-error-700"}`}>{item.correct ? "Jawaban benar" : "Jawaban salah"}</p>
                    ) : null}
                    {item.feedbackText ? <p className="mt-1 text-gray-700">{item.feedbackText}</p> : null}
                    {item.explanation ? <p className="mt-1 text-gray-500">{item.explanation}</p> : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      </div>
    );
  }

  return null;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4 text-center">
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-theme-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  );
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
  if (type === "LISTENING") return <audio controls src={mediaUrl} className="mt-3 w-full" />;
  const embed = mediaEmbedUrl(mediaUrl);
  if (embed) {
    return (
      <div className="mt-3 aspect-video w-full overflow-hidden rounded-2xl border border-gray-100">
        <iframe src={embed} title="Media soal" className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      </div>
    );
  }
  if (type === "GAMBAR" || mediaUrl.startsWith("/api/v1/public/quiz-media/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={mediaUrl} alt="Media soal" className="mt-3 max-h-72 rounded-2xl border border-gray-100 object-contain" />;
  }
  return <a href={mediaUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-theme-sm font-semibold text-limo-blue-600">Buka media soal</a>;
}

function AnswerInput({ question, answer, onChange, accent, onUploadFile, uploading }: { question: PublicQuestion; answer?: DraftAnswer; onChange: (_patch: Partial<DraftAnswer>) => void; accent: string; onUploadFile: (_file: File) => void; uploading: boolean }) {
  if (question.type === "PILIHAN_GANDA") {
    return (
      <div className="mt-3 grid gap-2">
        {question.options.map((option) => {
          const selected = answer?.selectedOption === option.label;
          return (
            <label
              key={option.label}
              style={selected ? { borderColor: accent, backgroundColor: `${accent}0d` } : undefined}
              className={`flex cursor-pointer gap-3 rounded-xl border bg-white p-3 text-theme-sm text-gray-700 transition ${selected ? "" : "border-gray-200 hover:border-gray-300"}`}
            >
              <input type="radio" name={`q-${question.id}`} value={option.label} checked={selected} onChange={() => onChange({ selectedOption: option.label })} className="mt-1 accent-limo-blue-500" />
              <span className="flex-1"><b>{option.label}.</b> <LocalizedContent text={option.content} language={question.language} direction="auto">{option.content}</LocalizedContent></span>
              {option.mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={option.mediaUrl} alt={`Opsi ${option.label}`} className="h-16 w-24 shrink-0 rounded-lg object-cover ring-1 ring-gray-100" />
              ) : null}
            </label>
          );
        })}
        {question.allowOther ? (
          <label
            style={answer?.selectedOption === "OTHER" ? { borderColor: accent, backgroundColor: `${accent}0d` } : undefined}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-3 text-theme-sm text-gray-700 ${answer?.selectedOption === "OTHER" ? "" : "border-gray-200"}`}
          >
            <input type="radio" name={`q-${question.id}`} value="OTHER" checked={answer?.selectedOption === "OTHER"} onChange={() => onChange({ selectedOption: "OTHER" })} className="accent-limo-blue-500" />
            <span className="shrink-0 font-semibold">Lainnya:</span>
            <input type="text" value={answer?.selectedOption === "OTHER" ? answer?.shortAnswer ?? "" : ""} onChange={(event) => onChange({ selectedOption: "OTHER", shortAnswer: event.target.value })} disabled={answer?.selectedOption !== "OTHER"} placeholder="Tulis jawaban" dir="auto" className="tailadmin-input flex-1 py-1.5" />
          </label>
        ) : null}
      </div>
    );
  }

  if (question.type === "MULTI_SELECT") {
    const selected = answer?.selectedOptions ?? [];
    return (
      <div className="mt-3 grid gap-2">
        {question.options.map((option) => {
          const isChecked = selected.includes(option.label);
          return (
            <label
              key={option.label}
              style={isChecked ? { borderColor: accent, backgroundColor: `${accent}0d` } : undefined}
              className={`flex cursor-pointer gap-3 rounded-xl border bg-white p-3 text-theme-sm text-gray-700 transition ${isChecked ? "" : "border-gray-200 hover:border-gray-300"}`}
            >
              <input
                type="checkbox"
                value={option.label}
                checked={isChecked}
                onChange={() => onChange({ selectedOptions: isChecked ? selected.filter((item) => item !== option.label) : [...selected, option.label] })}
                className="mt-1 accent-limo-blue-500"
              />
              <span className="flex-1"><b>{option.label}.</b> <LocalizedContent text={option.content} language={question.language} direction="auto">{option.content}</LocalizedContent></span>
              {option.mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={option.mediaUrl} alt={`Opsi ${option.label}`} className="h-16 w-24 shrink-0 rounded-lg object-cover ring-1 ring-gray-100" />
              ) : null}
            </label>
          );
        })}
        {question.allowOther ? (
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-theme-sm text-gray-700">
            <input type="checkbox" value="OTHER" checked={selected.includes("OTHER")} onChange={() => onChange({ selectedOptions: selected.includes("OTHER") ? selected.filter((item) => item !== "OTHER") : [...selected, "OTHER"] })} className="accent-limo-blue-500" />
            <span className="shrink-0 font-semibold">Lainnya:</span>
            <input type="text" value={selected.includes("OTHER") ? answer?.shortAnswer ?? "" : ""} onChange={(event) => onChange({ selectedOptions: selected.includes("OTHER") ? selected : [...selected, "OTHER"], shortAnswer: event.target.value })} disabled={!selected.includes("OTHER")} placeholder="Tulis jawaban" dir="auto" className="tailadmin-input flex-1 py-1.5" />
          </label>
        ) : null}
      </div>
    );
  }

  if (question.type === "DROPDOWN") {
    return (
      <select
        value={answer?.selectedOption ?? ""}
        onChange={(event) => onChange({ selectedOption: event.target.value })}
        className="mt-3 tailadmin-input sm:max-w-sm"
      >
        <option value="">Pilih jawaban</option>
        {question.options.map((option) => <option key={option.label} value={option.label}>{option.content}</option>)}
      </select>
    );
  }

  if (question.type === "SKALA" || question.type === "RATING") {
    const values = question.options;
    if (question.type === "RATING") {
      return (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {values.map((option) => {
            const active = answer?.selectedOption === option.label;
            return (
              <button
                key={option.label}
                type="button"
                onClick={() => onChange({ selectedOption: option.label })}
                aria-label={`Beri ${option.content} bintang`}
                className={`grid size-11 place-items-center rounded-xl border text-xl transition ${active ? "" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                style={active ? { borderColor: accent, backgroundColor: `${accent}0d` } : undefined}
              >
                {active ? "★" : "☆"}
              </button>
            );
          })}
          {answer?.selectedOption ? <span className="text-theme-sm font-semibold text-gray-600">{values.find((option) => option.label === answer.selectedOption)?.content} bintang</span> : null}
        </div>
      );
    }
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-theme-xs text-gray-400">{question.scaleMinLabel || ""}</span>
        {values.map((option) => {
          const active = answer?.selectedOption === option.label;
          return (
            <button
              key={option.label}
              type="button"
              onClick={() => onChange({ selectedOption: option.label })}
              aria-label={`Pilih nilai ${option.content}`}
              className={`grid size-11 place-items-center rounded-xl border font-semibold transition ${active ? "" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
              style={active ? { borderColor: accent, backgroundColor: `${accent}0d`, color: accent } : undefined}
            >
              {option.content}
            </button>
          );
        })}
        <span className="text-theme-xs text-gray-400">{question.scaleMaxLabel || ""}</span>
      </div>
    );
  }

  if (question.type === "TANGGAL" || question.type === "WAKTU") {
    return (
      <input
        type={question.type === "TANGGAL" ? "date" : "time"}
        value={answer?.shortAnswer ?? ""}
        onChange={(event) => onChange({ shortAnswer: event.target.value })}
        className="mt-3 tailadmin-input sm:max-w-xs"
      />
    );
  }

  if (question.type === "GRID") {
    const structured = answer?.structuredAnswer ?? {};
    const toggle = (rowIndex: number, label: string) => {
      const key = String(rowIndex);
      if (question.gridMultiple) {
        const current = Array.isArray(structured[key]) ? (structured[key] as string[]) : [];
        const next = current.includes(label) ? current.filter((item) => item !== label) : [...current, label];
        onChange({ structuredAnswer: { ...structured, [key]: next } });
      } else {
        onChange({ structuredAnswer: { ...structured, [key]: label } });
      }
    };
    return (
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-theme-sm">
          <thead>
            <tr>
              <th className="border-b border-gray-200 p-2 text-left font-semibold text-gray-500" />
              {question.options.map((option) => (
                <th key={option.label} className="border-b border-gray-200 p-2 text-center font-semibold text-gray-600">{option.content || option.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {question.gridRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="border-b border-gray-100 p-2 text-gray-700">{row}</td>
                {question.options.map((option) => {
                  const value = structured[String(rowIndex)];
                  const checked = question.gridMultiple ? Array.isArray(value) && value.includes(option.label) : value === option.label;
                  return (
                    <td key={option.label} className="border-b border-gray-100 p-2 text-center">
                      <input
                        type={question.gridMultiple ? "checkbox" : "radio"}
                        name={`grid-${question.id}-${rowIndex}`}
                        checked={checked}
                        onChange={() => toggle(rowIndex, option.label)}
                        className="accent-limo-blue-500"
                      />
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

  if (question.type === "FILE_UPLOAD") {
    const rawName = answer?.structuredAnswer?.name;
    const fileName = typeof rawName === "string" ? rawName : "";
    const allowedTypes = question.uploadAllowedTypes ?? [];
    const maxSizeMb = question.uploadMaxSizeMb ?? 0;
    const accept = uploadAcceptAttribute(allowedTypes);
    const hint = allowedTypes.length > 0
      ? `Berkas diizinkan: ${allowedTypes.join(", ")}${maxSizeMb > 0 ? ` · maksimal ${maxSizeMb} MB` : ""}.`
      : `PDF, dokumen, gambar, audio, video, atau zip${maxSizeMb > 0 ? ` · maksimal ${maxSizeMb} MB` : ""}.`;
    return (
      <div className="mt-3 space-y-3">
        <div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-theme-sm font-semibold text-gray-700 hover:bg-gray-50">
            {uploading ? "Mengunggah..." : fileName ? "Ganti berkas" : "Pilih berkas"}
            <input
              type="file"
              accept={accept || undefined}
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onUploadFile(file);
              }}
            />
          </label>
          {fileName ? <p className="mt-2 text-theme-sm text-gray-600">Berkas: {fileName}</p> : <p className="mt-2 text-theme-xs text-gray-500">{hint}</p>}
        </div>
        {canRecordAudio(allowedTypes) ? <AudioRecorder onRecorded={onUploadFile} disabled={uploading} busy={uploading} /> : null}
      </div>
    );
  }

  if (question.type === "BENAR_SALAH") {
    return (
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {[{ value: "benar", label: "Benar" }, { value: "salah", label: "Salah" }].map((item) => {
          const selected = answer?.selectedOption === item.value;
          return (
            <label
              key={item.value}
              style={selected ? { borderColor: accent, backgroundColor: `${accent}0d` } : undefined}
              className={`cursor-pointer rounded-2xl border p-4 text-theme-sm font-semibold text-gray-700 transition ${selected ? "" : "border-transparent bg-gray-50 hover:bg-gray-100"}`}
            >
              <input type="radio" name={`q-${question.id}`} value={item.value} checked={selected} onChange={() => onChange({ selectedOption: item.value })} className="me-2 accent-limo-blue-500" />
              {item.label}
            </label>
          );
        })}
      </div>
    );
  }

  if (["ISIAN_SINGKAT", "CLOZE", "GAMBAR", "LISTENING", "READING"].includes(question.type)) {
    return <ArabicTextField value={answer?.shortAnswer ?? ""} onChange={(event) => onChange({ shortAnswer: event.target.value })} language={question.language} direction="auto" placeholder="Tulis jawaban singkat" className="mt-3 tailadmin-input" />;
  }

  return <ArabicTextField as="textarea" value={answer?.essayAnswer ?? ""} onChange={(event) => onChange({ essayAnswer: event.target.value })} language={question.language} direction="auto" placeholder="Tulis jawaban di sini" className="mt-3 tailadmin-input min-h-32" />;
}

function restoreDraft(value: unknown): Record<string, DraftAnswer> {
  if (!Array.isArray(value)) return {};
  const result: Record<string, DraftAnswer> = {};
  for (const item of value) {
    if (!item || typeof item !== "object" || !("ujianSoalId" in item) || typeof item.ujianSoalId !== "string") continue;
    const record = item as Record<string, unknown>;
    result[item.ujianSoalId] = {
      ujianSoalId: item.ujianSoalId,
      selectedOption: typeof record.selectedOption === "string" ? record.selectedOption : undefined,
      selectedOptions: Array.isArray(record.selectedOptions) ? record.selectedOptions.filter((option): option is string => typeof option === "string") : undefined,
      shortAnswer: typeof record.shortAnswer === "string" ? record.shortAnswer : undefined,
      essayAnswer: typeof record.essayAnswer === "string" ? record.essayAnswer : undefined,
      structuredAnswer: record.structuredAnswer && typeof record.structuredAnswer === "object" ? (record.structuredAnswer as Record<string, string | string[]>) : undefined,
    };
  }
  return result;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}
