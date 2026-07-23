"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type RegistrationResult = {
  pendaftaran: {
    id: string;
    kode: string;
    status: string;
    studentName: string;
  };
};

type StatusResult = {
  pendaftaran: {
    kode: string;
    status: string;
    studentName: string;
    rejectionReason?: string | null;
    submittedAt?: string | null;
    reviewedAt?: string | null;
    program: { name: string };
  };
};

type ApiEnvelope<T> = {
  data?: T;
  error?: { message?: string };
};

async function readApi<T>(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;

  if (!response.ok || !payload.data) {
    throw new Error(payload.error?.message || "Permintaan gagal diproses");
  }

  return payload.data;
}

export function PendaftaranForm() {
  const [error, setError] = useState("");
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/v1/pendaftaran", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programKind: String(formData.get("programKind") || ""),
          studentName: String(formData.get("studentName") || ""),
          studentBirthDate: String(formData.get("studentBirthDate") || ""),
          waliName: String(formData.get("waliName") || ""),
          waliEmail: String(formData.get("waliEmail") || ""),
          waliPhone: String(formData.get("waliPhone") || ""),
        }),
      });

      const data = await readApi<RegistrationResult>(response);
      const uploadedFile = formData.get("document");

      if (uploadedFile instanceof File && uploadedFile.size > 0) {
        const uploadData = new FormData();
        uploadData.set("kode", data.pendaftaran.kode);
        uploadData.set("waliEmail", String(formData.get("waliEmail") || ""));
        uploadData.set("file", uploadedFile);

        const uploadResponse = await fetch(`/api/v1/pendaftaran/${data.pendaftaran.id}/files`, {
          method: "POST",
          body: uploadData,
        });

        await readApi(uploadResponse);
      }

      setResult(data);
      event.currentTarget.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pendaftaran gagal dikirim");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <Link href="/" className="text-theme-sm font-semibold text-brand-500">
        Kembali ke beranda
      </Link>
      <h1 className="mt-6 tailadmin-page-title">Pendaftaran Online</h1>
      <p className="mt-3 tailadmin-muted">
        Isi data calon siswa dan wali. Dokumen pendukung akan ditambahkan setelah storage privat aktif.
      </p>

      <form onSubmit={onSubmit} className="tailadmin-card mt-8 space-y-5 p-6">
        {error ? <p className="tailadmin-alert-error">{error}</p> : null}
        {result ? (
          <div className="tailadmin-alert-success">
            <p className="font-semibold">Pendaftaran berhasil dikirim.</p>
            <p>Kode pendaftaran: {result.pendaftaran.kode}</p>
            <p>Simpan kode ini untuk mengecek status.</p>
          </div>
        ) : null}

        <label className="block text-theme-sm font-medium text-gray-700">
          Program
          <select
            name="programKind"
            required
            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none"
          >
            <option value="ENGLISH">Bahasa Inggris</option>
            <option value="ARABIC">Bahasa Arab</option>
          </select>
        </label>

        <label className="block text-theme-sm font-medium text-gray-700">
          Nama Calon Siswa
          <input
            name="studentName"
            required
            minLength={2}
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none"
          />
        </label>

        <label className="block text-theme-sm font-medium text-gray-700">
          Tanggal Lahir Siswa
          <input
            name="studentBirthDate"
            type="date"
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none"
          />
        </label>

        <label className="block text-theme-sm font-medium text-gray-700">
          Nama Wali
          <input
            name="waliName"
            required
            minLength={2}
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none"
          />
        </label>

        <label className="block text-theme-sm font-medium text-gray-700">
          Email Wali
          <input
            name="waliEmail"
            type="email"
            required
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none"
          />
        </label>

        <label className="block text-theme-sm font-medium text-gray-700">
          Nomor WhatsApp/HP Wali
          <input
            name="waliPhone"
            inputMode="tel"
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none"
          />
        </label>

        <label className="block text-theme-sm font-medium text-gray-700">
          Dokumen Pendukung
          <input
            name="document"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="mt-2 w-full rounded-lg border border-dashed border-gray-300 px-4 py-3 text-theme-sm outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-theme-sm file:font-semibold"
          />
          <span className="mt-2 block text-theme-xs text-gray-500">Opsional. Format PDF, JPG, atau PNG. Maksimal 10 MB.</span>
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="tailadmin-button-primary w-full py-3"
        >
          {isSubmitting ? "Mengirim..." : "Kirim Pendaftaran"}
        </button>
      </form>
    </div>
  );
}

export function StatusPendaftaranForm() {
  const [error, setError] = useState("");
  const [result, setResult] = useState<StatusResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams({
      kode: String(formData.get("kode") || ""),
      waliEmail: String(formData.get("waliEmail") || ""),
    });

    try {
      const response = await fetch(`/api/v1/pendaftaran/status?${params.toString()}`);
      setResult(await readApi<StatusResult>(response));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status tidak dapat dicek");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <Link href="/" className="text-theme-sm font-semibold text-brand-500">
        Kembali ke beranda
      </Link>
      <h1 className="mt-6 tailadmin-page-title">Cek Status Pendaftaran</h1>
      <p className="mt-3 tailadmin-muted">
        Masukkan kode pendaftaran dan email wali sebagai verifikasi identitas.
      </p>

      <form onSubmit={onSubmit} className="tailadmin-card mt-8 space-y-5 p-6">
        {error ? <p className="tailadmin-alert-error">{error}</p> : null}
        <label className="block text-theme-sm font-medium text-gray-700">
          Kode Pendaftaran
          <input
            name="kode"
            required
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 uppercase outline-none"
          />
        </label>
        <label className="block text-theme-sm font-medium text-gray-700">
          Email Wali
          <input
            name="waliEmail"
            type="email"
            required
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="tailadmin-button-primary w-full py-3"
        >
          {isSubmitting ? "Mengecek..." : "Cek Status"}
        </button>
      </form>

      {result ? (
        <section className="tailadmin-card mt-6 p-6">
          <p className="text-theme-sm font-semibold text-brand-500">{result.pendaftaran.kode}</p>
          <h2 className="mt-2 text-theme-xl font-bold text-gray-900">{result.pendaftaran.studentName}</h2>
          <dl className="mt-4 grid gap-3 text-theme-sm text-gray-700 sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Program</dt>
              <dd>{result.pendaftaran.program.name}</dd>
            </div>
            <div>
              <dt className="font-semibold">Status</dt>
              <dd>{result.pendaftaran.status}</dd>
            </div>
          </dl>
          {result.pendaftaran.rejectionReason ? (
            <p className="mt-4 tailadmin-alert-warning">
              Alasan: {result.pendaftaran.rejectionReason}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
