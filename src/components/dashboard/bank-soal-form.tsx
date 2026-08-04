"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { FormFieldError } from "@/components/dashboard/form-field-error";

type KelasOption = { id: string; name: string };
type FieldErrors = Record<string, string[]>;

const questionTypes = [
  { value: "PILIHAN_GANDA", label: "Pilihan Ganda", hint: "Satu jawaban benar, auto-score." },
  { value: "MULTI_SELECT", label: "Multi Select", hint: "Bisa lebih dari satu jawaban benar, auto-score." },
  { value: "BENAR_SALAH", label: "Benar/Salah", hint: "Auto-score dengan kunci benar/salah." },
  { value: "ISIAN_SINGKAT", label: "Isian Singkat", hint: "Auto-score jika kunci diisi." },
  { value: "CLOZE", label: "Cloze / Fill Blank", hint: "Teks rumpang dengan kunci jawaban." },
  { value: "MENJODOHKAN", label: "Matching", hint: "Isi pasangan soal dan jawaban yang benar." },
  { value: "URUTAN", label: "Sequencing", hint: "Isi item sesuai urutan benar." },
  { value: "GAMBAR", label: "Picture-Based", hint: "Tambahkan URL gambar dan instruksi." },
  { value: "LISTENING", label: "Listening", hint: "Tambahkan URL audio dan instruksi." },
  { value: "READING", label: "Reading Comprehension", hint: "Tambahkan stimulus bacaan." },
  { value: "SPEAKING", label: "Speaking Prompt", hint: "Dinilai guru dengan rubric." },
  { value: "WRITING", label: "Writing Task", hint: "Dinilai guru dengan rubric." },
  { value: "ROLEPLAY", label: "Roleplay / Performance", hint: "Dinilai guru dengan rubric." },
  { value: "ESAI", label: "Esai", hint: "Dinilai guru atau input skor manual." },
] as const;

function buildRubric(data: FormData) {
  const criteria = [1, 2, 3]
    .map((index) => ({
      name: String(data.get(`rubricName${index}`) || "").trim(),
      max: Number(data.get(`rubricMax${index}`) || 0),
    }))
    .filter((item) => item.name && item.max > 0);

  return criteria.length > 0 ? { criteria } : undefined;
}

function buildStructuredPayload(data: FormData, type: string) {
  if (type === "MENJODOHKAN") {
    const pairs = [1, 2, 3, 4]
      .map((index) => ({
        left: String(data.get(`matchLeft${index}`) || "").trim(),
        right: String(data.get(`matchRight${index}`) || "").trim(),
      }))
      .filter((item) => item.left && item.right);

    if (pairs.length === 0) {
      return undefined;
    }

    return {
      pairs,
      answerKey: Object.fromEntries(pairs.map((item) => [item.left, item.right])),
    };
  }

  if (type === "URUTAN") {
    const items = [1, 2, 3, 4, 5]
      .map((index) => String(data.get(`sequenceItem${index}`) || "").trim())
      .filter(Boolean);

    return items.length > 0 ? { items, answerKey: items } : undefined;
  }

  return undefined;
}

export function BankSoalForm({ kelasOptions }: { kelasOptions: KelasOption[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [type, setType] = useState("PILIHAN_GANDA");

  const usesOptions = type === "PILIHAN_GANDA" || type === "MULTI_SELECT";
  const usesExpectedAnswer = ["BENAR_SALAH", "ISIAN_SINGKAT", "CLOZE"].includes(type);
  const usesStructuredPayload = ["MENJODOHKAN", "URUTAN"].includes(type);
  const usesRubric = ["SPEAKING", "WRITING", "ROLEPLAY", "ESAI", "GAMBAR", "LISTENING", "READING"].includes(type);
  const usesMedia = ["GAMBAR", "LISTENING", "SPEAKING", "READING"].includes(type);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    setIsSubmitting(true);
      const data = new FormData(event.currentTarget);
      const type = String(data.get("type") || "PILIHAN_GANDA");
      const correctLabel = String(data.get("correctLabel") || "A");
      const correctLabels = data.getAll("correctLabels").map(String);

      const options = ["A", "B", "C", "D"]
        .map((label) => ({
          label,
          content: String(data.get(`option${label}`) || ""),
          isCorrect: type === "MULTI_SELECT" ? correctLabels.includes(label) : label === correctLabel,
        }))
        .filter((option) => option.content.length > 0);

    try {
      const response = await fetch("/api/v1/bank-soal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kelasId: String(data.get("kelasId") || ""),
            type,
            question: String(data.get("question") || ""),
            stimulusText: String(data.get("stimulusText") || ""),
            mediaUrl: String(data.get("mediaUrl") || ""),
            expectedAnswer: String(data.get("expectedAnswer") || ""),
            structuredPayload: buildStructuredPayload(data, type),
            rubric: buildRubric(data),
            language: String(data.get("language") || ""),
          direction: String(data.get("direction") || ""),
          cognitiveLevel: String(data.get("cognitiveLevel") || "LOTS"),
          skill: String(data.get("skill") || "VOCABULARY"),
          difficulty: String(data.get("difficulty") || "EASY"),
          standard: String(data.get("standard") || ""),
          assessmentType: String(data.get("assessmentType") || "FORMATIVE"),
          explanation: String(data.get("explanation") || ""),
            options: usesOptions ? options : [],
          }),
        });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string; fields?: FieldErrors } };
        setFieldErrors(payload.error?.fields || {});
        throw new Error(payload.error?.message || "Soal gagal disimpan");
      }

      event.currentTarget.reset();
      setType("PILIHAN_GANDA");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Soal gagal disimpan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="tailadmin-card grid gap-3 p-5">
      <h2 className="font-semibold text-gray-900">Tambah Bank Soal</h2>
      {error ? <p className="tailadmin-alert-error">{error}</p> : null}
      <select name="kelasId" aria-invalid={Boolean(fieldErrors.kelasId)} aria-describedby="soal-class-error" className="tailadmin-input">
        <option value="">Umum / tidak terikat kelas</option>
        {kelasOptions.map((kelas) => <option key={kelas.id} value={kelas.id}>{kelas.name}</option>)}
      </select>
      <FormFieldError id="soal-class-error" errors={fieldErrors.kelasId} />
      <select name="type" value={type} onChange={(event) => setType(event.target.value)} aria-invalid={Boolean(fieldErrors.type)} aria-describedby="soal-type-error" className="tailadmin-input">
        {questionTypes.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
      <FormFieldError id="soal-type-error" errors={fieldErrors.type} />
      <p className="text-theme-xs text-gray-500">{questionTypes.find((item) => item.value === type)?.hint}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Level Kognitif
          <select name="cognitiveLevel" defaultValue="LOTS" className="mt-2 tailadmin-input">
            <option value="LOTS">LOTS - Pemahaman Dasar</option>
            <option value="MOTS">MOTS - Penerapan</option>
            <option value="HOTS">HOTS - Analisis/Evaluasi</option>
          </select>
        </label>
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Skill
          <select name="skill" defaultValue="VOCABULARY" className="mt-2 tailadmin-input">
            <option value="VOCABULARY">Vocabulary</option>
            <option value="GRAMMAR">Grammar</option>
            <option value="READING">Reading</option>
            <option value="LISTENING">Listening</option>
            <option value="SPEAKING">Speaking</option>
            <option value="WRITING">Writing</option>
            <option value="PRONUNCIATION">Pronunciation</option>
            <option value="LITERACY">Literacy / AKM</option>
            <option value="NUMERACY">Numeracy / AKM</option>
          </select>
        </label>
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Kesulitan
          <select name="difficulty" defaultValue="EASY" className="mt-2 tailadmin-input">
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Standar / Kurikulum
          <input name="standard" placeholder="CEFR Pre-A1, A1, AKM Literasi, Internal Arabic" className="mt-2 tailadmin-input" />
        </label>
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Tipe Asesmen
          <select name="assessmentType" defaultValue="FORMATIVE" className="mt-2 tailadmin-input">
            <option value="FORMATIVE">Formatif</option>
            <option value="SUMMATIVE">Sumatif</option>
            <option value="PLACEMENT">Placement</option>
            <option value="DIAGNOSTIC">Diagnostik</option>
          </select>
        </label>
      </div>
      <textarea name="stimulusText" placeholder="Stimulus: teks bacaan, dialog, instruksi audio, atau konteks roleplay" className="tailadmin-input min-h-20" />
      {usesMedia ? <input name="mediaUrl" placeholder="URL media privat/publik: gambar, audio, atau bahan bacaan" className="tailadmin-input" /> : null}
      <textarea name="question" required placeholder="Tulis pertanyaan atau prompt untuk siswa" aria-invalid={Boolean(fieldErrors.question)} aria-describedby="soal-question-error" className="tailadmin-input min-h-28" />
      <FormFieldError id="soal-question-error" errors={fieldErrors.question} />
      {usesOptions ? (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {(["A", "B", "C", "D"] as const).map((label) => (
              <input key={label} name={`option${label}`} placeholder={`Opsi ${label}`} className="tailadmin-input" />
            ))}
          </div>
          {type === "PILIHAN_GANDA" ? (
            <select name="correctLabel" className="tailadmin-input">
              <option value="A">Jawaban benar A</option>
              <option value="B">Jawaban benar B</option>
              <option value="C">Jawaban benar C</option>
              <option value="D">Jawaban benar D</option>
            </select>
          ) : (
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-theme-sm font-semibold text-gray-700">Jawaban benar multi-select</p>
              <div className="mt-3 flex flex-wrap gap-3 text-theme-sm text-gray-700">
                {(["A", "B", "C", "D"] as const).map((label) => (
                  <label key={label}><input name="correctLabels" type="checkbox" value={label} className="mr-2 accent-brand-500" />{label}</label>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
      {usesExpectedAnswer ? <input name="expectedAnswer" placeholder="Kunci jawaban: benar/salah atau jawaban singkat" className="tailadmin-input" /> : null}
      {usesStructuredPayload ? (
        <div className="rounded-xl border border-gray-200 p-4">
          {type === "MENJODOHKAN" ? (
            <>
              <div>
                <p className="text-theme-sm font-semibold text-gray-700">Pasangan Jawaban</p>
                <p className="mt-1 text-theme-xs text-gray-500">Contoh: kiri one, kanan satu. Guru cukup isi pasangan yang benar.</p>
              </div>
              <div className="mt-3 grid gap-3">
                {[1, 2, 3, 4].map((index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-2">
                    <input name={`matchLeft${index}`} placeholder={`Item ${index}, contoh: one`} className="tailadmin-input" />
                    <input name={`matchRight${index}`} placeholder={`Pasangan benar ${index}, contoh: satu`} className="tailadmin-input" />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-theme-sm font-semibold text-gray-700">Urutan Benar</p>
                <p className="mt-1 text-theme-xs text-gray-500">Isi dari langkah pertama sampai terakhir sesuai jawaban benar.</p>
              </div>
              <div className="mt-3 grid gap-3">
                {[1, 2, 3, 4, 5].map((index) => (
                  <input key={index} name={`sequenceItem${index}`} placeholder={`Urutan ${index}`} className="tailadmin-input" />
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}
      {usesRubric ? (
        <div className="rounded-xl border border-gray-200 p-4">
          <div>
            <p className="text-theme-sm font-semibold text-gray-700">Rubrik Penilaian Opsional</p>
            <p className="mt-1 text-theme-xs text-gray-500">Isi jika jawaban perlu dinilai manual, misalnya speaking, writing, roleplay, atau esai.</p>
          </div>
          <div className="mt-3 grid gap-3">
            {[1, 2, 3].map((index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_140px]">
                <input name={`rubricName${index}`} placeholder={`Kriteria ${index}, contoh: Kelancaran`} className="tailadmin-input" />
                <input name={`rubricMax${index}`} type="number" min={1} step={1} placeholder="Skor maks" className="tailadmin-input" />
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="language" placeholder="id/ar/en" className="tailadmin-input" />
        <select name="direction" className="tailadmin-input">
          <option value="">Auto</option>
          <option value="ltr">LTR</option>
          <option value="rtl">RTL Arab</option>
        </select>
      </div>
      <textarea name="explanation" placeholder="Pembahasan/catatan internal" className="tailadmin-input" />
      <button disabled={isSubmitting} className="tailadmin-button-primary">
        {isSubmitting ? "Menyimpan..." : "Simpan Soal"}
      </button>
    </form>
  );
}
