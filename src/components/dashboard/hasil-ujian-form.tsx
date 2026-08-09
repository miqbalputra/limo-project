"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArabicTextField, LocalizedContent } from "@/components/localized-content";
import { resolveLocalizedContent } from "@/lib/localized-content";
import { formatUiLabel } from "@/lib/ui-labels";
import { requestJson } from "@/lib/api-json-client";

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
    language: string | null;
    direction: string | null;
    options: { label: string; content: string; isCorrect: boolean }[];
  };
};

export type InitialExamAnswer = {
  selectedOption?: string | null;
  selectedOptions?: string[];
  shortAnswer?: string | null;
  essayAnswer?: string | null;
  essayScore?: string | number | null;
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

export function HasilUjianForm({
  ujianId,
  students,
  questions,
  durationMinutes,
  mode = "input",
  submitPath = "/api/v1/hasil-ujian",
  initialStudentId,
  initialAnswers = {},
}: {
  ujianId: string;
  students: Student[];
  questions: ExamQuestion[];
  durationMinutes: number;
  mode?: "input" | "correction";
  submitPath?: string;
  initialStudentId?: string;
  initialAnswers?: Record<string, InitialExamAnswer>;
}) {
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

      const payload = mode === "correction"
        ? {
            reason: String(data.get("reason") || ""),
            answers,
          }
        : {
            ujianId,
            siswaId: String(data.get("siswaId") || ""),
            answers,
          };

      await requestJson(submitPath, { method: "POST", body: payload, fallbackMessage: "Hasil ujian gagal disimpan" });

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
        <h2 className="font-semibold text-gray-900">{mode === "correction" ? "Koreksi Hasil Ujian" : "Input Hasil Offline"}</h2>
        {mode === "correction" ? <span className="rounded-full bg-warning-50 px-3 py-1 text-theme-xs font-semibold text-warning-700">Perubahan diaudit</span> : <ExamTimer durationMinutes={durationMinutes} />}
      </div>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      {mode === "correction" ? <input type="hidden" name="siswaId" value={initialStudentId || ""} /> : null}
      {mode === "correction" ? <input name="reason" required minLength={5} maxLength={1000} placeholder="Alasan koreksi" className="tailadmin-input" /> : null}
      <select disabled={mode === "correction"} name={mode === "input" ? "siswaId" : undefined} required className="tailadmin-input" defaultValue={initialStudentId || ""}>
        <option value="">Pilih siswa</option>
        {students.map((student) => (
          <option key={student.id} value={student.id}>{student.name} - {student.nomorInduk}</option>
        ))}
      </select>
      <div className="space-y-4">
        {questions.map((question, index) => (
          (() => {
            const initial = initialAnswers[question.id];
            const optionLocale = resolveLocalizedContent({
              language: question.bankSoal.language,
              direction: question.bankSoal.direction,
              text: question.bankSoal.options.map((option) => option.content).join(" "),
            });

            return (
          <section key={question.id} className="rounded-xl bg-gray-50 p-4">
            <p className="text-theme-sm font-semibold text-gray-500">Soal {index + 1} / {formatUiLabel(question.bankSoal.type)} / Bobot {question.weight}</p>
            {question.bankSoal.stimulusText ? <LocalizedContent as="p" text={question.bankSoal.stimulusText} language={question.bankSoal.language} direction={question.bankSoal.direction} className="mt-2 rounded-lg bg-white p-3 text-theme-sm leading-7 text-gray-700">{question.bankSoal.stimulusText}</LocalizedContent> : null}
            {question.bankSoal.mediaUrl ? <p className="mt-2 text-theme-xs font-semibold text-limo-blue-500">Media: {question.bankSoal.mediaUrl}</p> : null}
            <LocalizedContent as="p" text={question.bankSoal.question} language={question.bankSoal.language} direction={question.bankSoal.direction} className="mt-2 font-semibold leading-7 text-gray-900">{question.bankSoal.question}</LocalizedContent>
            {question.bankSoal.type === "PILIHAN_GANDA" ? (
                <select name={`selected-${question.id}`} defaultValue={initial?.selectedOption || ""} lang={optionLocale.language} dir={optionLocale.direction} className="tailadmin-input mt-3">
                <option value="" lang="id" dir="ltr">Tidak dijawab</option>
                {question.bankSoal.options.map((option) => (
                  <option key={option.label} value={option.label}>{option.label}. {option.content}</option>
                ))}
              </select>
            ) : question.bankSoal.type === "MULTI_SELECT" ? (
              <div className="mt-3 grid gap-2 text-theme-sm text-gray-700 sm:grid-cols-2">
                {question.bankSoal.options.map((option) => (
                  <label key={option.label} className="rounded-lg bg-white p-3">
                    <input name={`selected-${question.id}`} type="checkbox" value={option.label} defaultChecked={initial?.selectedOptions?.includes(option.label) || false} className="me-2 accent-limo-blue-500" />
                    {option.label}. <LocalizedContent text={option.content} language={question.bankSoal.language} direction={question.bankSoal.direction}>{option.content}</LocalizedContent>
                  </label>
                ))}
              </div>
            ) : question.bankSoal.type === "BENAR_SALAH" ? (
              <select name={`selected-${question.id}`} defaultValue={initial?.selectedOption || ""} className="tailadmin-input mt-3">
                <option value="">Tidak dijawab</option>
                <option value="benar">Benar</option>
                <option value="salah">Salah</option>
              </select>
            ) : ["ISIAN_SINGKAT", "CLOZE"].includes(question.bankSoal.type) ? (
              <ArabicTextField name={`short-${question.id}`} defaultValue={initial?.shortAnswer || ""} language={question.bankSoal.language} direction="auto" placeholder="Jawaban singkat siswa" className="tailadmin-input mt-3" />
            ) : ["MENJODOHKAN", "URUTAN"].includes(question.bankSoal.type) ? (
              <div className="mt-3 grid gap-3">
                {question.bankSoal.type === "MENJODOHKAN" ? <MatchingPreview payload={question.bankSoal.structuredPayload} language={question.bankSoal.language} direction={question.bankSoal.direction} /> : <SequencePreview payload={question.bankSoal.structuredPayload} language={question.bankSoal.language} direction={question.bankSoal.direction} />}
                <ArabicTextField as="textarea" name={`essay-${question.id}`} defaultValue={initial?.essayAnswer || ""} language={question.bankSoal.language} direction="auto" placeholder="Catatan jawaban siswa, opsional" className="tailadmin-input min-h-20" />
                <input name={`score-${question.id}`} defaultValue={initial?.essayScore?.toString() || ""} type="number" min={0} step={0.1} placeholder="Skor manual, kosongkan jika perlu ditinjau" className="tailadmin-input" />
              </div>
            ) : (
              <div className="mt-3 grid gap-3">
                <ArabicTextField as="textarea" name={`essay-${question.id}`} defaultValue={initial?.essayAnswer || ""} language={question.bankSoal.language} direction="auto" placeholder="Jawaban, transkrip, catatan performa, atau hasil tulisan siswa" className="tailadmin-input min-h-24" />
                {needsManualScore(question.bankSoal.type) ? <input name={`score-${question.id}`} defaultValue={initial?.essayScore?.toString() || ""} type="number" min={0} step={0.1} placeholder="Skor manual, kosongkan jika perlu ditinjau" className="tailadmin-input" /> : null}
              </div>
            )}
          </section>
            );
          })()
        ))}
      </div>
      <button disabled={isSubmitting} className="tailadmin-button-primary">
        {isSubmitting ? "Menyimpan..." : mode === "correction" ? "Simpan Koreksi" : "Simpan Hasil"}
      </button>
    </form>
  );
}

function MatchingPreview({ payload, language, direction }: { payload: unknown; language: string | null; direction: string | null }) {
  const pairs = getMatchingPairs(payload);

  if (pairs.length === 0) {
    return <p className="rounded-lg bg-white p-3 text-theme-sm text-gray-600">Periksa jawaban menjodohkan di lembar siswa, lalu isi skor manual.</p>;
  }

  return (
    <div className="rounded-lg bg-white p-3 text-theme-sm text-gray-700">
      <p className="font-semibold text-gray-900">Kunci pasangan</p>
      <ul className="mt-2 grid gap-1">
        {pairs.map((item, index) => <li key={`${item.left}-${index}`}><LocalizedContent text={item.left} language={language} direction={direction}>{item.left}</LocalizedContent> = <LocalizedContent text={item.right} language={language} direction={direction}>{item.right}</LocalizedContent></li>)}
      </ul>
    </div>
  );
}

function SequencePreview({ payload, language, direction }: { payload: unknown; language: string | null; direction: string | null }) {
  const items = getSequenceItems(payload);

  if (items.length === 0) {
    return <p className="rounded-lg bg-white p-3 text-theme-sm text-gray-600">Periksa urutan jawaban di lembar siswa, lalu isi skor manual.</p>;
  }

  return (
    <div className="rounded-lg bg-white p-3 text-theme-sm text-gray-700">
      <p className="font-semibold text-gray-900">Urutan benar</p>
      <ol className="mt-2 list-decimal space-y-1 ps-5">
        {items.map((item, index) => <li key={`${item}-${index}`}><LocalizedContent text={item} language={language} direction={direction}>{item}</LocalizedContent></li>)}
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
        <span className="me-3 font-semibold text-gray-900">Pengatur waktu {minutes}:{seconds}</span>
       <button type="button" onClick={() => setIsRunning((value) => !value)} className="font-semibold text-limo-blue-500 hover:text-limo-blue-600">
         {isRunning ? "Jeda" : "Mulai"}
      </button>
       <button type="button" onClick={() => { setIsRunning(false); setRemainingSeconds(initialSeconds); }} className="ms-3 font-semibold text-gray-500 hover:text-gray-700">
         Atur ulang
      </button>
    </div>
  );
}
