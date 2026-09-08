"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatUiLabel } from "@/lib/ui-labels";

type RegistrationResult = {
  pendaftaran: {
    id: string;
    kode: string;
    status: string;
    studentName: string;
    isWaitingList?: boolean;
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

type PublicProgram = {
  id: string;
  name: string;
  kind: string;
  description?: string | null;
  registrationAvailability: "OPEN" | "LIMITED_SLOTS" | "FULL" | "COMING_SOON";
  registrationNote?: string | null;
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

function availabilityMeta(value: PublicProgram["registrationAvailability"]) {
  switch (value) {
    case "LIMITED_SLOTS": return { label: "Slot Terbatas", tone: "bg-warning-50 text-warning-700 border-warning-200", dot: "bg-warning-500" };
    case "FULL": return { label: "Waiting List", tone: "bg-error-50 text-error-700 border-error-200", dot: "bg-error-500" };
    case "COMING_SOON": return { label: "Segera Dibuka", tone: "bg-gray-100 text-gray-500 border-gray-200", dot: "bg-gray-400" };
    default: return { label: "Kuota Tersedia", tone: "bg-success-50 text-success-700 border-success-200", dot: "bg-success-500" };
  }
}

export function PendaftaranForm() {
  const [programs, setPrograms] = useState<PublicProgram[]>([]);
  const [selectedKind, setSelectedKind] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/v1/public/programs")
      .then((response) => response.json() as Promise<ApiEnvelope<{ items: PublicProgram[] }>>)
      .then((payload) => {
        const items = payload.data?.items ?? [];
        setPrograms(items);
        setSelectedKind(items.find((item) => item.registrationAvailability !== "COMING_SOON")?.kind ?? "");
      })
      .catch(() => setPrograms([]));
  }, []);

  const selectablePrograms = useMemo(() => programs.filter((program) => program.registrationAvailability !== "COMING_SOON"), [programs]);
  const selectedProgram = programs.find((program) => program.kind === selectedKind) ?? selectablePrograms[0];

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
          programKind: selectedKind,
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
      setSelectedKind("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pendaftaran gagal dikirim");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <Link href="/" className="text-theme-sm font-semibold text-limo-blue-700">
        ← Kembali ke beranda
      </Link>
      <h1 className="mt-6 tailadmin-page-title">Pendaftaran Online</h1>
      <p className="mt-3 tailadmin-muted">
        Isi data calon siswa dan wali. Status kuota setiap program ditampilkan langsung — jika penuh, Anda tetap bisa bergabung ke waiting list.
      </p>

      {/* Pilih program — kartu radio dengan status kuota */}
      <div className="mt-8">
        <p className="text-theme-sm font-semibold text-gray-800">Pilih program</p>
        <div role="radiogroup" aria-label="Pilih program" className="mt-3 grid gap-3 sm:grid-cols-2">
          {programs.length === 0 ? (
            <p className="col-span-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-5 text-theme-sm text-gray-500">Memuat program…</p>
          ) : (
            programs.map((program) => {
              const meta = availabilityMeta(program.registrationAvailability);
              const disabled = program.registrationAvailability === "COMING_SOON";
              const selected = program.kind === selectedProgram?.kind;
              return (
                <button
                  key={program.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => setSelectedKind(program.kind)}
                  className={`relative rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limo-blue-500/50 ${disabled ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60" : selected ? "border-limo-blue-500 bg-limo-blue-50 ring-2 ring-limo-blue-500" : "border-gray-200 bg-white hover:border-limo-blue-300 hover:bg-limo-blue-50/50"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={`text-theme-sm font-bold ${selected ? "text-limo-blue-700" : "text-gray-800"}`}>{program.name}</span>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${meta.tone}`}>
                      <span className={`size-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </div>
                  {selected ? (
                    <span aria-hidden="true" className="absolute right-3 top-3 text-limo-blue-600">✓</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
        {selectedProgram?.registrationAvailability === "FULL" ? (
          <p className="mt-3 rounded-xl border border-error-200 bg-error-50 px-4 py-2.5 text-theme-sm text-error-700">
            Program ini penuh. Pendaftaran Anda akan masuk ke <strong>waiting list</strong> dan ditindaklanjuti saat slot tersedia.
          </p>
        ) : null}
        {selectedProgram?.registrationNote ? (
          <p className="mt-2 text-theme-sm text-gray-500">{selectedProgram.registrationNote}</p>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="tailadmin-card mt-8 space-y-5 p-6">
        {error ? <p className="tailadmin-alert-error">{error}</p> : null}

        <label className="block text-theme-sm font-medium text-gray-700">
          Nama Calon Siswa
          <input name="studentName" required minLength={2} className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none" />
        </label>

        <label className="block text-theme-sm font-medium text-gray-700">
          Tanggal Lahir Siswa
          <input name="studentBirthDate" type="date" className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none" />
        </label>

        <label className="block text-theme-sm font-medium text-gray-700">
          Nama Wali
          <input name="waliName" required minLength={2} className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none" />
        </label>

        <label className="block text-theme-sm font-medium text-gray-700">
          Email Wali
          <input name="waliEmail" type="email" required className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none" />
        </label>

        <label className="block text-theme-sm font-medium text-gray-700">
          Nomor WhatsApp/HP Wali
          <input name="waliPhone" inputMode="tel" className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none" />
        </label>

        <label className="block text-theme-sm font-medium text-gray-700">
          Dokumen atau Foto Pendukung
          <input name="document" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="mt-2 w-full rounded-lg border border-dashed border-gray-300 px-4 py-3 text-theme-sm outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-theme-sm file:font-semibold" />
          <span className="mt-2 block text-theme-xs text-gray-500">Opsional. Format PDF, JPG/JPEG, atau PNG. Maksimal 10 MB.</span>
        </label>

        <button type="submit" disabled={isSubmitting || !selectedProgram} className="tailadmin-button-primary w-full py-3">
          {isSubmitting ? "Mengirim..." : selectedProgram?.registrationAvailability === "FULL" ? "Join the Waiting List" : "Kirim Pendaftaran"}
        </button>
      </form>

      {/* Popup sukses */}
      {result ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="success-title">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-success-50">
              <svg viewBox="0 0 24 24" className="size-7 text-success-600" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            <h2 id="success-title" className="mt-5 text-center text-xl font-extrabold text-gray-900">
              {result.pendaftaran.isWaitingList ? "Masuk ke Waiting List" : "Pendaftaran Berhasil Dikirim"}
            </h2>
            <p className="mt-2 text-center text-theme-sm text-gray-600">
              {selectedProgram?.name ? <>Program <strong className="text-gray-800">{selectedProgram.name}</strong></> : null}
              {result.pendaftaran.isWaitingList ? " — Anda masuk daftar tunggu." : ""}
            </p>

            <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-center">
              <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">Kode pendaftaran Anda</p>
              <p className="mt-1 text-2xl font-extrabold tracking-widest text-limo-blue-700">{result.pendaftaran.kode}</p>
            </div>

            <div className="mt-5 space-y-2.5">
              <p className="text-theme-sm font-semibold text-gray-800">Langkah selanjutnya</p>
              <ol className="list-inside list-decimal space-y-1.5 text-theme-sm text-gray-600">
                <li>Simpan kode pendaftaran di atas untuk mengecek status.</li>
                <li>Tim LIMO akan meninjau pendaftaran Anda.</li>
                <li>Pantau perkembangan lewat halaman status pendaftaran.</li>
              </ol>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link href="/status-pendaftaran" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-limo-blue-600 px-5 py-3 text-theme-sm font-bold text-white hover:bg-limo-blue-700">Cek Status Pendaftaran</Link>
              <button type="button" onClick={() => setResult(null)} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-gray-300 px-5 py-3 text-theme-sm font-bold text-gray-700 hover:bg-gray-50">Tutup</button>
            </div>
          </div>
        </div>
      ) : null}
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
      <Link href="/" className="text-theme-sm font-semibold text-limo-blue-700">
        ← Kembali ke beranda
      </Link>
      <h1 className="mt-6 tailadmin-page-title">Cek Status Pendaftaran</h1>
      <p className="mt-3 tailadmin-muted">
        Masukkan kode pendaftaran dan email wali sebagai verifikasi identitas.
      </p>

      <form onSubmit={onSubmit} className="tailadmin-card mt-8 space-y-5 p-6">
        {error ? <p className="tailadmin-alert-error">{error}</p> : null}
        <label className="block text-theme-sm font-medium text-gray-700">
          Kode Pendaftaran
          <input name="kode" required className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 uppercase outline-none" />
        </label>
        <label className="block text-theme-sm font-medium text-gray-700">
          Email Wali
          <input name="waliEmail" type="email" required className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none" />
        </label>
        <button type="submit" disabled={isSubmitting} className="tailadmin-button-primary w-full py-3">
          {isSubmitting ? "Mengecek..." : "Cek Status"}
        </button>
      </form>

      {result ? (
        <section className="tailadmin-card mt-6 p-6">
          <p className="text-theme-sm font-semibold text-limo-blue-700">{result.pendaftaran.kode}</p>
          <h2 className="mt-2 text-theme-xl font-bold text-gray-900">{result.pendaftaran.studentName}</h2>
          <dl className="mt-4 grid gap-3 text-theme-sm text-gray-700 sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Program</dt>
              <dd>{result.pendaftaran.program.name}</dd>
            </div>
            <div>
              <dt className="font-semibold">Status</dt>
              <dd>{formatUiLabel(result.pendaftaran.status)}</dd>
            </div>
          </dl>
          {result.pendaftaran.rejectionReason ? (
            <p className="mt-4 tailadmin-alert-warning">Alasan: {result.pendaftaran.rejectionReason}</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
