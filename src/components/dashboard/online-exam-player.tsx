"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type AttemptContext = {
  id: string;
  expiresAt: Date | string | null;
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
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!window.confirm("Kumpulkan jawaban sekarang? Jawaban tidak bisa diubah setelah submit.")) {
      return;
    }

    setError("");
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);
    const answers = attempt.ujian.questions.map((question) => ({
      ujianSoalId: question.id,
      selectedOption: String(data.get(`selected-${question.id}`) || ""),
      selectedOptions: data.getAll(`selected-${question.id}`).map(String),
      shortAnswer: String(data.get(`short-${question.id}`) || ""),
      essayAnswer: String(data.get(`essay-${question.id}`) || ""),
    }));

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
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="tailadmin-card sticky top-4 z-10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{attempt.siswa.name}</p>
            <h2 className="font-semibold text-gray-900">{attempt.ujian.title}</h2>
            <p className="mt-1 text-theme-xs text-gray-500">{attempt.ujian.questions.length} soal / {attempt.ujian.durationMinutes} menit{expiresAt ? ` / batas ${expiresAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            {remainingSeconds !== null ? <span className={`rounded-full px-3 py-1 text-center text-theme-xs font-semibold ${remainingSeconds <= 60 ? "bg-error-50 text-error-700" : "bg-brand-50 text-brand-600"}`}>Sisa waktu {formatDuration(remainingSeconds)}</span> : null}
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
          <AnswerInput question={question} />
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

function AnswerInput({ question }: { question: AttemptContext["ujian"]["questions"][number] }) {
  const type = question.bankSoal.type;

  if (type === "PILIHAN_GANDA") {
    return (
      <div className="mt-4 grid gap-2">
        {question.bankSoal.options.map((option) => (
          <label key={option.label} className="flex cursor-pointer gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-theme-sm text-gray-700 hover:border-brand-200 hover:bg-brand-50/40">
            <input name={`selected-${question.id}`} type="radio" value={option.label} className="mt-1 accent-brand-500" />
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
            <input name={`selected-${question.id}`} type="checkbox" value={option.label} className="mt-1 accent-brand-500" />
            <span><b>{option.label}.</b> {option.content}</span>
          </label>
        ))}
      </div>
    );
  }

  if (type === "BENAR_SALAH") {
    return (
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="rounded-2xl bg-gray-50 p-4 text-theme-sm font-semibold text-gray-700"><input name={`selected-${question.id}`} type="radio" value="benar" className="mr-2 accent-brand-500" />Benar</label>
        <label className="rounded-2xl bg-gray-50 p-4 text-theme-sm font-semibold text-gray-700"><input name={`selected-${question.id}`} type="radio" value="salah" className="mr-2 accent-brand-500" />Salah</label>
      </div>
    );
  }

  if (["ISIAN_SINGKAT", "CLOZE", "GAMBAR", "LISTENING", "READING"].includes(type)) {
    return <input name={`short-${question.id}`} placeholder="Tulis jawaban singkat" className="mt-4 tailadmin-input" />;
  }

  return <textarea name={`essay-${question.id}`} placeholder="Tulis jawaban di sini. Jawaban akan direview guru." className="mt-4 tailadmin-input min-h-32" />;
}
