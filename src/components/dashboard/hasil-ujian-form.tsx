"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

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

export function HasilUjianForm({ ujianId, students, questions }: { ujianId: string; students: Student[]; questions: ExamQuestion[] }) {
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
      <h2 className="font-semibold text-gray-900">Input Hasil Offline</h2>
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
