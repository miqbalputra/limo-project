"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { FormFieldError } from "@/components/dashboard/form-field-error";
import { ArabicTextField } from "@/components/localized-content";
import { formatUiLabel } from "@/lib/ui-labels";
import { ApiJsonError, requestJson } from "@/lib/api-json-client";

type KelasOption = { id: string; name: string };
type FieldErrors = Record<string, string[]>;

const questionTypes = [
  { value: "PILIHAN_GANDA", label: formatUiLabel("PILIHAN_GANDA"), hint: "Satu jawaban benar, dinilai otomatis." },
  { value: "MULTI_SELECT", label: formatUiLabel("MULTI_SELECT"), hint: "Dapat memilih lebih dari satu jawaban benar, dinilai otomatis." },
  { value: "BENAR_SALAH", label: formatUiLabel("BENAR_SALAH"), hint: "Dinilai otomatis berdasarkan kunci benar atau salah." },
  { value: "ISIAN_SINGKAT", label: formatUiLabel("ISIAN_SINGKAT"), hint: "Dinilai otomatis jika kunci diisi." },
  { value: "CLOZE", label: formatUiLabel("CLOZE"), hint: "Teks rumpang dengan kunci jawaban." },
  { value: "MENJODOHKAN", label: formatUiLabel("MENJODOHKAN"), hint: "Isi pasangan soal dan jawaban yang benar." },
  { value: "URUTAN", label: formatUiLabel("URUTAN"), hint: "Susun item sesuai urutan yang benar." },
  { value: "GAMBAR", label: formatUiLabel("GAMBAR"), hint: "Tambahkan URL gambar dan instruksi." },
  { value: "LISTENING", label: formatUiLabel("LISTENING"), hint: "Tambahkan URL audio dan instruksi." },
  { value: "READING", label: formatUiLabel("READING"), hint: "Tambahkan stimulus bacaan." },
  { value: "SPEAKING", label: formatUiLabel("SPEAKING"), hint: "Dinilai guru dengan rubrik." },
  { value: "WRITING", label: formatUiLabel("WRITING"), hint: "Dinilai guru dengan rubrik." },
  { value: "ROLEPLAY", label: formatUiLabel("ROLEPLAY"), hint: "Dinilai guru dengan rubrik." },
  { value: "ESAI", label: formatUiLabel("ESAI"), hint: "Dinilai guru atau dengan input skor manual." },
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
  const [language, setLanguage] = useState("");
  const [direction, setDirection] = useState<"" | "ltr" | "rtl">("");

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
      await requestJson("/api/v1/bank-soal", {
        method: "POST",
        body: {
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
          },
        fallbackMessage: "Soal gagal disimpan",
      });

      event.currentTarget.reset();
      setType("PILIHAN_GANDA");
      setLanguage("");
      setDirection("");
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiJsonError) setFieldErrors(caught.fields || {});
      setError(caught instanceof Error ? caught.message : "Soal gagal disimpan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form data-testid="bank-soal-form" onSubmit={onSubmit} className="tailadmin-card grid gap-3 p-5">
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
             <option value="LOTS">{formatUiLabel("LOTS")} - Pemahaman dasar</option>
             <option value="MOTS">{formatUiLabel("MOTS")} - Penerapan</option>
             <option value="HOTS">{formatUiLabel("HOTS")} - Analisis/evaluasi</option>
          </select>
        </label>
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
           Keterampilan
          <select name="skill" defaultValue="VOCABULARY" className="mt-2 tailadmin-input">
             <option value="VOCABULARY">{formatUiLabel("VOCABULARY")}</option>
             <option value="GRAMMAR">{formatUiLabel("GRAMMAR")}</option>
             <option value="READING">{formatUiLabel("READING")}</option>
             <option value="LISTENING">{formatUiLabel("LISTENING")}</option>
             <option value="SPEAKING">{formatUiLabel("SPEAKING")}</option>
             <option value="WRITING">{formatUiLabel("WRITING")}</option>
             <option value="PRONUNCIATION">{formatUiLabel("PRONUNCIATION")}</option>
             <option value="LITERACY">{formatUiLabel("LITERACY")} / AKM</option>
             <option value="NUMERACY">{formatUiLabel("NUMERACY")} / AKM</option>
          </select>
        </label>
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Kesulitan
          <select name="difficulty" defaultValue="EASY" className="mt-2 tailadmin-input">
             <option value="EASY">{formatUiLabel("EASY")}</option>
             <option value="MEDIUM">{formatUiLabel("MEDIUM")}</option>
             <option value="HARD">{formatUiLabel("HARD")}</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Standar / Kurikulum
            <input name="standard" dir="auto" placeholder="CEFR Pre-A1, A1, AKM Literasi, Bahasa Arab internal" className="mt-2 tailadmin-input" />
        </label>
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Tipe Asesmen
          <select name="assessmentType" defaultValue="FORMATIVE" className="mt-2 tailadmin-input">
           <option value="FORMATIVE">{formatUiLabel("FORMATIVE")}</option>
           <option value="SUMMATIVE">{formatUiLabel("SUMMATIVE")}</option>
           <option value="PLACEMENT">{formatUiLabel("PLACEMENT")}</option>
           <option value="DIAGNOSTIC">{formatUiLabel("DIAGNOSTIC")}</option>
          </select>
        </label>
      </div>
       <div data-testid="bank-soal-localization-fields" className="grid gap-3 sm:grid-cols-2">
         <label className="grid gap-1 text-theme-xs font-semibold text-gray-600">Bahasa konten
           <input name="language" value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="Bahasa konten" dir="auto" placeholder="id, ar, en" className="tailadmin-input" />
         </label>
         <label className="grid gap-1 text-theme-xs font-semibold text-gray-600">Arah konten
           <select name="direction" value={direction} onChange={(event) => setDirection(event.target.value as "" | "ltr" | "rtl")} aria-label="Arah konten" className="tailadmin-input">
             <option value="">Otomatis</option>
             <option value="ltr">LTR</option>
             <option value="rtl">RTL Arab</option>
           </select>
         </label>
       </div>
       <div data-testid="bank-soal-primary-content" className="grid gap-3">
         <ArabicTextField as="textarea" name="stimulusText" language={language} direction={direction || undefined} placeholder="Stimulus: teks bacaan, dialog, instruksi audio, atau konteks roleplay" className="tailadmin-input min-h-20" />
         {usesMedia ? <input name="mediaUrl" dir="ltr" placeholder="URL media privat/publik: gambar, audio, atau bahan bacaan" className="tailadmin-input" /> : null}
         <ArabicTextField as="textarea" name="question" required language={language} direction={direction || undefined} aria-label="Pertanyaan soal" placeholder="Tulis pertanyaan atau prompt untuk siswa" aria-invalid={Boolean(fieldErrors.question)} aria-describedby="soal-question-error" data-testid="bank-soal-question-field" className="tailadmin-input min-h-28" />
       </div>
       <FormFieldError id="soal-question-error" errors={fieldErrors.question} />
      {usesOptions ? (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {(["A", "B", "C", "D"] as const).map((label) => (
               <ArabicTextField key={label} name={`option${label}`} language={language} direction="auto" placeholder={`Opsi ${label}`} className="tailadmin-input" />
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
                  <label key={label}><input name="correctLabels" type="checkbox" value={label} className="me-2 accent-limo-blue-500" />{label}</label>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
       {usesExpectedAnswer ? <ArabicTextField name="expectedAnswer" language={language} direction="auto" placeholder="Kunci jawaban: benar/salah atau jawaban singkat" className="tailadmin-input" /> : null}
      {usesStructuredPayload ? (
        <div className="rounded-xl border border-gray-200 p-4">
          {type === "MENJODOHKAN" ? (
            <>
              <div>
                <p className="text-theme-sm font-semibold text-gray-700">Pasangan Jawaban</p>
               <p className="mt-1 text-theme-xs text-gray-500">Contoh: kiri satu, kanan one. Guru cukup mengisi pasangan yang benar.</p>
              </div>
              <div className="mt-3 grid gap-3">
                {[1, 2, 3, 4].map((index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-2">
                     <ArabicTextField name={`matchLeft${index}`} language={language} direction="auto" placeholder={`Item ${index}, contoh: satu`} className="tailadmin-input" />
                      <ArabicTextField name={`matchRight${index}`} language={language} direction="auto" placeholder={`Pasangan benar ${index}, contoh: one`} className="tailadmin-input" />
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
                   <ArabicTextField key={index} name={`sequenceItem${index}`} language={language} direction="auto" placeholder={`Urutan ${index}`} className="tailadmin-input" />
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
           <p className="mt-1 text-theme-xs text-gray-500">Isi jika jawaban perlu dinilai manual, misalnya berbicara, menulis, bermain peran, atau esai.</p>
          </div>
          <div className="mt-3 grid gap-3">
            {[1, 2, 3].map((index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_140px]">
                 <ArabicTextField name={`rubricName${index}`} language={language} direction="auto" placeholder={`Kriteria ${index}, contoh: Kelancaran`} className="tailadmin-input" />
                <input name={`rubricMax${index}`} type="number" min={1} step={1} placeholder="Skor maks" className="tailadmin-input" />
              </div>
            ))}
          </div>
        </div>
      ) : null}
       <ArabicTextField as="textarea" name="explanation" language={language} direction="auto" placeholder="Pembahasan/catatan internal" className="tailadmin-input" />
      <button disabled={isSubmitting} className="tailadmin-button-primary">
        {isSubmitting ? "Menyimpan..." : "Simpan Soal"}
      </button>
    </form>
  );
}
