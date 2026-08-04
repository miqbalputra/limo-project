"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { FormFieldError } from "@/components/dashboard/form-field-error";

type FieldErrors = Record<string, string[]>;

class FormRequestError extends Error {
  fields?: FieldErrors;

  constructor(message: string, fields?: FieldErrors) {
    super(message);
    this.fields = fields;
  }
}

async function postJson(path: string, body: Record<string, string | number>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string; fields?: FieldErrors } };
    throw new FormRequestError(payload.error?.message || "Data gagal disimpan", payload.error?.fields);
  }
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Data gagal disimpan");
      setFieldErrors(caught instanceof FormRequestError ? caught.fields || {} : {});
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
      {error ? <p className="tailadmin-alert-error">{error}</p> : null}
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
        });
      }}
      className="tailadmin-card grid gap-3 p-5"
    >
      <h2 className="font-semibold text-gray-900">Tambah Materi</h2>
      {error ? <p className="tailadmin-alert-error">{error}</p> : null}
      <input name="title" required placeholder="Judul materi" aria-invalid={Boolean(fieldErrors.title)} aria-describedby="materi-title-error" className="tailadmin-input" />
      <FormFieldError id="materi-title-error" errors={fieldErrors.title} />
      <select name="type" aria-invalid={Boolean(fieldErrors.type)} aria-describedby="materi-type-error" className="tailadmin-input">
        <option value="TEXT">Teks</option>
        <option value="PDF">PDF</option>
        <option value="IMAGE">Gambar</option>
        <option value="VIDEO_LINK">Link Video</option>
      </select>
      <FormFieldError id="materi-type-error" errors={fieldErrors.type} />
      <select name="sesiKelasId" aria-invalid={Boolean(fieldErrors.sesiKelasId)} aria-describedby="materi-session-error" className="tailadmin-input">
        <option value="">Tanpa sesi spesifik</option>
        {sesiOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      <FormFieldError id="materi-session-error" errors={fieldErrors.sesiKelasId} />
      <textarea name="content" placeholder="Isi teks materi, kosongkan untuk PDF/gambar/video" aria-invalid={Boolean(fieldErrors.content)} aria-describedby="materi-content-error" className="tailadmin-input min-h-32" />
      <FormFieldError id="materi-content-error" errors={fieldErrors.content} />
      <input name="videoUrl" placeholder="https://youtube.com/... khusus materi video" aria-invalid={Boolean(fieldErrors.videoUrl)} aria-describedby="materi-video-error" className="tailadmin-input" />
      <FormFieldError id="materi-video-error" errors={fieldErrors.videoUrl} />
      <div className="grid gap-3 sm:grid-cols-3">
        <input name="language" placeholder="id/ar/en" className="tailadmin-input" />
        <select name="direction" className="tailadmin-input">
          <option value="">Auto</option>
          <option value="ltr">LTR</option>
          <option value="rtl">RTL Arab</option>
        </select>
        <select name="status" className="tailadmin-input">
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Publish</option>
        </select>
      </div>
      <input name="order" type="number" min={0} defaultValue={0} className="tailadmin-input" />
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={togglePreview} className="tailadmin-button-outline flex-1">{preview ? "Tutup Preview" : "Lihat Preview"}</button>
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
  const typeLabel = { TEXT: "Teks", PDF: "PDF", IMAGE: "Gambar", VIDEO_LINK: "Link Video" }[preview.type] || preview.type;

  return (
    <article className="rounded-2xl border border-brand-100 bg-brand-50/40 p-5" dir={preview.direction === "rtl" ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-600">Preview Materi / {typeLabel}</p>
          <h3 className="mt-1 text-lg font-semibold text-gray-900">{preview.title || "Tanpa judul"}</h3>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-theme-xs font-semibold text-gray-600">{preview.status === "PUBLISHED" ? "Publish" : "Draft"}</span>
      </div>
      <p className="mt-3 text-theme-xs text-gray-500">{preview.sessionLabel || "Materi umum"}{preview.language ? ` / Bahasa ${preview.language}` : ""}</p>
      {preview.type === "VIDEO_LINK" && preview.videoUrl ? <div className="mt-4 rounded-xl bg-white p-4"><p className="text-theme-xs font-semibold text-gray-500">Link video</p><p className="mt-1 break-all text-theme-sm text-brand-600">{preview.videoUrl}</p></div> : null}
      {preview.type === "TEXT" ? <p className="mt-4 whitespace-pre-wrap rounded-xl bg-white p-4 text-theme-sm leading-6 text-gray-700">{preview.content || "Belum ada isi materi."}</p> : null}
      {(preview.type === "PDF" || preview.type === "IMAGE") ? <p className="mt-4 rounded-xl bg-white p-4 text-theme-sm text-gray-600">File {typeLabel.toLowerCase()} dapat diunggah setelah materi disimpan.</p> : null}
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
      const response = await fetch(`/api/v1/guru/materi/${materiId}/files`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(payload.error?.message || "Upload file gagal");
      }

      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload file gagal");
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
        className="w-full text-theme-xs text-gray-600 file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-2 file:py-1 file:text-theme-xs file:font-semibold file:text-brand-500"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="tailadmin-button-outline px-3 py-1 text-theme-xs"
      >
        {isSubmitting ? "Upload..." : "Upload File"}
      </button>
    </form>
  );
}
