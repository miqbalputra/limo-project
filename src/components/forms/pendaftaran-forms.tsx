"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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

const inputClass = "mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-theme-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-limo-blue-500 focus:ring-4 focus:ring-limo-blue-500/15";

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-theme-sm font-semibold text-gray-700">
      <span>
        {label} {required ? <span className="text-error-600">*</span> : <span className="font-normal text-gray-400">(opsional)</span>}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-theme-xs font-normal text-gray-400">{hint}</span> : null}
    </label>
  );
}

function SectionHeading({ step, title, description }: { step: number; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-limo-blue-600 text-theme-sm font-extrabold text-white">{step}</span>
      <div className="min-w-0">
        <h2 className="text-lg font-extrabold tracking-tight text-gray-900">{title}</h2>
        {description ? <p className="mt-0.5 text-theme-sm text-gray-500">{description}</p> : null}
      </div>
    </div>
  );
}

const formSections = [
  { title: "Pilih program", desc: "Cek kuota terkini langsung di kartu program." },
  { title: "Lengkapi data", desc: "Isi data calon siswa dan wali." },
  { title: "Terima kode", desc: "Kode pendaftaran muncul setelah formulir dikirim." },
];

const afterSubmitSteps = [
  { title: "Tim LIMO meninjau", desc: "Pendaftaran Anda diperiksa oleh tim LIMO." },
  { title: "Konfirmasi ke wali", desc: "Kami menghubungi wali melalui email atau WhatsApp." },
  { title: "Ananda resmi bergabung", desc: "Informasi kelas dan akses dashboard diberikan." },
];

const trustPoints = [
  { label: "Pengajar terverifikasi LIMO", icon: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /> },
  { label: "Laporan perkembangan untuk wali", icon: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M8 15h4" /></> },
  { label: "Kelas ramah anak", icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></> },
];

export function PendaftaranForm() {
  const [programs, setPrograms] = useState<PublicProgram[]>([]);
  const [selectedKind, setSelectedKind] = useState("");
  const [waliRelation, setWaliRelation] = useState<"BAPAK" | "IBU">("IBU");
  const [error, setError] = useState("");
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoName, setPhotoName] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function onPhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    if (!file) {
      setPhotoPreview(null);
      setPhotoName("");
      return;
    }
    setPhotoName(file.name);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPhotoPreview(null);
    setPhotoName("");
  }

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
          waliRelation,
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
      clearPhoto();
      event.currentTarget.reset();
      setSelectedKind("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pendaftaran gagal dikirim");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-25">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <Link href="/" className="inline-flex items-center gap-1.5 text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          Kembali ke beranda
        </Link>

        <header className="mt-6 max-w-2xl">
          <p className="text-theme-sm font-bold uppercase tracking-widest text-limo-blue-700">Pendaftaran Murid Baru</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Daftarkan Ananda di LIMO Academy</h1>
          <p className="mt-3 text-lg text-gray-600">
            Isi formulir di bawah — status kuota setiap program ditampilkan langsung. Jika kuota penuh, Anda tetap bisa masuk <strong className="font-semibold text-gray-800">waiting list</strong>.
          </p>
        </header>

        {/* Strip langkah */}
        <ol className="mt-8 grid gap-3 sm:grid-cols-3">
          {formSections.map((step, index) => (
            <li key={step.title} className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 shadow-theme-xs">
              <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-limo-blue-50 text-theme-xs font-extrabold text-limo-blue-700">{index + 1}</span>
              <span className="min-w-0">
                <span className="block text-theme-sm font-bold text-gray-800">{step.title}</span>
                <span className="mt-0.5 block text-theme-xs text-gray-500">{step.desc}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
          {/* ─── Kolom formulir ─── */}
          <form onSubmit={onSubmit} className="space-y-6" noValidate={false}>
            {/* 1 — Pilih program */}
            <section className="tailadmin-card p-6 sm:p-8">
              <SectionHeading step={1} title="Pilih Program" description="Klik salah satu kartu program untuk Ananda." />
              <div role="radiogroup" aria-label="Pilih program" className="mt-5 grid gap-3 sm:grid-cols-2">
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
                        className={`flex min-h-[76px] items-start gap-3 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limo-blue-500/50 ${disabled ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60" : selected ? "border-limo-blue-500 bg-limo-blue-50/70 ring-2 ring-limo-blue-500" : "border-gray-200 bg-white hover:border-limo-blue-300 hover:bg-limo-blue-50/40"}`}
                      >
                        <span aria-hidden="true" className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition ${selected ? "border-limo-blue-600 bg-limo-blue-600 text-white" : "border-gray-300 bg-white text-transparent"}`}>
                          <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-theme-sm font-bold ${selected ? "text-limo-blue-700" : "text-gray-800"}`}>{program.name}</span>
                          {program.description ? <span className="mt-1 block text-theme-xs leading-relaxed text-gray-500">{program.description}</span> : null}
                        </span>
                        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${meta.tone}`}>
                          <span className={`size-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              {selectedProgram?.registrationAvailability === "FULL" ? (
                <p className="mt-4 rounded-xl border border-error-200 bg-error-50 px-4 py-2.5 text-theme-sm text-error-700">
                  Program ini penuh. Pendaftaran Anda akan masuk ke <strong>waiting list</strong> dan ditindaklanjuti saat slot tersedia.
                </p>
              ) : null}
              {selectedProgram?.registrationNote ? (
                <p className="mt-3 rounded-xl border border-limo-blue-200 bg-limo-blue-50/60 px-4 py-2.5 text-theme-sm text-limo-blue-700">{selectedProgram.registrationNote}</p>
              ) : null}
            </section>

            {/* 2 — Data calon siswa */}
            <section className="tailadmin-card p-6 sm:p-8">
              <SectionHeading step={2} title="Data Calon Siswa" description="Data Ananda yang akan mendaftar." />
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Field label="Nama Lengkap Ananda" required>
                  <input name="studentName" required minLength={2} autoComplete="name" placeholder="cth. Aisyah Putri" className={inputClass} />
                </Field>
                <Field label="Tanggal Lahir" hint="Membantu kami menempatkan Ananda di kelas yang sesuai.">
                  <input name="studentBirthDate" type="date" className={inputClass} />
                </Field>
              </div>
            </section>

            {/* 3 — Data wali */}
            <section className="tailadmin-card p-6 sm:p-8">
              <SectionHeading step={3} title="Data Wali" description="Kontak yang akan kami hubungi terkait pendaftaran." />
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Field label="Status Wali" required>
                  <div role="radiogroup" aria-label="Status wali" className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
                    {(["BAPAK", "IBU"] as const).map((relation) => (
                      <button
                        key={relation}
                        type="button"
                        role="radio"
                        aria-checked={waliRelation === relation}
                        onClick={() => setWaliRelation(relation)}
                        className={`min-h-11 rounded-lg text-theme-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limo-blue-500/50 ${waliRelation === relation ? "bg-white text-limo-blue-700 shadow-theme-sm" : "text-gray-500 hover:text-gray-700"}`}
                      >
                        {relation === "BAPAK" ? "Bapak" : "Ibu"}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Nama Lengkap Wali" required>
                  <input name="waliName" required minLength={2} autoComplete="name" placeholder={waliRelation === "BAPAK" ? "cth. Ahmad Fauzi (Ayah)" : "cth. Siti Rahma (Ibu)"} className={inputClass} />
                </Field>
                <Field label="Email Wali" required hint="Kode pendaftaran dan informasi status dikirim ke email ini.">
                  <input name="waliEmail" type="email" required autoComplete="email" placeholder="cth. ortu@email.com" className={inputClass} />
                </Field>
                <Field label="Nomor WhatsApp / HP">
                  <input name="waliPhone" type="tel" inputMode="tel" autoComplete="tel" placeholder="cth. 0812 3456 7890" className={inputClass} />
                </Field>
              </div>
            </section>

            {/* 4 — Foto Ananda */}
            <section className="tailadmin-card p-6 sm:p-8">
              <SectionHeading step={4} title="Foto Ananda" description="Opsional — membantu tim LIMO mengenal calon siswa sebelum kelas dimulai." />
              <div className="mt-5">
                {photoPreview ? (
                  <div className="overflow-hidden rounded-2xl border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreview} alt="Pratinjau foto Ananda" className="h-48 w-full object-cover" />
                    <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-2.5">
                      <span className="min-w-0 truncate text-theme-xs font-medium text-gray-500">{photoName}</span>
                      <button type="button" onClick={clearPhoto} className="shrink-0 text-theme-xs font-bold text-error-600 hover:text-error-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-400">
                        Hapus foto
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center transition hover:border-limo-blue-400 hover:bg-limo-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limo-blue-500/40"
                  >
                    <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-white shadow-theme-xs">
                      <svg viewBox="0 0 24 24" className="size-6 text-limo-blue-600" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.2-1.8a1 1 0 0 1 .83-.45h3.74a1 1 0 0 1 .83.45L15.9 6h1.6A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" /><circle cx="12" cy="12.5" r="3.2" /></svg>
                    </span>
                    <span className="text-theme-sm font-bold text-gray-700">Klik untuk pilih foto</span>
                    <span className="text-theme-xs text-gray-400">JPG atau PNG · maksimal 10 MB</span>
                  </button>
                )}
                <input ref={fileInputRef} name="document" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" className="sr-only" onChange={onPhotoChange} />
              </div>
            </section>

            {error ? <p className="tailadmin-alert-error" role="alert">{error}</p> : null}

            <div className="tailadmin-card space-y-4 p-6 sm:p-8">
              <button type="submit" disabled={isSubmitting || !selectedProgram} className="tailadmin-button-primary w-full py-3.5 text-base">
                {isSubmitting ? "Mengirim…" : selectedProgram?.registrationAvailability === "FULL" ? "Join the Waiting List" : "Kirim Pendaftaran"}
              </button>
              <p className="flex items-center justify-center gap-1.5 text-center text-theme-xs text-gray-400">
                <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-success-600" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>
                Data Anda aman dan hanya digunakan untuk keperluan pendaftaran.
              </p>
            </div>
          </form>

          {/* ─── Panel informasi ─── */}
          <aside className="space-y-6 lg:sticky lg:top-10">
            <section className="tailadmin-card p-6">
              <h2 className="text-theme-base font-extrabold text-gray-900">Setelah formulir dikirim</h2>
              <ol className="mt-4 space-y-4">
                {afterSubmitSteps.map((step, index) => (
                  <li key={step.title} className="flex items-start gap-3">
                    <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-limo-blue-50 text-theme-xs font-extrabold text-limo-blue-700">{index + 1}</span>
                    <span className="min-w-0">
                      <span className="block text-theme-sm font-bold text-gray-800">{step.title}</span>
                      <span className="mt-0.5 block text-theme-xs leading-relaxed text-gray-500">{step.desc}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-3xl border border-limo-blue-200 bg-gradient-to-br from-limo-blue-50 to-white p-6">
              <h2 className="text-theme-base font-extrabold text-limo-blue-700">Kenapa LIMO Academy?</h2>
              <ul className="mt-4 space-y-3">
                {trustPoints.map((point) => (
                  <li key={point.label} className="flex items-center gap-2.5 text-theme-sm font-medium text-gray-700">
                    <svg viewBox="0 0 24 24" className="size-4.5 shrink-0 text-limo-blue-600" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{point.icon}</svg>
                    {point.label}
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>

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
