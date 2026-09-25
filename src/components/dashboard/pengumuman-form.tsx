"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { FormFieldError } from "@/components/dashboard/form-field-error";
import { ApiJsonError, requestJson } from "@/lib/api-json-client";

export type PengumumanValues = {
  title: string;
  content: string;
  priority: string;
  audience: string;
  publishAt: string;
  expiresAt: string;
  status: string;
};

type FieldErrors = Record<string, string[]>;

export function PengumumanForm({
  kelasId,
  id,
  initial,
  onCancel,
}: {
  kelasId: string;
  id?: string;
  initial?: PengumumanValues;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<PengumumanValues>(() => ({
    title: "",
    content: "",
    priority: "NORMAL",
    audience: "SEMUA",
    publishAt: "",
    expiresAt: "",
    status: "PUBLISHED",
    ...initial,
  }));

  function patch(next: Partial<PengumumanValues>) {
    setValues((current) => ({ ...current, ...next }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    setBusy(true);

    try {
      await requestJson(id ? `/api/v1/pengumuman/${id}` : "/api/v1/pengumuman", {
        method: id ? "PATCH" : "POST",
        body: {
          ...(id ? {} : { kelasId, status: values.status }),
          title: values.title,
          content: values.content,
          priority: values.priority,
          audience: values.audience,
          publishAt: values.publishAt,
          expiresAt: values.expiresAt,
        },
        fallbackMessage: "Pengumuman gagal disimpan",
      });
      router.refresh();
      onCancel?.();
    } catch (caught) {
      if (caught instanceof ApiJsonError) setFieldErrors(caught.fields || {});
      setError(caught instanceof Error ? caught.message : "Pengumuman gagal disimpan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-gray-900">{id ? "Ubah pengumuman" : "Buat pengumuman"}</p>
        {onCancel ? <button type="button" onClick={onCancel} className="text-theme-sm font-semibold text-gray-500 hover:text-gray-700">Batal</button> : null}
      </div>

      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}

      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Judul
        <input
          value={values.title}
          onChange={(event) => patch({ title: event.target.value })}
          required
          maxLength={200}
          placeholder="Contoh: Ujian minggu depan pindah jam 09.00"
          aria-label="Judul pengumuman"
          dir="auto"
          className="mt-2 tailadmin-input"
        />
      </label>
      <FormFieldError id="pengumuman-title-error" errors={fieldErrors.title} />

      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Isi pengumuman
        <textarea
          value={values.content}
          onChange={(event) => patch({ content: event.target.value })}
          required
          rows={5}
          maxLength={10000}
          placeholder="Tulis isi pengumuman untuk siswa dan wali"
          aria-label="Isi pengumuman"
          dir="auto"
          className="mt-2 tailadmin-input min-h-32"
        />
      </label>
      <FormFieldError id="pengumuman-content-error" errors={fieldErrors.content} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Prioritas
          <select value={values.priority} onChange={(event) => patch({ priority: event.target.value })} className="mt-2 tailadmin-input">
            <option value="NORMAL">Normal</option>
            <option value="IMPORTANT">Penting</option>
            <option value="URGENT">Mendesak</option>
          </select>
        </label>

        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Penerima
          <select value={values.audience} onChange={(event) => patch({ audience: event.target.value })} className="mt-2 tailadmin-input">
            <option value="SEMUA">Siswa dan wali</option>
            <option value="SISWA">Siswa saja</option>
            <option value="WALI">Wali saja</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Terbit pada (opsional)
          <input
            type="datetime-local"
            value={values.publishAt}
            onChange={(event) => patch({ publishAt: event.target.value })}
            aria-label="Waktu terbit"
            className="mt-2 tailadmin-input"
          />
        </label>
        <FormFieldError id="pengumuman-publish-error" errors={fieldErrors.publishAt} />

        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Berakhir pada (opsional)
          <input
            type="datetime-local"
            value={values.expiresAt}
            onChange={(event) => patch({ expiresAt: event.target.value })}
            aria-label="Waktu berakhir"
            className="mt-2 tailadmin-input"
          />
        </label>
        <FormFieldError id="pengumuman-expires-error" errors={fieldErrors.expiresAt} />
      </div>

      {!id ? (
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Status awal
          <select value={values.status} onChange={(event) => patch({ status: event.target.value })} className="mt-2 tailadmin-input">
            <option value="PUBLISHED">Terbit</option>
            <option value="DRAFT">Draf</option>
          </select>
        </label>
      ) : null}

      <div>
        <button type="submit" disabled={busy} className="tailadmin-button-primary px-4 py-2">
          {busy ? "Menyimpan..." : id ? "Simpan perubahan" : "Buat pengumuman"}
        </button>
      </div>
    </form>
  );
}
