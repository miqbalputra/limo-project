"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { FormFieldError } from "@/components/dashboard/form-field-error";
import { ArabicTextField } from "@/components/localized-content";
import { formatUiLabel } from "@/lib/ui-labels";
import { ApiJsonError, requestJson } from "@/lib/api-json-client";

type KelasOption = { id: string; name: string };
type FieldErrors = Record<string, string[]>;
type OptionRow = { content: string; isCorrect: boolean };
type PairRow = { left: string; right: string };
type RubricRow = { name: string; max: string };

const LABELS = "ABCDEFGH".split("");
const MAX_OPTIONS = 8;

const questionTypes = [
  { value: "PILIHAN_GANDA", label: formatUiLabel("PILIHAN_GANDA"), hint: "Satu jawaban benar, dinilai otomatis." },
  { value: "MULTI_SELECT", label: formatUiLabel("MULTI_SELECT"), hint: "Boleh lebih dari satu jawaban benar, dinilai otomatis." },
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

const newOptions = (): OptionRow[] => [
  { content: "", isCorrect: false },
  { content: "", isCorrect: false },
  { content: "", isCorrect: false },
  { content: "", isCorrect: false },
];

export function BankSoalForm({ kelasOptions }: { kelasOptions: KelasOption[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [type, setType] = useState("PILIHAN_GANDA");
  const [language, setLanguage] = useState("");
  const [direction, setDirection] = useState<"" | "ltr" | "rtl">("");
  const [options, setOptions] = useState<OptionRow[]>(newOptions);
  const [pairs, setPairs] = useState<PairRow[]>([{ left: "", right: "" }, { left: "", right: "" }]);
  const [sequenceItems, setSequenceItems] = useState<string[]>(["", "", ""]);
  const [rubricCriteria, setRubricCriteria] = useState<RubricRow[]>([{ name: "", max: "" }]);

  const usesOptions = type === "PILIHAN_GANDA" || type === "MULTI_SELECT";
  const usesExpectedAnswer = ["BENAR_SALAH", "ISIAN_SINGKAT", "CLOZE"].includes(type);
  const usesStructuredPayload = ["MENJODOHKAN", "URUTAN"].includes(type);
  const usesRubric = ["SPEAKING", "WRITING", "ROLEPLAY", "ESAI", "GAMBAR", "LISTENING", "READING"].includes(type);
  const usesMedia = ["GAMBAR", "LISTENING", "SPEAKING", "READING"].includes(type);
  const singleCorrect = type === "PILIHAN_GANDA";

  function resetDynamic() {
    setOptions(newOptions());
    setPairs([{ left: "", right: "" }, { left: "", right: "" }]);
    setSequenceItems(["", "", ""]);
    setRubricCriteria([{ name: "", max: "" }]);
  }

  function updateOption(index: number, patch: Partial<OptionRow>) {
    setOptions((current) => current.map((option, position) => {
      if (position !== index) {
        return singleCorrect ? { ...option, isCorrect: false } : option;
      }
      return { ...option, ...patch };
    }));
  }

  function toggleCorrect(index: number) {
    if (singleCorrect) {
      setOptions((current) => current.map((option, position) => ({ ...option, isCorrect: position === index })));
      return;
    }
    setOptions((current) => current.map((option, position) => (position === index ? { ...option, isCorrect: !option.isCorrect } : option)));
  }

  function buildStructuredPayload() {
    if (type === "MENJODOHKAN") {
      const filled = pairs.filter((pair) => pair.left.trim() && pair.right.trim());
      if (filled.length === 0) return undefined;
      return { pairs: filled, answerKey: Object.fromEntries(filled.map((pair) => [pair.left.trim(), pair.right.trim()])) };
    }

    if (type === "URUTAN") {
      const items = sequenceItems.map((item) => item.trim()).filter(Boolean);
      return items.length > 0 ? { items, answerKey: items } : undefined;
    }

    return undefined;
  }

  function buildRubric() {
    const criteria = rubricCriteria
      .map((row) => ({ name: row.name.trim(), max: Number(row.max || 0) }))
      .filter((row) => row.name && row.max > 0);
    return criteria.length > 0 ? { criteria } : undefined;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);
    const usesOptionsNow = type === "PILIHAN_GANDA" || type === "MULTI_SELECT";
    const submittedOptions = usesOptionsNow
      ? options
          .map((option, index) => ({ label: LABELS[index], content: option.content.trim(), isCorrect: option.isCorrect }))
          .filter((option) => option.content.length > 0)
      : [];

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
          structuredPayload: buildStructuredPayload(),
          rubric: buildRubric(),
          language: String(data.get("language") || ""),
          direction: String(data.get("direction") || ""),
          cognitiveLevel: String(data.get("cognitiveLevel") || "LOTS"),
          skill: String(data.get("skill") || "VOCABULARY"),
          difficulty: String(data.get("difficulty") || "EASY"),
          standard: String(data.get("standard") || ""),
          assessmentType: String(data.get("assessmentType") || "FORMATIVE"),
          explanation: String(data.get("explanation") || ""),
          options: submittedOptions,
        },
        fallbackMessage: "Soal gagal disimpan",
      });

      event.currentTarget.reset();
      setType("PILIHAN_GANDA");
      setLanguage("");
      setDirection("");
      resetDynamic();
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
          <div className="flex items-center justify-between">
            <p className="text-theme-sm font-semibold text-gray-700">Pilihan jawaban</p>
            <button
              type="button"
              onClick={() => setOptions((current) => (current.length >= MAX_OPTIONS ? current : [...current, { content: "", isCorrect: false }]))}
              disabled={options.length >= MAX_OPTIONS}
              className="tailadmin-button-outline px-3 py-1.5 text-theme-xs"
            >
              + Tambah opsi
            </button>
          </div>
          <div className="grid gap-2">
            {options.map((option, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center">
                <button
                  type="button"
                  onClick={() => toggleCorrect(index)}
                  aria-pressed={option.isCorrect}
                  aria-label={`Tandai opsi ${LABELS[index]} sebagai jawaban benar`}
                  className={`grid size-9 place-items-center rounded-full border text-theme-sm font-bold ${option.isCorrect ? "border-success-500 bg-success-50 text-success-700" : "border-gray-300 text-gray-500"}`}
                >
                  {option.isCorrect ? "✓" : LABELS[index]}
                </button>
                <ArabicTextField
                  value={option.content}
                  onChange={(event) => updateOption(index, { content: event.target.value })}
                  language={language}
                  direction="auto"
                  placeholder={`Opsi ${LABELS[index]}`}
                  className="tailadmin-input"
                />
                <span className="text-theme-xs text-gray-400">{LABELS[index]}</span>
                <button
                  type="button"
                  onClick={() => setOptions((current) => (current.length <= 2 ? current : current.filter((_, position) => position !== index)))}
                  disabled={options.length <= 2}
                  aria-label={`Hapus opsi ${LABELS[index]}`}
                  className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                >
                  Hapus
                </button>
              </div>
            ))}
          </div>
          <p className="text-theme-xs text-gray-500">Klik tombol huruf untuk menandai jawaban benar{singleCorrect ? " (hanya satu)." : " (bisa lebih dari satu)."}</p>
        </div>
      ) : null}

      {usesExpectedAnswer ? <ArabicTextField name="expectedAnswer" language={language} direction="auto" placeholder="Kunci jawaban: benar/salah atau jawaban singkat" className="tailadmin-input" /> : null}

      {usesStructuredPayload ? (
        <div className="rounded-xl border border-gray-200 p-4">
          {type === "MENJODOHKAN" ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-theme-sm font-semibold text-gray-700">Pasangan Jawaban</p>
                  <p className="mt-1 text-theme-xs text-gray-500">Isi pasangan yang benar (kiri dipasangkan ke kanan).</p>
                </div>
                <button type="button" onClick={() => setPairs((current) => (current.length >= 8 ? current : [...current, { left: "", right: "" }]))} disabled={pairs.length >= 8} className="tailadmin-button-outline px-3 py-1.5 text-theme-xs">+ Pasangan</button>
              </div>
              <div className="mt-3 grid gap-2">
                {pairs.map((pair, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <ArabicTextField value={pair.left} onChange={(event) => setPairs((current) => current.map((row, position) => (position === index ? { ...row, left: event.target.value } : row)))} language={language} direction="auto" placeholder={`Item ${index + 1}`} className="tailadmin-input" />
                    <ArabicTextField value={pair.right} onChange={(event) => setPairs((current) => current.map((row, position) => (position === index ? { ...row, right: event.target.value } : row)))} language={language} direction="auto" placeholder={`Pasangan benar ${index + 1}`} className="tailadmin-input" />
                    <button type="button" onClick={() => setPairs((current) => (current.length <= 2 ? current : current.filter((_, position) => position !== index)))} disabled={pairs.length <= 2} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">Hapus</button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-theme-sm font-semibold text-gray-700">Urutan Benar</p>
                  <p className="mt-1 text-theme-xs text-gray-500">Isi dari langkah pertama sampai terakhir.</p>
                </div>
                <button type="button" onClick={() => setSequenceItems((current) => (current.length >= 8 ? current : [...current, ""]))} disabled={sequenceItems.length >= 8} className="tailadmin-button-outline px-3 py-1.5 text-theme-xs">+ Item</button>
              </div>
              <div className="mt-3 grid gap-2">
                {sequenceItems.map((item, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <ArabicTextField value={item} onChange={(event) => setSequenceItems((current) => current.map((row, position) => (position === index ? event.target.value : row)))} language={language} direction="auto" placeholder={`Urutan ${index + 1}`} className="tailadmin-input" />
                    <button type="button" onClick={() => setSequenceItems((current) => (current.length <= 2 ? current : current.filter((_, position) => position !== index)))} disabled={sequenceItems.length <= 2} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">Hapus</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}

      {usesRubric ? (
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-theme-sm font-semibold text-gray-700">Rubrik Penilaian Opsional</p>
              <p className="mt-1 text-theme-xs text-gray-500">Untuk jawaban yang dinilai manual (speaking, writing, esai).</p>
            </div>
            <button type="button" onClick={() => setRubricCriteria((current) => (current.length >= 6 ? current : [...current, { name: "", max: "" }]))} disabled={rubricCriteria.length >= 6} className="tailadmin-button-outline px-3 py-1.5 text-theme-xs">+ Kriteria</button>
          </div>
          <div className="mt-3 grid gap-2">
            {rubricCriteria.map((row, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                <ArabicTextField value={row.name} onChange={(event) => setRubricCriteria((current) => current.map((item, position) => (position === index ? { ...item, name: event.target.value } : item)))} language={language} direction="auto" placeholder={`Kriteria ${index + 1}, contoh: Kelancaran`} className="tailadmin-input" />
                <input type="number" min={1} step={1} value={row.max} onChange={(event) => setRubricCriteria((current) => current.map((item, position) => (position === index ? { ...item, max: event.target.value } : item)))} placeholder="Skor maks" className="tailadmin-input" />
                <button type="button" onClick={() => setRubricCriteria((current) => (current.length <= 1 ? current : current.filter((_, position) => position !== index)))} disabled={rubricCriteria.length <= 1} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">Hapus</button>
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
