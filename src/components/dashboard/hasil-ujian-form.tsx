"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type Student = { id: string; name: string; nomorInduk: string };
type ExamQuestion = {
  id: string;
  weight: string;
  bankSoal: {
    type: string;
    question: string;
    stimulusText: string | null;
    mediaUrl: string | null;
    expectedAnswer: string | null;
    structuredPayload: unknown;
    rubric: unknown;
    direction: string | null;
    options: { label: string; content: string; isCorrect: boolean }[];
  };
};

function needsManualScore(type: string) {
  return ["MENJODOHKAN", "URUTAN", "GAMBAR", "LISTENING", "SPEAKING", "WRITING", "READING", "ROLEPLAY", "ESAI"].includes(type);
}

function getMatchingPairs(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }

  const pairs = (payload as { pairs?: unknown }).pairs;

  if (!Array.isArray(pairs)) {
    return [];
  }

  return pairs
    .map((item) => item && typeof item === "object" ? item as { left?: unknown; right?: unknown } : undefined)
    .filter((item): item is { left?: unknown; right?: unknown } => Boolean(item))
    .map((item) => ({ left: String(item.left || ""), right: String(item.right || "") }))
    .filter((item) => item.left || item.right);
}

function getSequenceItems(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }

  const items = (payload as { items?: unknown }).items;

  return Array.isArray(items) ? items.map((item) => String(item || "")).filter(Boolean) : [];
}

export function HasilUjianForm({ ujianId, students, questions, durationMinutes }: { ujianId: string; students: Student[]; questions: ExamQuestion[]; durationMinutes: number }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);

    try {
      const answers = questions.map((question) => ({
        ujianSoalId: question.id,
        selectedOption: String(data.get(`selected-${question.id}`) || ""),
        selectedOptions: data.getAll(`selected-${question.id}`).map(String),
        shortAnswer: String(data.get(`short-${question.id}`) || ""),
        essayAnswer: String(data.get(`essay-${question.id}`) || ""),
        essayScore: String(data.get(`score-${question.id}`) || ""),
      }));

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
            <p className="text-theme-sm font-semibold text-gray-500">Soal {index + 1} / {question.bankSoal.type} / Bobot {question.weight}</p>
            {question.bankSoal.stimulusText ? <p className="mt-2 rounded-lg bg-white p-3 text-theme-sm text-gray-700">{question.bankSoal.stimulusText}</p> : null}
            {question.bankSoal.mediaUrl ? <p className="mt-2 text-theme-xs font-semibold text-brand-500">Media: {question.bankSoal.mediaUrl}</p> : null}
            <p className="mt-2 font-semibold text-gray-900">{question.bankSoal.question}</p>
            {question.bankSoal.type === "PILIHAN_GANDA" ? (
              <select name={`selected-${question.id}`} className="tailadmin-input mt-3">
                <option value="">Tidak dijawab</option>
                {question.bankSoal.options.map((option) => (
                  <option key={option.label} value={option.label}>{option.label}. {option.content}</option>
                ))}
              </select>
            ) : question.bankSoal.type === "MULTI_SELECT" ? (
              <div className="mt-3 grid gap-2 text-theme-sm text-gray-700 sm:grid-cols-2">
                {question.bankSoal.options.map((option) => (
                  <label key={option.label} className="rounded-lg bg-white p-3">
                    <input name={`selected-${question.id}`} type="checkbox" value={option.label} className="mr-2 accent-brand-500" />
                    {option.label}. {option.content}
                  </label>
                ))}
              </div>
            ) : question.bankSoal.type === "BENAR_SALAH" ? (
              <select name={`selected-${question.id}`} className="tailadmin-input mt-3">
                <option value="">Tidak dijawab</option>
                <option value="benar">Benar</option>
                <option value="salah">Salah</option>
              </select>
            ) : ["ISIAN_SINGKAT", "CLOZE"].includes(question.bankSoal.type) ? (
              <input name={`short-${question.id}`} placeholder="Jawaban singkat siswa" className="tailadmin-input mt-3" />
            ) : ["MENJODOHKAN", "URUTAN"].includes(question.bankSoal.type) ? (
              <div className="mt-3 grid gap-3">
                {question.bankSoal.type === "MENJODOHKAN" ? <MatchingPreview payload={question.bankSoal.structuredPayload} /> : <SequencePreview payload={question.bankSoal.structuredPayload} />}
                <textarea name={`essay-${question.id}`} placeholder="Catatan jawaban siswa, opsional" className="tailadmin-input min-h-20" />
                <input name={`score-${question.id}`} type="number" min={0} step={0.1} placeholder="Skor manual, kosongkan jika perlu review" className="tailadmin-input" />
              </div>
            ) : (
              <div className="mt-3 grid gap-3">
                <textarea name={`essay-${question.id}`} placeholder="Jawaban, transkrip, catatan performa, atau hasil tulisan siswa" className="tailadmin-input min-h-24" />
                {needsManualScore(question.bankSoal.type) ? <input name={`score-${question.id}`} type="number" min={0} step={0.1} placeholder="Skor manual, kosongkan jika perlu review" className="tailadmin-input" /> : null}
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

function MatchingPreview({ payload }: { payload: unknown }) {
  const pairs = getMatchingPairs(payload);

  if (pairs.length === 0) {
    return <p className="rounded-lg bg-white p-3 text-theme-sm text-gray-600">Periksa jawaban menjodohkan di lembar siswa, lalu isi skor manual.</p>;
  }

  return (
    <div className="rounded-lg bg-white p-3 text-theme-sm text-gray-700">
      <p className="font-semibold text-gray-900">Kunci pasangan</p>
      <ul className="mt-2 grid gap-1">
        {pairs.map((item, index) => <li key={`${item.left}-${index}`}>{item.left} = {item.right}</li>)}
      </ul>
    </div>
  );
}

function SequencePreview({ payload }: { payload: unknown }) {
  const items = getSequenceItems(payload);

  if (items.length === 0) {
    return <p className="rounded-lg bg-white p-3 text-theme-sm text-gray-600">Periksa urutan jawaban di lembar siswa, lalu isi skor manual.</p>;
  }

  return (
    <div className="rounded-lg bg-white p-3 text-theme-sm text-gray-700">
      <p className="font-semibold text-gray-900">Urutan benar</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ol>
    </div>
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
