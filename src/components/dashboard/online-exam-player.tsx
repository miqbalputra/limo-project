"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

type DraftAnswer = {
  ujianSoalId: string;
  selectedOption?: string;
  selectedOptions?: string[];
  shortAnswer?: string;
  essayAnswer?: string;
};

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
    questions: {
      id: string;
      weight: string;
      bankSoal: {
        type: string;
        question: string;
        stimulusText: string | null;
        mediaUrl: string | null;
        direction: string | null;
        options: { label: string; content: string }[];
      };
    }[];
  };
};

export function OnlineExamPlayer({ attempt }: { attempt: AttemptContext }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const saveDraftRef = useRef<((_keepalive?: boolean) => Promise<void>) | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(attempt.draftSavedAt ? "saved" : "idle");

  const draftByQuestion = new Map(normalizeDraft(attempt.draftAnswers).map((answer) => [answer.ujianSoalId, answer]));

  useEffect(() => {
    if (!attempt.expiresAt) {
      return;
    }

    const expiresAt = new Date(attempt.expiresAt).getTime();
    const update = () => setRemainingSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [attempt.expiresAt]);

  function readAnswers() {
    const form = formRef.current;
    if (!form) {
      return [];
    }

    const data = new FormData(form);
    return attempt.ujian.questions.map((question) => ({
      ujianSoalId: question.id,
      selectedOption: String(data.get(`selected-${question.id}`) || ""),
      selectedOptions: data.getAll(`selected-${question.id}`).map(String),
      shortAnswer: String(data.get(`short-${question.id}`) || ""),
      essayAnswer: String(data.get(`essay-${question.id}`) || ""),
    }));
  }

  async function saveDraft(keepalive = false) {
    const answers = readAnswers();
    if (!answers.length) {
      return;
    }

    setSaveState("saving");

    try {
      const response = await fetch(`/api/v1/wali/attempt/${attempt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
        keepalive,
      });
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };

      if (!response.ok) {
        throw new Error(payload.error?.message || "Draft gagal disimpan");
      }

      setSaveState("saved");
    } catch (caught) {
      setSaveState("error");
      if (caught instanceof Error && caught.message.includes("habis")) {
        setError(caught.message);
      }
    }
  }

  useEffect(() => {
    saveDraftRef.current = saveDraft;
  });

  function scheduleDraftSave() {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

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

    document.addEventListener("visibilitychange", flushDraft);
    window.addEventListener("pagehide", flushDraft);

    return () => {
      document.removeEventListener("visibilitychange", flushDraft);
      window.removeEventListener("pagehide", flushDraft);
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [attempt.id]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!window.confirm("Kumpulkan jawaban sekarang? Jawaban tidak bisa diubah setelah submit.")) {
      return;
    }

    setError("");
    setIsSubmitting(true);
    const answers = readAnswers();

    try {
      const response = await fetch(`/api/v1/wali/attempt/${attempt.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };

      if (!response.ok) {
        throw new Error(payload.error?.message || "Jawaban gagal dikumpulkan");
      }

      router.push(`/wali/tugas/${attempt.siswa.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Jawaban gagal dikumpulkan");
    } finally {
      setIsSubmitting(false);
    }
  }

  const expiresAt = attempt.expiresAt ? new Date(attempt.expiresAt) : null;

  return (
    <form ref={formRef} onSubmit={onSubmit} onChange={scheduleDraftSave} className="space-y-4">
      <section className="tailadmin-card sticky top-4 z-10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{attempt.siswa.name}</p>
            <h2 className="font-semibold text-gray-900">{attempt.ujian.title}</h2>
            <p className="mt-1 text-theme-xs text-gray-500">{attempt.ujian.questions.length} soal / {attempt.ujian.durationMinutes} menit{expiresAt ? ` / batas ${expiresAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {saveState !== "idle" ? <span className={`rounded-full px-3 py-1 text-center text-theme-xs font-semibold ${saveState === "error" ? "bg-error-50 text-error-700" : saveState === "saving" ? "bg-warning-50 text-warning-700" : "bg-success-50 text-success-700"}`}>{saveState === "saving" ? "Menyimpan draft..." : saveState === "error" ? "Draft belum tersimpan" : "Draft tersimpan"}</span> : null}
              {remainingSeconds !== null ? <span className={`rounded-full px-3 py-1 text-center text-theme-xs font-semibold ${remainingSeconds <= 60 ? "bg-error-50 text-error-700" : "bg-brand-50 text-brand-600"}`}>Sisa waktu {formatDuration(remainingSeconds)}</span> : null}
            </div>
            <button disabled={isSubmitting || remainingSeconds === 0} className="tailadmin-button-primary px-4 py-2">{isSubmitting ? "Mengumpulkan..." : remainingSeconds === 0 ? "Waktu Habis" : "Kumpulkan Jawaban"}</button>
          </div>
        </div>
        {error ? <p className="mt-3 tailadmin-alert-error">{error}</p> : null}
      </section>

      {attempt.ujian.questions.map((question, index) => (
        <section key={question.id} className="tailadmin-card min-w-0 p-5" dir={question.bankSoal.direction === "rtl" ? "rtl" : "ltr"}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-theme-sm font-semibold text-brand-500">Soal {index + 1} / {question.bankSoal.type}</p>
            <span className="w-fit rounded-full bg-gray-50 px-3 py-1 text-theme-xs font-semibold text-gray-500">Bobot {question.weight}</span>
          </div>
          {question.bankSoal.stimulusText ? <p className="mt-4 rounded-2xl bg-gray-50 p-4 text-theme-sm leading-6 text-gray-700">{question.bankSoal.stimulusText}</p> : null}
          <MediaBlock type={question.bankSoal.type} mediaUrl={question.bankSoal.mediaUrl} />
          <p className="mt-4 text-lg font-semibold leading-7 text-gray-900">{question.bankSoal.question}</p>
          <AnswerInput question={question} draft={draftByQuestion.get(question.id)} />
        </section>
      ))}

      <section className="tailadmin-card p-5 text-center">
        <p className="text-theme-sm text-gray-500">Periksa kembali jawaban sebelum dikumpulkan.</p>
        <button disabled={isSubmitting || remainingSeconds === 0} className="mt-4 tailadmin-button-primary px-6 py-3">{isSubmitting ? "Mengumpulkan..." : remainingSeconds === 0 ? "Waktu Habis" : "Kumpulkan Jawaban"}</button>
      </section>
    </form>
  );
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function MediaBlock({ type, mediaUrl }: { type: string; mediaUrl: string | null }) {
  if (!mediaUrl) {
    return null;
  }

  if (type === "LISTENING") {
    return <audio controls src={mediaUrl} className="mt-4 w-full" />;
  }

  if (type === "GAMBAR") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={mediaUrl} alt="Media soal" className="mt-4 max-h-72 rounded-2xl border border-gray-100 object-contain" />;
  }

  return <a href={mediaUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-theme-sm font-semibold text-brand-500 hover:text-brand-600">Buka media soal</a>;
}

function AnswerInput({ question, draft }: { question: AttemptContext["ujian"]["questions"][number]; draft?: DraftAnswer }) {
  const type = question.bankSoal.type;

  if (type === "PILIHAN_GANDA") {
    return (
      <div className="mt-4 grid gap-2">
        {question.bankSoal.options.map((option) => (
          <label key={option.label} className="flex cursor-pointer gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-theme-sm text-gray-700 hover:border-brand-200 hover:bg-brand-50/40">
            <input name={`selected-${question.id}`} type="radio" value={option.label} defaultChecked={draft?.selectedOption === option.label} className="mt-1 accent-brand-500" />
            <span><b>{option.label}.</b> {option.content}</span>
          </label>
        ))}
      </div>
    );
  }

  if (type === "MULTI_SELECT") {
    return (
      <div className="mt-4 grid gap-2">
        {question.bankSoal.options.map((option) => (
          <label key={option.label} className="flex cursor-pointer gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-theme-sm text-gray-700 hover:border-brand-200 hover:bg-brand-50/40">
            <input name={`selected-${question.id}`} type="checkbox" value={option.label} defaultChecked={draft?.selectedOptions?.includes(option.label)} className="mt-1 accent-brand-500" />
            <span><b>{option.label}.</b> {option.content}</span>
          </label>
        ))}
      </div>
    );
  }

  if (type === "BENAR_SALAH") {
    return (
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="rounded-2xl bg-gray-50 p-4 text-theme-sm font-semibold text-gray-700"><input name={`selected-${question.id}`} type="radio" value="benar" defaultChecked={draft?.selectedOption === "benar"} className="mr-2 accent-brand-500" />Benar</label>
        <label className="rounded-2xl bg-gray-50 p-4 text-theme-sm font-semibold text-gray-700"><input name={`selected-${question.id}`} type="radio" value="salah" defaultChecked={draft?.selectedOption === "salah"} className="mr-2 accent-brand-500" />Salah</label>
      </div>
    );
  }

  if (["ISIAN_SINGKAT", "CLOZE", "GAMBAR", "LISTENING", "READING"].includes(type)) {
    return <input name={`short-${question.id}`} defaultValue={draft?.shortAnswer || ""} placeholder="Tulis jawaban singkat" className="mt-4 tailadmin-input" />;
  }

  return <textarea name={`essay-${question.id}`} defaultValue={draft?.essayAnswer || ""} placeholder="Tulis jawaban di sini. Jawaban akan direview guru." className="mt-4 tailadmin-input min-h-32" />;
}

function normalizeDraft(value: unknown): DraftAnswer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || !("ujianSoalId" in item) || typeof item.ujianSoalId !== "string") {
      return [];
    }

    const answer = item as Record<string, unknown>;
    return [{
      ujianSoalId: item.ujianSoalId,
      selectedOption: typeof answer.selectedOption === "string" ? answer.selectedOption : undefined,
      selectedOptions: Array.isArray(answer.selectedOptions) ? answer.selectedOptions.filter((option): option is string => typeof option === "string") : undefined,
      shortAnswer: typeof answer.shortAnswer === "string" ? answer.shortAnswer : undefined,
      essayAnswer: typeof answer.essayAnswer === "string" ? answer.essayAnswer : undefined,
    }];
  });
}
