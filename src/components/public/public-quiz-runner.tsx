"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArabicTextField, LocalizedContent } from "@/components/localized-content";
import { requestJson } from "@/lib/api-json-client";

type QuizIntro = {
  title: string;
  description: string | null;
  mode: string;
  durationMinutes: number;
  questionCount: number;
  passingScore: number | null;
  collectRespondentName: boolean;
  showScoreImmediately: boolean;
  showAnswersAfterSubmit: boolean;
  shuffleQuestions: boolean;
  programName: string;
  className: string;
};

type PublicQuestion = {
  id: string;
  weight: number;
  required: boolean;
  allowOther: boolean;
  type: string;
  question: string;
  stimulusText: string | null;
  mediaUrl: string | null;
  language: string | null;
  direction: string | null;
  options: { label: string; content: string }[];
};

type DraftAnswer = {
  ujianSoalId: string;
  selectedOption?: string;
  selectedOptions?: string[];
  shortAnswer?: string;
  essayAnswer?: string;
};

type AttemptContext = {
  response: { id: string; status: string; expiresAt: string | null; draftAnswers: unknown; respondentName: string };
  quiz: { title: string; description: string | null; durationMinutes: number; passingScore: number | null; showScoreImmediately: boolean; showAnswersAfterSubmit: boolean };
  questions: PublicQuestion[];
};

type FeedbackItem = {
  ujianSoalId: string;
  question: string;
  correct: boolean | null;
  correctOption: string | null;
  correctAnswer: string | null;
  explanation: string | null;
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
  feedback: FeedbackItem[];
};

export function PublicQuizRunner({ token }: { token: string }) {
  const [phase, setPhase] = useState<"loading" | "intro" | "quiz" | "result" | "error">("loading");
  const [intro, setIntro] = useState<QuizIntro | null>(null);
  const [error, setError] = useState("");
  const [respondentName, setRespondentName] = useState("");
  const [context, setContext] = useState<AttemptContext | null>(null);
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const answersRef = useRef(answers);
  const expiresAtRef = useRef<string | null>(null);
  const submitRef = useRef<((_auto?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    let active = true;
    requestJson<{ quiz: QuizIntro }>(`/api/v1/public/quiz/${token}`)
      .then((response) => {
        if (!active) return;
        setIntro(response.data.quiz);
        setPhase("intro");
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : "Kuis tidak dapat dibuka");
        setPhase("error");
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function start() {
    setError("");
    setPhase("loading");
    try {
      const started = await requestJson<{ responseId: string }>(`/api/v1/public/quiz/${token}/responses`, {
        method: "POST",
        body: { respondentName: respondentName.trim() || "Responden" },
        fallbackMessage: "Kuis gagal dimulai",
      });
      const ctx = await requestJson<AttemptContext>(`/api/v1/public/quiz/${token}/responses/${started.data.responseId}`);
      setContext(ctx.data);
      setAnswers(restoreDraft(ctx.data.response.draftAnswers));
      expiresAtRef.current = ctx.data.response.expiresAt;
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

  function isAnswered(question: PublicQuestion, answer: DraftAnswer | undefined) {
    if (!answer) return false;
    const otherText = answer.shortAnswer?.trim();
    if (answer.selectedOption) return answer.selectedOption === "OTHER" ? Boolean(otherText) : true;
    if (answer.selectedOptions?.length) return answer.selectedOptions.includes("OTHER") ? Boolean(otherText) : true;
    return Boolean(otherText || answer.essayAnswer?.trim());
  }

  function firstMissingRequired() {
    if (!context) return null;
    for (const [index, question] of context.questions.entries()) {
      if (!question.required) continue;
      if (!isAnswered(question, answers[question.id])) return index + 1;
    }
    return null;
  }

  async function submit(auto = false) {
    if (!context) return;
    if (!auto) {
      const missing = firstMissingRequired();
      if (missing) {
        setError(`Soal ${missing} wajib diisi sebelum mengumpulkan.`);
        return;
      }
      if (!window.confirm("Kumpulkan jawaban? Jawaban tidak bisa diubah setelah dikirim.")) return;
    }
    setSubmitting(true);
    setError("");
    try {
      await requestJson(`/api/v1/public/quiz/${token}/responses/${context.response.id}/submit`, { method: "POST", body: { answers: buildAnswers() }, fallbackMessage: "Jawaban gagal dikumpulkan" });
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

  useEffect(() => {
    submitRef.current = submit;
  });

  const progress = useMemo(() => {
    if (!context) return 0;
    const answered = context.questions.filter((question) => isAnswered(question, answers[question.id])).length;
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
        <div className="tailadmin-card p-6 sm:p-8">
          <p className="text-theme-xs font-bold uppercase tracking-widest text-limo-blue-600">{intro.programName} / {intro.className}</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">{intro.title}</h1>
          {intro.description ? <p className="mt-3 whitespace-pre-wrap text-theme-sm leading-7 text-gray-600">{intro.description}</p> : null}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <InfoTile label="Soal" value={String(intro.questionCount)} />
            <InfoTile label="Durasi" value={`${intro.durationMinutes} menit`} />
            <InfoTile label="KKM" value={intro.passingScore === null ? "-" : String(intro.passingScore)} />
          </div>
          {error ? <p className="mt-4 tailadmin-alert-error">{error}</p> : null}
          {intro.collectRespondentName ? (
            <label className="mt-6 block text-theme-sm font-semibold text-gray-700">
              Nama Anda
              <input value={respondentName} onChange={(event) => setRespondentName(event.target.value)} placeholder="Tulis nama lengkap" className="tailadmin-input mt-2" />
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => void start()}
            disabled={intro.collectRespondentName && respondentName.trim().length < 2}
            className="tailadmin-button-primary mt-6 w-full py-3"
          >
            Mulai Kerjakan
          </button>
        </div>
      </div>
    );
  }

  if (phase === "quiz" && context) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <section className="tailadmin-card sticky top-3 z-10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate font-semibold text-gray-900">{context.quiz.title}</h1>
              <p className="mt-1 text-theme-xs text-gray-500">{context.questions.length} soal / {progress}% terisi</p>
            </div>
            <div className="flex items-center gap-2">
              {saveState !== "idle" ? <span className={`rounded-full px-3 py-1 text-theme-xs font-semibold ${saveState === "error" ? "bg-error-50 text-error-700" : saveState === "saving" ? "bg-warning-50 text-warning-700" : "bg-success-50 text-success-700"}`}>{saveState === "saving" ? "Menyimpan..." : saveState === "error" ? "Belum tersimpan" : "Tersimpan"}</span> : null}
              {remainingSeconds !== null ? <span className={`rounded-full px-3 py-1 text-theme-xs font-semibold ${remainingSeconds <= 60 ? "bg-error-50 text-error-700" : "bg-limo-blue-50 text-limo-blue-600"}`}>Sisa {formatDuration(remainingSeconds)}</span> : null}
              <button type="button" disabled={submitting} onClick={() => void submit(false)} className="tailadmin-button-primary px-4 py-2">{submitting ? "Mengirim..." : "Kumpulkan"}</button>
            </div>
          </div>
          {error ? <p className="mt-3 tailadmin-alert-error">{error}</p> : null}
        </section>

        <div className="mt-4 space-y-4">
          {context.questions.map((question, index) => (
            <section key={question.id} className="tailadmin-card p-5">
              <p className="text-theme-sm font-semibold text-limo-blue-600">Soal {index + 1} / {question.weight} poin</p>
              {question.stimulusText ? <LocalizedContent as="p" text={question.stimulusText} language={question.language} direction={question.direction} className="mt-3 rounded-2xl bg-gray-50 p-4 text-theme-sm leading-7 text-gray-700">{question.stimulusText}</LocalizedContent> : null}
              <MediaBlock type={question.type} mediaUrl={question.mediaUrl} />
              <LocalizedContent as="p" text={question.question} language={question.language} direction={question.direction} className="mt-3 text-lg font-semibold leading-8 text-gray-900">{question.question}</LocalizedContent>
              <AnswerInput question={question} answer={answers[question.id]} onChange={(patch) => setAnswer(question.id, patch)} />
            </section>
          ))}
        </div>

        <div className="mt-4 tailadmin-card p-5 text-center">
          <button type="button" disabled={submitting} onClick={() => void submit(false)} className="tailadmin-button-primary px-6 py-3">{submitting ? "Mengirim..." : "Kumpulkan Jawaban"}</button>
        </div>
      </div>
    );
  }

  if (phase === "result" && result) {
    const showScore = result.showScoreImmediately;
    return (
      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <div className="tailadmin-card p-6 sm:p-8">
          <h1 className="text-center text-2xl font-extrabold tracking-tight text-gray-900">Terima kasih, {result.respondentName}!</h1>
          <p className="mt-3 text-center text-theme-sm text-gray-600">Jawaban Anda sudah kami terima.</p>
          {showScore ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <InfoTile label="Skor" value={result.score === null ? "-" : String(result.score)} />
              <InfoTile label="KKM" value={result.passingScore === null ? "-" : String(result.passingScore)} />
              <InfoTile label="Status" value={result.passed === null ? "Menunggu peninjauan" : result.passed ? "Lulus" : "Belum lulus"} />
            </div>
          ) : (
            <p className="mt-6 rounded-2xl bg-limo-blue-50 p-4 text-center text-theme-sm text-limo-blue-700">Skor akan diinformasikan oleh guru.</p>
          )}
          {result.showAnswersAfterSubmit && result.feedback.length > 0 ? (
            <section className="mt-8">
              <h2 className="font-semibold text-gray-900">Pembahasan</h2>
              <ol className="mt-3 space-y-3">
                {result.feedback.map((item, index) => (
                  <li key={item.ujianSoalId} className="rounded-xl border border-gray-200 p-4 text-theme-sm">
                    <p className="font-semibold text-gray-800">{index + 1}. {item.question}</p>
                    <p className="mt-1 text-gray-600">Kunci: {item.correctAnswer ?? item.correctOption ?? "-"}</p>
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

function MediaBlock({ type, mediaUrl }: { type: string; mediaUrl: string | null }) {
  if (!mediaUrl) return null;
  if (type === "LISTENING") return <audio controls src={mediaUrl} className="mt-3 w-full" />;
  if (type === "GAMBAR") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={mediaUrl} alt="Media soal" className="mt-3 max-h-72 rounded-2xl border border-gray-100 object-contain" />;
  }
  return <a href={mediaUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-theme-sm font-semibold text-limo-blue-600">Buka media soal</a>;
}

function AnswerInput({ question, answer, onChange }: { question: PublicQuestion; answer?: DraftAnswer; onChange: (_patch: Partial<DraftAnswer>) => void }) {
  if (question.type === "PILIHAN_GANDA") {
    return (
      <div className="mt-3 grid gap-2">
        {question.options.map((option) => (
          <label key={option.label} className="flex cursor-pointer gap-3 rounded-xl border border-gray-200 bg-white p-3 text-theme-sm text-gray-700">
            <input type="radio" name={`q-${question.id}`} value={option.label} checked={answer?.selectedOption === option.label} onChange={() => onChange({ selectedOption: option.label })} className="mt-1 accent-limo-blue-500" />
            <span><b>{option.label}.</b> <LocalizedContent text={option.content} language={question.language} direction="auto">{option.content}</LocalizedContent></span>
          </label>
        ))}
        {question.allowOther ? (
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-theme-sm text-gray-700">
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
        {question.options.map((option) => (
          <label key={option.label} className="flex cursor-pointer gap-3 rounded-xl border border-gray-200 bg-white p-3 text-theme-sm text-gray-700">
            <input
              type="checkbox"
              value={option.label}
              checked={selected.includes(option.label)}
              onChange={() => onChange({ selectedOptions: selected.includes(option.label) ? selected.filter((item) => item !== option.label) : [...selected, option.label] })}
              className="mt-1 accent-limo-blue-500"
            />
            <span><b>{option.label}.</b> <LocalizedContent text={option.content} language={question.language} direction="auto">{option.content}</LocalizedContent></span>
          </label>
        ))}
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

  if (question.type === "BENAR_SALAH") {
    return (
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="rounded-2xl bg-gray-50 p-4 text-theme-sm font-semibold text-gray-700"><input type="radio" name={`q-${question.id}`} value="benar" checked={answer?.selectedOption === "benar"} onChange={() => onChange({ selectedOption: "benar" })} className="me-2 accent-limo-blue-500" />Benar</label>
        <label className="rounded-2xl bg-gray-50 p-4 text-theme-sm font-semibold text-gray-700"><input type="radio" name={`q-${question.id}`} value="salah" checked={answer?.selectedOption === "salah"} onChange={() => onChange({ selectedOption: "salah" })} className="me-2 accent-limo-blue-500" />Salah</label>
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
    };
  }
  return result;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}
