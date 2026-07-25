"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type Student = { id: string; name: string; nomorInduk: string };
type ExamQuestion = {
  id: string;
  weight: { toString(): string };
  bankSoal: {
    type: "PILIHAN_GANDA" | "ESAI";
    question: string;
    direction: string | null;
    options: { label: string; content: string }[];
  };
};

export function HasilUjianForm({ ujianId, students, questions, durationMinutes }: { ujianId: string; students: Student[]; questions: ExamQuestion[]; durationMinutes: number }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);

    const answers = questions.map((question) => ({
      ujianSoalId: question.id,
      selectedOption: String(data.get(`selected-${question.id}`) || ""),
      essayAnswer: String(data.get(`essay-${question.id}`) || ""),
      essayScore: String(data.get(`score-${question.id}`) || ""),
    }));

    try {
      const response = await fetch("/api/v1/hasil-ujian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ujianId,
          siswaId: String(data.get("siswaId") || ""),
          answers,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(payload.error?.message || "Hasil ujian gagal disimpan");
      }

      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Hasil ujian gagal disimpan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="tailadmin-card space-y-4 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold text-gray-900">Input Hasil Offline</h2>
        <ExamTimer durationMinutes={durationMinutes} />
      </div>
      {error ? <p className="tailadmin-alert-error">{error}</p> : null}
      <select name="siswaId" required className="tailadmin-input">
        <option value="">Pilih siswa</option>
        {students.map((student) => (
          <option key={student.id} value={student.id}>{student.name} - {student.nomorInduk}</option>
        ))}
      </select>
      <div className="space-y-4">
        {questions.map((question, index) => (
          <section key={question.id} className="rounded-xl bg-gray-50 p-4" dir={question.bankSoal.direction === "rtl" ? "rtl" : "ltr"}>
            <p className="text-theme-sm font-semibold text-gray-500">Soal {index + 1} / Bobot {question.weight.toString()}</p>
            <p className="mt-2 font-semibold text-gray-900">{question.bankSoal.question}</p>
            {question.bankSoal.type === "PILIHAN_GANDA" ? (
              <select name={`selected-${question.id}`} className="tailadmin-input mt-3">
                <option value="">Tidak dijawab</option>
                {question.bankSoal.options.map((option) => (
                  <option key={option.label} value={option.label}>{option.label}. {option.content}</option>
                ))}
              </select>
            ) : (
              <div className="mt-3 grid gap-3">
                <textarea name={`essay-${question.id}`} placeholder="Jawaban esai" className="tailadmin-input min-h-24" />
                <input name={`score-${question.id}`} type="number" min={0} step={0.1} placeholder="Skor esai, kosongkan jika perlu review" className="tailadmin-input" />
              </div>
            )}
          </section>
        ))}
      </div>
      <button disabled={isSubmitting} className="tailadmin-button-primary">
        {isSubmitting ? "Menyimpan..." : "Simpan Hasil"}
      </button>
    </form>
  );
}

function ExamTimer({ durationMinutes }: { durationMinutes: number }) {
  const initialSeconds = durationMinutes * 60;
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!isRunning || remainingSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((value) => Math.max(value - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning, remainingSeconds]);

  const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, "0");
  const seconds = (remainingSeconds % 60).toString().padStart(2, "0");

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-theme-sm text-gray-700">
      <span className="mr-3 font-semibold text-gray-900">Timer {minutes}:{seconds}</span>
      <button type="button" onClick={() => setIsRunning((value) => !value)} className="font-semibold text-brand-500 hover:text-brand-600">
        {isRunning ? "Pause" : "Mulai"}
      </button>
      <button type="button" onClick={() => { setIsRunning(false); setRemainingSeconds(initialSeconds); }} className="ml-3 font-semibold text-gray-500 hover:text-gray-700">
        Reset
      </button>
    </div>
  );
}
