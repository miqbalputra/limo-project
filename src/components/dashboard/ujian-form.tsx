"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { FormFieldError } from "@/components/dashboard/form-field-error";
import { LocalizedContent } from "@/components/localized-content";
import { formatUiLabel } from "@/lib/ui-labels";
import { ApiJsonError, requestJson } from "@/lib/api-json-client";
import { StatusBadge } from "@/components/dashboard/status-badge";

type KelasOption = { id: string; name: string };
type SoalOption = { id: string; label: string; question: string; language: string | null; direction: string | null };
type FieldErrors = Record<string, string[]>;

export function UjianForm({ kelasOptions, soalOptions }: { kelasOptions: KelasOption[]; soalOptions: SoalOption[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preview, setPreview] = useState<ExamPreview | null>(null);

  function togglePreview() {
    if (preview) {
      setPreview(null);
      return;
    }

    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    const selectedQuestionIds = data.getAll("bankSoalId").map(String);

    setPreview({
      title: String(data.get("title") || ""),
      description: String(data.get("description") || ""),
      status: String(data.get("status") || "DRAFT"),
      durationMinutes: Number(data.get("durationMinutes") || 60),
      maxAttempts: Number(data.get("maxAttempts") || 1),
      questions: selectedQuestionIds.map((id) => {
        const question = soalOptions.find((soal) => soal.id === id);
        return {
          label: question?.label || id,
          question: question?.question || id,
          language: question?.language || null,
          direction: question?.direction || null,
          weight: Number(data.get(`weight-${id}`) || 1),
        };
      }),
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);
    const selectedQuestionIds = data.getAll("bankSoalId").map(String);
    const questions = selectedQuestionIds.map((id) => ({
      bankSoalId: id,
      weight: Number(data.get(`weight-${id}`) || 1),
    }));

    try {
      await requestJson("/api/v1/ujian", {
        method: "POST",
        body: {
          kelasId: String(data.get("kelasId") || ""),
          title: String(data.get("title") || ""),
          description: String(data.get("description") || ""),
          status: String(data.get("status") || "DRAFT"),
          deliveryMode: String(data.get("deliveryMode") || "TEACHER_ENTRY"),
          examDate: String(data.get("examDate") || ""),
          availableFrom: String(data.get("availableFrom") || ""),
          availableUntil: String(data.get("availableUntil") || ""),
          durationMinutes: Number(data.get("durationMinutes") || 60),
          maxAttempts: Number(data.get("maxAttempts") || 1),
          showResultToWali: data.get("showResultToWali") === "on",
          questions,
        },
        fallbackMessage: "Ujian gagal disimpan",
      });

      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiJsonError) setFieldErrors(caught.fields || {});
      setError(caught instanceof Error ? caught.message : "Ujian gagal disimpan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="tailadmin-card grid gap-3 p-5">
      <h2 className="font-semibold text-gray-900">Buat Ujian</h2>
      {error ? <p className="tailadmin-alert-error">{error}</p> : null}
      <select name="kelasId" required aria-invalid={Boolean(fieldErrors.kelasId)} aria-describedby="ujian-class-error" className="tailadmin-input">
        <option value="">Pilih kelas</option>
        {kelasOptions.map((kelas) => <option key={kelas.id} value={kelas.id}>{kelas.name}</option>)}
      </select>
      <FormFieldError id="ujian-class-error" errors={fieldErrors.kelasId} />
      <input name="title" required placeholder="Judul ujian" aria-invalid={Boolean(fieldErrors.title)} aria-describedby="ujian-title-error" className="tailadmin-input" />
      <FormFieldError id="ujian-title-error" errors={fieldErrors.title} />
      <textarea name="description" placeholder="Deskripsi" className="tailadmin-input" />
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="examDate" type="date" className="tailadmin-input" />
        <select name="status" className="tailadmin-input">
          <option value="DRAFT">{formatUiLabel("DRAFT")}</option>
          <option value="PUBLISHED">{formatUiLabel("PUBLISHED")}</option>
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="deliveryMode" defaultValue="TEACHER_ENTRY" className="tailadmin-input">
          <option value="TEACHER_ENTRY">{formatUiLabel("TEACHER_ENTRY")}</option>
          <option value="ONLINE_VIA_WALI">{formatUiLabel("ONLINE_VIA_WALI")}</option>
          <option value="BOTH">Luring dan daring</option>
        </select>
        <input name="maxAttempts" type="number" min={1} max={5} defaultValue={1} className="tailadmin-input" placeholder="Maksimal percobaan" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="availableFrom" type="date" className="tailadmin-input" aria-label="Tersedia mulai" />
        <input name="availableUntil" type="date" className="tailadmin-input" aria-label="Tersedia sampai" />
      </div>
      <label className="flex items-center gap-2 rounded-xl bg-gray-50 p-3 text-theme-sm text-gray-700">
        <input name="showResultToWali" type="checkbox" defaultChecked className="accent-limo-blue-500" />
        Tampilkan hasil ke wali setelah final
      </label>
      <input name="durationMinutes" type="number" min={1} max={600} defaultValue={60} aria-invalid={Boolean(fieldErrors.durationMinutes)} aria-describedby="ujian-duration-error" className="tailadmin-input" placeholder="Durasi ujian dalam menit" />
      <FormFieldError id="ujian-duration-error" errors={fieldErrors.durationMinutes} />
      <div className="rounded-xl border border-gray-200 p-4">
        <p className="text-theme-sm font-semibold text-gray-700">Pilih Soal</p>
        <div className="mt-3 grid gap-3">
          {soalOptions.map((soal) => (
            <label key={soal.id} className="grid gap-2 rounded-lg bg-gray-50 p-3 text-theme-sm text-gray-700 sm:grid-cols-[1fr_100px]">
              <span><input name="bankSoalId" type="checkbox" value={soal.id} className="me-2 accent-limo-blue-500" /><span className="text-gray-500">{soal.label} / </span><LocalizedContent text={soal.question} language={soal.language} direction={soal.direction}>{soal.question}</LocalizedContent></span>
              <input name={`weight-${soal.id}`} type="number" min={0.1} step={0.1} defaultValue={1} className="tailadmin-input px-2 py-1" />
            </label>
          ))}
        </div>
        <FormFieldError id="ujian-questions-error" errors={fieldErrors.questions} />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={togglePreview} className="tailadmin-button-outline flex-1">{preview ? "Tutup pratinjau" : "Lihat pratinjau"}</button>
        <button disabled={isSubmitting} className="tailadmin-button-primary flex-1">
          {isSubmitting ? "Menyimpan..." : "Simpan Ujian"}
        </button>
      </div>
      {preview ? <ExamPreviewCard preview={preview} /> : null}
    </form>
  );
}

type ExamPreview = {
  title: string;
  description: string;
  status: string;
  durationMinutes: number;
  maxAttempts: number;
  questions: { label: string; question: string; language: string | null; direction: string | null; weight: number }[];
};

function ExamPreviewCard({ preview }: { preview: ExamPreview }) {
  return (
    <article className="tailadmin-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-600">Pratinjau penilaian</p>
          <h3 className="mt-1 text-lg font-semibold text-gray-900">{preview.title || "Tanpa judul"}</h3>
        </div>
         <StatusBadge status={preview.status} compact />
      </div>
      <p className="mt-3 whitespace-pre-wrap text-theme-sm text-gray-600">{preview.description || "Tanpa deskripsi."}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-3"><p className="text-theme-xs text-gray-500">Durasi</p><p className="mt-1 font-semibold text-gray-900">{preview.durationMinutes} menit</p></div>
        <div className="rounded-xl bg-white p-3"><p className="text-theme-xs text-gray-500">Maksimal percobaan</p><p className="mt-1 font-semibold text-gray-900">{preview.maxAttempts} kali</p></div>
      </div>
      <div className="mt-4 rounded-xl bg-white p-4">
        <p className="text-theme-sm font-semibold text-gray-800">Soal terpilih ({preview.questions.length})</p>
        {preview.questions.length > 0 ? <ol className="mt-2 list-decimal space-y-2 ps-5 text-theme-sm text-gray-600">{preview.questions.map((question, index) => <li key={`${question.label}-${index}`}><span className="text-gray-500">{question.label} / </span><LocalizedContent text={question.question} language={question.language} direction={question.direction}>{question.question}</LocalizedContent><span className="ms-2 text-theme-xs font-semibold text-limo-blue-600">Bobot {question.weight}</span></li>)}</ol> : <p className="mt-2 text-theme-sm text-warning-700">Belum ada soal yang dipilih.</p>}
      </div>
    </article>
  );
}
