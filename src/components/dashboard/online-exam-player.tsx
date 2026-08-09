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
        language: string | null;
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
  const [isOnline, setIsOnline] = useState(true);
  const { confirm, dialog } = useConfirmDialog();

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

    if (!navigator.onLine) {
      setSaveState("error");
      return;
    }

    setSaveState("saving");

    try {
      await requestJson(`/api/v1/wali/attempt/${attempt.id}`, {
        method: "PATCH",
        body: { answers },
        keepalive,
        fallbackMessage: "Draf gagal disimpan",
      });

      setSaveState("saved");
    } catch (caught) {
      setSaveState("error");
      if (!navigator.onLine) {
        setError("Koneksi terputus. Draf akan dicoba lagi saat koneksi kembali.");
      }
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

    const updateConnection = () => {
      setIsOnline(navigator.onLine);
    };

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
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [attempt.id]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isOnline) {
      setError("Koneksi internet terputus. Sambungkan kembali sebelum mengumpulkan jawaban.");
      return;
    }

    if (!(await confirm({ title: "Kumpulkan jawaban?", description: "Jawaban tidak bisa diubah setelah submit.", confirmLabel: "Ya, kumpulkan", variant: "destructive" }))) {
      return;
    }

    setError("");
    setIsSubmitting(true);
    const answers = readAnswers();

    try {
      await requestJson(`/api/v1/wali/attempt/${attempt.id}/submit`, {
        method: "POST",
        body: { answers },
        fallbackMessage: "Jawaban gagal dikumpulkan",
      });

      router.push(`/wali/tugas/${attempt.siswa.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Jawaban gagal dikumpulkan");
    } finally {
      setIsSubmitting(false);
    }
  }

  const expiresAt = attempt.expiresAt ? new Date(attempt.expiresAt) : null;
  const submitDisabled = isSubmitting || remainingSeconds === 0 || !isOnline;
  const submitLabel = !isOnline ? "Menunggu koneksi" : isSubmitting ? "Mengumpulkan..." : remainingSeconds === 0 ? "Waktu Habis" : "Kumpulkan Jawaban";

  return (
    <form ref={formRef} onSubmit={onSubmit} onChange={scheduleDraftSave} className="space-y-4">
      <section className="tailadmin-card sticky top-4 z-10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-500">{attempt.siswa.name}</p>
            <h2 className="font-semibold text-gray-900">{attempt.ujian.title}</h2>
            <p className="mt-1 text-theme-xs text-gray-500">{attempt.ujian.questions.length} soal / {attempt.ujian.durationMinutes} menit{expiresAt ? ` / batas ${expiresAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {saveState !== "idle" ? <span className={`rounded-full px-3 py-1 text-center text-theme-xs font-semibold ${saveState === "error" ? "bg-error-50 text-error-700" : saveState === "saving" ? "bg-warning-50 text-warning-700" : "bg-success-50 text-success-700"}`}>{saveState === "saving" ? "Menyimpan draf..." : saveState === "error" ? "Draf belum tersimpan" : "Draf tersimpan"}</span> : null}
              {remainingSeconds !== null ? <span className={`rounded-full px-3 py-1 text-center text-theme-xs font-semibold ${remainingSeconds <= 60 ? "bg-error-50 text-error-700" : "bg-limo-blue-50 text-limo-blue-600"}`}>Sisa waktu {formatDuration(remainingSeconds)}</span> : null}
            </div>
            <button disabled={submitDisabled} className="tailadmin-button-primary px-4 py-2">{submitLabel}</button>
          </div>
        </div>
        {!isOnline ? <p role="alert" className="mt-3 tailadmin-alert-error">Koneksi internet terputus. Jawaban tetap ada di halaman ini, tetapi draft dan submit akan dilanjutkan setelah koneksi pulih.</p> : null}
        {error ? <p className="mt-3 tailadmin-alert-error">{error}</p> : null}
      </section>

      {attempt.ujian.questions.map((question, index) => (
        <section key={question.id} className="tailadmin-card min-w-0 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-theme-sm font-semibold text-limo-blue-500">Soal {index + 1} / {formatUiLabel(question.bankSoal.type)}</p>
            <span className="w-fit rounded-full bg-gray-50 px-3 py-1 text-theme-xs font-semibold text-gray-500">Bobot {question.weight}</span>
          </div>
          {question.bankSoal.stimulusText ? <LocalizedContent as="p" text={question.bankSoal.stimulusText} language={question.bankSoal.language} direction={question.bankSoal.direction} className="mt-4 rounded-2xl bg-gray-50 p-4 text-theme-sm leading-7 text-gray-700">{question.bankSoal.stimulusText}</LocalizedContent> : null}
          <MediaBlock type={question.bankSoal.type} mediaUrl={question.bankSoal.mediaUrl} />
          <LocalizedContent as="p" text={question.bankSoal.question} language={question.bankSoal.language} direction={question.bankSoal.direction} className="mt-4 text-lg font-semibold leading-8 text-gray-900">{question.bankSoal.question}</LocalizedContent>
          <AnswerInput question={question} draft={draftByQuestion.get(question.id)} />
        </section>
      ))}

      <section className="tailadmin-card p-5 text-center">
        <p className="text-theme-sm text-gray-500">Periksa kembali jawaban sebelum dikumpulkan.</p>
        <button disabled={submitDisabled} className="mt-4 tailadmin-button-primary px-6 py-3">{submitLabel}</button>
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

  return <a href={mediaUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-theme-sm font-semibold text-limo-blue-500 hover:text-limo-blue-600">Buka media soal</a>;
}

function AnswerInput({ question, draft }: { question: AttemptContext["ujian"]["questions"][number]; draft?: DraftAnswer }) {
  const type = question.bankSoal.type;

  if (type === "PILIHAN_GANDA") {
    return (
      <div className="mt-4 grid gap-2">
        {question.bankSoal.options.map((option) => (
          <label key={option.label} className="flex cursor-pointer gap-3 rounded-xl border border-gray-200 bg-white p-3 text-theme-sm text-gray-700 hover:bg-gray-25">
            <input name={`selected-${question.id}`} type="radio" value={option.label} defaultChecked={draft?.selectedOption === option.label} className="mt-1 accent-limo-blue-500" />
            <span><b>{option.label}.</b> <LocalizedContent text={option.content} language={question.bankSoal.language} direction="auto">{option.content}</LocalizedContent></span>
          </label>
        ))}
      </div>
    );
  }

  if (type === "MULTI_SELECT") {
    return (
      <div className="mt-4 grid gap-2">
        {question.bankSoal.options.map((option) => (
          <label key={option.label} className="flex cursor-pointer gap-3 rounded-xl border border-gray-200 bg-white p-3 text-theme-sm text-gray-700 hover:bg-gray-25">
            <input name={`selected-${question.id}`} type="checkbox" value={option.label} defaultChecked={draft?.selectedOptions?.includes(option.label)} className="mt-1 accent-limo-blue-500" />
            <span><b>{option.label}.</b> <LocalizedContent text={option.content} language={question.bankSoal.language} direction="auto">{option.content}</LocalizedContent></span>
          </label>
        ))}
      </div>
    );
  }

  if (type === "BENAR_SALAH") {
    return (
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="rounded-2xl bg-gray-50 p-4 text-theme-sm font-semibold text-gray-700"><input name={`selected-${question.id}`} type="radio" value="benar" defaultChecked={draft?.selectedOption === "benar"} className="me-2 accent-limo-blue-500" />Benar</label>
        <label className="rounded-2xl bg-gray-50 p-4 text-theme-sm font-semibold text-gray-700"><input name={`selected-${question.id}`} type="radio" value="salah" defaultChecked={draft?.selectedOption === "salah"} className="me-2 accent-limo-blue-500" />Salah</label>
      </div>
    );
  }

  if (["ISIAN_SINGKAT", "CLOZE", "GAMBAR", "LISTENING", "READING"].includes(type)) {
    return <ArabicTextField name={`short-${question.id}`} defaultValue={draft?.shortAnswer || ""} language={question.bankSoal.language} direction="auto" placeholder="Tulis jawaban singkat" className="mt-4 tailadmin-input" />;
  }

  return <ArabicTextField as="textarea" name={`essay-${question.id}`} defaultValue={draft?.essayAnswer || ""} language={question.bankSoal.language} direction="auto" placeholder="Tulis jawaban di sini. Jawaban akan ditinjau guru." className="mt-4 tailadmin-input min-h-32" />;
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
