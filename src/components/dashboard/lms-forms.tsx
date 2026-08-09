"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { FormFieldError } from "@/components/dashboard/form-field-error";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ArabicTextField, LocalizedContent } from "@/components/localized-content";
import { formatUiLabel } from "@/lib/ui-labels";
import { ApiJsonError, requestJson } from "@/lib/api-json-client";

type FieldErrors = Record<string, string[]>;

async function postJson(path: string, body: Record<string, string | number>) {
  await requestJson(path, { method: "POST", body, fallbackMessage: "Data gagal disimpan" });
}

function useSubmit(path: string) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>, body: Record<string, string | number>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await postJson(path, body);
      event.currentTarget.reset();
      router.refresh();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Data gagal disimpan");
      setFieldErrors(caught instanceof ApiJsonError ? caught.fields || {} : {});
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  return { error, fieldErrors, isSubmitting, submit };
}

export function SesiKelasForm({ kelasId }: { kelasId: string }) {
  const { error, fieldErrors, isSubmitting, submit } = useSubmit(`/api/v1/guru/kelas/${kelasId}/sesi`);

  return (
    <form
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        void submit(event, {
          meetingNumber: Number(data.get("meetingNumber") || 1),
          topic: String(data.get("topic") || ""),
          sessionDate: String(data.get("sessionDate") || ""),
        });
      }}
      className="tailadmin-card grid gap-3 p-5"
    >
      <h2 className="font-semibold text-gray-900">Tambah Sesi</h2>
       {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      <input name="meetingNumber" type="number" min={1} required placeholder="Pertemuan ke" aria-invalid={Boolean(fieldErrors.meetingNumber)} aria-describedby="sesi-meeting-number-error" className="tailadmin-input" />
      <FormFieldError id="sesi-meeting-number-error" errors={fieldErrors.meetingNumber} />
      <input name="topic" required placeholder="Topik" aria-invalid={Boolean(fieldErrors.topic)} aria-describedby="sesi-topic-error" className="tailadmin-input" />
      <FormFieldError id="sesi-topic-error" errors={fieldErrors.topic} />
      <input name="sessionDate" type="date" required aria-invalid={Boolean(fieldErrors.sessionDate)} aria-describedby="sesi-date-error" className="tailadmin-input" />
      <FormFieldError id="sesi-date-error" errors={fieldErrors.sessionDate} />
      <button disabled={isSubmitting} className="tailadmin-button-primary">
        {isSubmitting ? "Menyimpan..." : "Simpan Sesi"}
      </button>
    </form>
  );
}

export function MateriForm({ kelasId, sesiOptions }: { kelasId: string; sesiOptions: { id: string; label: string }[] }) {
  const { error, fieldErrors, isSubmitting, submit } = useSubmit(`/api/v1/guru/kelas/${kelasId}/materi`);
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<MaterialPreview | null>(null);
  const [language, setLanguage] = useState("");
  const [direction, setDirection] = useState<"" | "ltr" | "rtl">("");

  function togglePreview() {
    if (preview) {
      setPreview(null);
      return;
    }

    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    const sessionSelect = formRef.current.elements.namedItem("sesiKelasId");
    const sesiKelasId = String(data.get("sesiKelasId") || "");

    setPreview({
      title: String(data.get("title") || ""),
      type: String(data.get("type") || "TEXT"),
      content: String(data.get("content") || ""),
      videoUrl: String(data.get("videoUrl") || ""),
      language: String(data.get("language") || ""),
      direction: String(data.get("direction") || ""),
      status: String(data.get("status") || "DRAFT"),
      sessionLabel: sessionSelect instanceof HTMLSelectElement && sesiKelasId ? sessionSelect.selectedOptions[0]?.textContent || "" : "",
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        void submit(event, {
          title: String(data.get("title") || ""),
          type: String(data.get("type") || "TEXT"),
          sesiKelasId: String(data.get("sesiKelasId") || ""),
          content: String(data.get("content") || ""),
          videoUrl: String(data.get("videoUrl") || ""),
          language: String(data.get("language") || ""),
          direction: String(data.get("direction") || ""),
          status: String(data.get("status") || "DRAFT"),
          order: Number(data.get("order") || 0),
        }).then((saved) => {
          if (saved) {
            setLanguage("");
            setDirection("");
          }
        });
      }}
      className="tailadmin-card grid gap-3 p-5"
    >
      <h2 className="font-semibold text-gray-900">Tambah Materi</h2>
       {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
       <ArabicTextField name="title" required language={language} direction="auto" placeholder="Judul materi" aria-invalid={Boolean(fieldErrors.title)} aria-describedby="materi-title-error" className="tailadmin-input" />
      <FormFieldError id="materi-title-error" errors={fieldErrors.title} />
      <select name="type" aria-invalid={Boolean(fieldErrors.type)} aria-describedby="materi-type-error" className="tailadmin-input">
        <option value="TEXT">{formatUiLabel("TEXT")}</option>
        <option value="PDF">{formatUiLabel("PDF")}</option>
        <option value="IMAGE">{formatUiLabel("IMAGE")}</option>
        <option value="VIDEO_LINK">{formatUiLabel("VIDEO_LINK")}</option>
      </select>
      <FormFieldError id="materi-type-error" errors={fieldErrors.type} />
      <select name="sesiKelasId" aria-invalid={Boolean(fieldErrors.sesiKelasId)} aria-describedby="materi-session-error" className="tailadmin-input">
        <option value="">Tanpa sesi spesifik</option>
        {sesiOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      <FormFieldError id="materi-session-error" errors={fieldErrors.sesiKelasId} />
       <ArabicTextField as="textarea" name="content" language={language} direction={direction || undefined} placeholder="Isi teks materi, kosongkan untuk PDF/gambar/video" aria-invalid={Boolean(fieldErrors.content)} aria-describedby="materi-content-error" className="tailadmin-input min-h-32" />
      <FormFieldError id="materi-content-error" errors={fieldErrors.content} />
       <input name="videoUrl" dir="ltr" placeholder="https://youtube.com/... khusus materi video" aria-invalid={Boolean(fieldErrors.videoUrl)} aria-describedby="materi-video-error" className="tailadmin-input" />
      <FormFieldError id="materi-video-error" errors={fieldErrors.videoUrl} />
      <div className="grid gap-3 sm:grid-cols-3">
         <input name="language" value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="Bahasa konten materi" dir="auto" placeholder="id/ar/en" className="tailadmin-input" />
         <select name="direction" value={direction} onChange={(event) => setDirection(event.target.value as "" | "ltr" | "rtl")} aria-label="Arah konten materi" className="tailadmin-input">
          <option value="">Otomatis</option>
          <option value="ltr">LTR</option>
          <option value="rtl">RTL Arab</option>
        </select>
        <select name="status" className="tailadmin-input">
          <option value="DRAFT">{formatUiLabel("DRAFT")}</option>
          <option value="PUBLISHED">{formatUiLabel("PUBLISHED")}</option>
        </select>
      </div>
      <input name="order" type="number" min={0} defaultValue={0} className="tailadmin-input" />
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={togglePreview} className="tailadmin-button-outline flex-1">{preview ? "Tutup pratinjau" : "Lihat pratinjau"}</button>
        <button disabled={isSubmitting} className="tailadmin-button-primary flex-1">
          {isSubmitting ? "Menyimpan..." : "Simpan Materi"}
        </button>
      </div>
      {preview ? <MaterialPreviewCard preview={preview} /> : null}
    </form>
  );
}

type MaterialPreview = {
  title: string;
  type: string;
  content: string;
  videoUrl: string;
  language: string;
  direction: string;
  status: string;
  sessionLabel: string;
};

function MaterialPreviewCard({ preview }: { preview: MaterialPreview }) {
  const typeLabel = formatUiLabel(preview.type);

  return (
    <article className="tailadmin-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-600">Pratinjau materi / {typeLabel}</p>
          <LocalizedContent as="h3" text={preview.title} language={preview.language} direction="auto" className="mt-1 text-lg font-semibold text-gray-900">{preview.title || "Tanpa judul"}</LocalizedContent>
        </div>
        <StatusBadge status={preview.status} compact />
      </div>
      <p className="mt-3 text-theme-xs text-gray-500">{preview.sessionLabel || "Materi umum"}{preview.language ? ` / Bahasa ${preview.language}` : ""}</p>
      {preview.type === "VIDEO_LINK" && preview.videoUrl ? <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4"><p className="text-theme-xs font-semibold text-gray-500">Tautan video</p><p className="mt-1 break-all text-theme-sm text-limo-blue-600">{preview.videoUrl}</p></div> : null}
       {preview.type === "TEXT" ? <LocalizedContent as="p" text={preview.content} language={preview.language} direction={preview.direction} className="mt-4 whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 p-4 text-theme-sm leading-7 text-gray-700">{preview.content || "Belum ada isi materi."}</LocalizedContent> : null}
      {(preview.type === "PDF" || preview.type === "IMAGE") ? <p className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4 text-theme-sm text-gray-600">Berkas {typeLabel.toLowerCase()} dapat diunggah setelah materi disimpan.</p> : null}
      {preview.type === "VIDEO_LINK" && !preview.videoUrl ? <p className="mt-4 rounded-xl bg-warning-50 p-4 text-theme-sm text-warning-800">URL video belum diisi.</p> : null}
    </article>
  );
}

export function MateriFileUpload({ materiId }: { materiId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      await requestJson(`/api/v1/guru/materi/${materiId}/files`, { method: "POST", body: formData, fallbackMessage: "Unggah berkas gagal" });

      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unggah berkas gagal");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2">
      {error ? <p className="text-theme-xs text-error-700">{error}</p> : null}
      <input
        name="file"
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className="w-full text-theme-xs text-gray-600 file:me-2 file:rounded-lg file:border-0 file:bg-white file:px-2 file:py-1 file:text-theme-xs file:font-semibold file:text-limo-blue-500"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="tailadmin-button-outline px-3 py-1 text-theme-xs"
      >
        {isSubmitting ? "Mengunggah..." : "Unggah berkas"}
      </button>
    </form>
  );
}
