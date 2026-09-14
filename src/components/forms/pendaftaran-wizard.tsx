"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  DOCUMENTATION_CONSENT_OPTIONS,
  GENDER_OPTIONS,
  PARTICIPANT_TYPE_OPTIONS,
  getProgramForm,
  groupPrograms,
  type ProgramField,
} from "@/lib/pendaftaran-program-forms";

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

type RegistrationResult = {
  pendaftaran: {
    id: string;
    kode: string;
    status: string;
    studentName: string;
    isWaitingList?: boolean;
    program?: { name: string };
  };
};

type ParticipantState = {
  type: "" | "SELF" | "CHILD";
  studentName: string;
  studentNickname: string;
  studentGender: "" | "MALE" | "FEMALE";
  studentBirthDate: string;
  waliName: string;
  waliPhone: string;
  waliEmail: string;
  address: string;
  schoolName: string;
  gradeLevel: string;
};

type ConsentState = {
  dataTruth: boolean;
  dataUse: boolean;
  contact: boolean;
  documentation: "" | "WITHOUT_BLUR" | "WITH_BLUR" | "DECLINE";
};

const emptyParticipant: ParticipantState = {
  type: "",
  studentName: "",
  studentNickname: "",
  studentGender: "",
  studentBirthDate: "",
  waliName: "",
  waliPhone: "",
  waliEmail: "",
  address: "",
  schoolName: "",
  gradeLevel: "",
};

const emptyConsents: ConsentState = {
  dataTruth: false,
  dataUse: false,
  contact: false,
  documentation: "",
};

const steps = [
  { title: "Pilih Program" },
  { title: "Data Peserta" },
  { title: "Formulir Program" },
  { title: "Persetujuan" },
];

const inputClass = "mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-theme-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-limo-blue-500 focus:ring-4 focus:ring-limo-blue-500/15";
const radioCardClass = (selected: boolean) =>
  `flex min-h-11 items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-theme-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limo-blue-500/50 ${
    selected ? "border-limo-blue-500 bg-limo-blue-50 text-limo-blue-700" : "border-gray-200 bg-white text-gray-700 hover:border-limo-blue-300 hover:bg-limo-blue-50/40"
  }`;

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

function Field({ label, required, hint, error, children }: { label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-theme-sm font-semibold text-gray-700">
      <span>
        {label} {required ? <span className="text-error-600">*</span> : <span className="font-normal text-gray-400">(opsional)</span>}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-theme-xs font-normal text-gray-400">{hint}</span> : null}
      {error ? <span className="mt-1.5 block text-theme-xs font-semibold text-error-600">{error}</span> : null}
    </label>
  );
}

function RequiredNote({ required, error }: { required?: boolean; error?: string }) {
  return (
    <span>
      {required ? <span className="text-error-600">*</span> : <span className="font-normal text-gray-400">(opsional)</span>}
      {error ? <span className="ml-2 text-theme-xs font-semibold text-error-600">{error}</span> : null}
    </span>
  );
}

export function PendaftaranWizard() {
  const router = useRouter();
  const [programs, setPrograms] = useState<PublicProgram[]>([]);
  const [step, setStep] = useState(0);
  const [programKind, setProgramKind] = useState("");
  const [participant, setParticipant] = useState<ParticipantState>(emptyParticipant);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [consents, setConsents] = useState<ConsentState>(emptyConsents);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);

  useEffect(() => {
    fetch("/api/v1/public/programs")
      .then((response) => response.json() as Promise<ApiEnvelope<{ items: PublicProgram[] }>>)
      .then((payload) => setPrograms(payload.data?.items ?? []))
      .catch(() => setPrograms([]));
  }, []);

  const selectablePrograms = useMemo(() => programs.filter((program) => program.registrationAvailability !== "COMING_SOON"), [programs]);
  const groupedPrograms = useMemo(() => groupPrograms(selectablePrograms), [selectablePrograms]);
  const selectedProgram = programs.find((program) => program.kind === programKind) ?? null;
  const programForm = getProgramForm(programKind);
  const isChild = participant.type === "CHILD";

  function setParticipantField<K extends keyof ParticipantState>(key: K, value: ParticipantState[K]) {
    setParticipant((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function setAnswer(key: string, value: string | string[]) {
    setAnswers((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function toggleAnswer(key: string, value: string) {
    setAnswers((current) => {
      const list = Array.isArray(current[key]) ? (current[key] as string[]) : [];
      const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
      return { ...current, [key]: next };
    });
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function validateStep(target: number) {
    const next: Record<string, string> = {};

    if (target === 0 && !programKind) {
      next.programKind = "Pilih salah satu program terlebih dahulu";
    }

    if (target === 1) {
      if (!participant.type) next.type = "Pilih salah satu";
      if (participant.studentName.trim().length < 2) next.studentName = "Nama lengkap wajib diisi";
      if (!participant.studentGender) next.studentGender = "Pilih jenis kelamin";
      if (!participant.studentBirthDate) next.studentBirthDate = "Tanggal lahir wajib diisi";
      if (participant.waliPhone.replace(/\D/g, "").length < 8) next.waliPhone = "Nomor WhatsApp wajib diisi";
      if (isChild && participant.waliName.trim().length < 2) next.waliName = "Nama orang tua / wali wajib diisi";
      if (participant.waliEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(participant.waliEmail.trim())) next.waliEmail = "Format email tidak valid";
    }

    if (target === 2 && programForm) {
      for (const field of programForm.fields) {
        if (!field.required) continue;
        const value = answers[field.key];
        const text = typeof value === "string" ? value.trim() : "";
        if (field.type === "radio" && !text) next[field.key] = "Pilih salah satu";
        if ((field.type === "text" || field.type === "textarea") && text.length < 2) next[field.key] = "Wajib diisi";
      }
    }

    if (target === 3) {
      if (!consents.dataTruth) next.dataTruth = "Wajib disetujui";
      if (!consents.dataUse) next.dataUse = "Wajib disetujui";
      if (!consents.contact) next.contact = "Wajib disetujui";
      if (!consents.documentation) next.documentation = "Pilih salah satu";
    }

    return next;
  }

  function goNext() {
    const found = validateStep(step);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setErrors({});
    setStep((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateStep(3);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setError("Masih ada bagian yang perlu dilengkapi.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/pendaftaran", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programKind,
          participantType: participant.type,
          studentName: participant.studentName.trim(),
          studentNickname: participant.studentNickname.trim(),
          studentGender: participant.studentGender,
          studentBirthDate: participant.studentBirthDate,
          waliName: isChild ? participant.waliName.trim() : participant.studentName.trim(),
          waliEmail: participant.waliEmail.trim(),
          waliPhone: participant.waliPhone.trim(),
          address: participant.address.trim(),
          schoolName: isChild ? participant.schoolName.trim() : "",
          gradeLevel: isChild ? participant.gradeLevel.trim() : "",
          programAnswers: answers,
          consents: {
            dataTruth: true,
            dataUse: true,
            contact: true,
            documentation: consents.documentation,
          },
        }),
      });

      const data = await readApi<RegistrationResult>(response);

      if (photo) {
        const uploadData = new FormData();
        uploadData.set("kode", data.pendaftaran.kode);
        uploadData.set("identitas", participant.waliPhone.trim());
        uploadData.set("file", photo);
        await fetch(`/api/v1/pendaftaran/${data.pendaftaran.id}/files`, { method: "POST", body: uploadData }).catch(() => undefined);
      }

      window.sessionStorage.setItem(
        "limo:pendaftaran-result",
        JSON.stringify({
          kode: data.pendaftaran.kode,
          programName: data.pendaftaran.program?.name ?? selectedProgram?.name ?? "",
          participantName: data.pendaftaran.studentName,
          participantType: participant.type,
          status: "Pendaftaran Diterima",
          isWaitingList: Boolean(data.pendaftaran.isWaitingList),
        }),
      );
      router.push("/daftar/berhasil");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pendaftaran gagal dikirim");
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderProgramField(field: ProgramField) {
    if (field.type === "radio") {
      return (
        <div key={field.key}>
          <p className="text-theme-sm font-semibold text-gray-700">
            {field.label} <RequiredNote required={field.required} error={errors[field.key]} />
          </p>
          <div role="radiogroup" aria-label={field.label} className="mt-2 grid gap-2 sm:grid-cols-2">
            {(field.options ?? []).map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={answers[field.key] === option.value}
                onClick={() => setAnswer(field.key, option.value)}
                className={radioCardClass(answers[field.key] === option.value)}
              >
                <span aria-hidden="true" className={`grid size-4.5 shrink-0 place-items-center rounded-full border-2 text-[9px] transition ${answers[field.key] === option.value ? "border-limo-blue-600 bg-limo-blue-600 text-white" : "border-gray-300 bg-white text-transparent"}`}>✓</span>
                {option.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (field.type === "checkbox") {
      const values = Array.isArray(answers[field.key]) ? (answers[field.key] as string[]) : [];
      const showOther = Boolean(field.otherKey) && values.includes("LAINNYA");

      return (
        <div key={field.key}>
          <p className="text-theme-sm font-semibold text-gray-700">
            {field.label} <RequiredNote required={field.required} error={errors[field.key]} />
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(field.options ?? []).map((option) => (
              <label key={option.value} className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-theme-sm font-medium transition ${values.includes(option.value) ? "border-limo-blue-500 bg-limo-blue-50 text-limo-blue-700" : "border-gray-200 bg-white text-gray-700 hover:border-limo-blue-300"}`}>
                <input type="checkbox" checked={values.includes(option.value)} onChange={() => toggleAnswer(field.key, option.value)} className="size-4 rounded border-gray-300 text-limo-blue-600 focus:ring-limo-blue-500" />
                {option.label}
              </label>
            ))}
          </div>
          {showOther && field.otherKey ? (
            <input
              type="text"
              value={typeof answers[field.otherKey] === "string" ? (answers[field.otherKey] as string) : ""}
              onChange={(event) => setAnswer(field.otherKey as string, event.target.value)}
              placeholder={field.otherLabel ?? "Tuliskan lainnya"}
              className={inputClass}
            />
          ) : null}
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <Field key={field.key} label={field.label} required={field.required} error={errors[field.key]}>
          <textarea
            value={typeof answers[field.key] === "string" ? (answers[field.key] as string) : ""}
            onChange={(event) => setAnswer(field.key, event.target.value)}
            rows={3}
            placeholder={field.placeholder ?? ""}
            className={inputClass}
          />
        </Field>
      );
    }

    return (
      <Field key={field.key} label={field.label} required={field.required} error={errors[field.key]}>
        <input
          type="text"
          value={typeof answers[field.key] === "string" ? (answers[field.key] as string) : ""}
          onChange={(event) => setAnswer(field.key, event.target.value)}
          placeholder={field.placeholder ?? ""}
          className={inputClass}
        />
      </Field>
    );
  }

  const summaryRows = [
    { label: "Program", value: selectedProgram?.name ?? "-" },
    { label: "Pendaftaran untuk", value: participant.type === "SELF" ? "Diri sendiri" : "Anak" },
    { label: "Nama lengkap", value: participant.studentName || "-" },
    { label: "Jenis kelamin", value: participant.studentGender === "MALE" ? "Laki-laki" : participant.studentGender === "FEMALE" ? "Perempuan" : "-" },
    { label: "Tanggal lahir", value: participant.studentBirthDate || "-" },
    { label: isChild ? "Nama orang tua / wali" : "Nomor WhatsApp", value: isChild ? participant.waliName || "-" : participant.waliPhone || "-" },
    ...(isChild ? [{ label: "Nomor WhatsApp orang tua / wali", value: participant.waliPhone || "-" }] : []),
    { label: "Email", value: participant.waliEmail || "Tidak diisi" },
  ];

  return (
    <div className="min-h-screen bg-gray-25">
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <Link href="/" className="inline-flex items-center gap-1.5 text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          Kembali ke beranda
        </Link>

        <header className="mt-6 max-w-2xl">
          <p className="text-theme-sm font-bold uppercase tracking-widest text-limo-blue-700">Pendaftaran LIMO</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Pendaftaran Murid Baru</h1>
          {step === 0 ? (
            <p className="mt-3 text-lg text-gray-600">
              Selamat datang di LIMO. Silakan pilih program yang ingin Anda ikuti. Setelah memilih program, Anda akan diarahkan ke formulir pendaftaran khusus sesuai dengan program yang dipilih.
            </p>
          ) : null}
        </header>

        <ol className="mt-8 grid gap-2 sm:grid-cols-4" aria-label="Langkah pendaftaran">
          {steps.map((item, index) => {
            const state = index === step ? "current" : index < step ? "done" : "todo";
            return (
              <li
                key={item.title}
                aria-current={state === "current" ? "step" : undefined}
                className={`flex items-center gap-2 rounded-2xl border px-3.5 py-3 text-theme-xs font-bold ${
                  state === "current" ? "border-limo-blue-500 bg-limo-blue-50 text-limo-blue-700" : state === "done" ? "border-success-200 bg-success-50 text-success-700" : "border-gray-200 bg-white text-gray-500"
                }`}
              >
                <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold ${state === "current" ? "bg-limo-blue-600 text-white" : state === "done" ? "bg-success-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                  {state === "done" ? "✓" : index + 1}
                </span>
                {item.title}
              </li>
            );
          })}
        </ol>

        <form onSubmit={onSubmit} className="mt-6 space-y-6" noValidate={false}>
          {/* STEP 1 — Pilih program */}
          {step === 0 ? (
            <section className="tailadmin-card p-6 sm:p-8">
              <h2 className="text-lg font-extrabold tracking-tight text-gray-900">Pilih Program</h2>
              {errors.programKind ? <p className="mt-2 text-theme-xs font-semibold text-error-600">{errors.programKind}</p> : null}
              <div className="mt-5 space-y-5">
                {programs.length === 0 ? (
                  <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-5 text-theme-sm text-gray-500">Memuat program…</p>
                ) : (
                  groupedPrograms.map((group) => (
                    <div key={group.title}>
                      <p className="text-theme-xs font-bold uppercase tracking-widest text-gray-400">{group.title}</p>
                      <div role="radiogroup" aria-label={group.title} className="mt-2.5 grid gap-3 sm:grid-cols-2">
                        {group.items.map((program) => {
                          const meta = availabilityMeta(program.registrationAvailability);
                          const selected = program.kind === programKind;
                          return (
                            <button
                              key={program.id}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => {
                                setProgramKind(program.kind);
                                setAnswers({});
                                setErrors((current) => ({ ...current, programKind: "" }));
                              }}
                              className={`flex min-h-[76px] items-start gap-3 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limo-blue-500/50 ${selected ? "border-limo-blue-500 bg-limo-blue-50/70 ring-2 ring-limo-blue-500" : "border-gray-200 bg-white hover:border-limo-blue-300 hover:bg-limo-blue-50/40"}`}
                            >
                              <span aria-hidden="true" className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 text-[10px] transition ${selected ? "border-limo-blue-600 bg-limo-blue-600 text-white" : "border-gray-300 bg-white text-transparent"}`}>✓</span>
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
                        })}
                      </div>
                    </div>
                  ))
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
          ) : null}

          {/* STEP 2 — Data peserta */}
          {step === 1 ? (
            <section className="tailadmin-card p-6 sm:p-8">
              <h2 className="text-lg font-extrabold tracking-tight text-gray-900">Data Peserta</h2>
              <div className="mt-5">
                <p className="text-theme-sm font-semibold text-gray-700">
                  Pendaftaran untuk <RequiredNote required error={errors.type} />
                </p>
                <div role="radiogroup" aria-label="Pendaftaran untuk" className="mt-2 grid grid-cols-2 gap-2 sm:max-w-md">
                  {PARTICIPANT_TYPE_OPTIONS.map((option) => (
                    <button key={option.value} type="button" role="radio" aria-checked={participant.type === option.value} onClick={() => setParticipantField("type", option.value)} className={radioCardClass(participant.type === option.value)}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {participant.type ? (
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  {participant.type === "SELF" ? (
                    <>
                      <Field label="Nama Lengkap" required error={errors.studentName}>
                        <input type="text" value={participant.studentName} onChange={(event) => setParticipantField("studentName", event.target.value)} placeholder="Nama lengkap peserta" className={inputClass} />
                      </Field>
                      <Field label="Nama Panggilan" error={errors.studentNickname}>
                        <input type="text" value={participant.studentNickname} onChange={(event) => setParticipantField("studentNickname", event.target.value)} placeholder="Nama panggilan" className={inputClass} />
                      </Field>
                      <div>
                        <p className="text-theme-sm font-semibold text-gray-700">Jenis Kelamin <RequiredNote required error={errors.studentGender} /></p>
                        <div role="radiogroup" aria-label="Jenis kelamin" className="mt-2 grid grid-cols-2 gap-2">
                          {GENDER_OPTIONS.map((option) => (
                            <button key={option.value} type="button" role="radio" aria-checked={participant.studentGender === option.value} onClick={() => setParticipantField("studentGender", option.value)} className={radioCardClass(participant.studentGender === option.value)}>
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Field label="Tanggal Lahir" required error={errors.studentBirthDate}>
                        <input type="date" value={participant.studentBirthDate} onChange={(event) => setParticipantField("studentBirthDate", event.target.value)} className={inputClass} />
                      </Field>
                      <Field label="Nomor WhatsApp" required error={errors.waliPhone}>
                        <input type="tel" inputMode="tel" value={participant.waliPhone} onChange={(event) => setParticipantField("waliPhone", event.target.value)} placeholder="cth. 0812 3456 7890" className={inputClass} />
                      </Field>
                      <Field label="Email" hint="Kode pendaftaran dan informasi status dikirim ke email ini." error={errors.waliEmail}>
                        <input type="email" value={participant.waliEmail} onChange={(event) => setParticipantField("waliEmail", event.target.value)} placeholder="cth. nama@email.com" className={inputClass} />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Alamat" error={errors.address}>
                          <textarea value={participant.address} onChange={(event) => setParticipantField("address", event.target.value)} rows={3} placeholder="Alamat tempat tinggal" className={inputClass} />
                        </Field>
                      </div>
                    </>
                  ) : (
                    <>
                      <Field label="Nama Lengkap Anak" required error={errors.studentName}>
                        <input type="text" value={participant.studentName} onChange={(event) => setParticipantField("studentName", event.target.value)} placeholder="cth. Aisyah Putri" className={inputClass} />
                      </Field>
                      <Field label="Nama Panggilan Anak" error={errors.studentNickname}>
                        <input type="text" value={participant.studentNickname} onChange={(event) => setParticipantField("studentNickname", event.target.value)} placeholder="cth. Aisyah" className={inputClass} />
                      </Field>
                      <div>
                        <p className="text-theme-sm font-semibold text-gray-700">Jenis Kelamin Anak <RequiredNote required error={errors.studentGender} /></p>
                        <div role="radiogroup" aria-label="Jenis kelamin anak" className="mt-2 grid grid-cols-2 gap-2">
                          {GENDER_OPTIONS.map((option) => (
                            <button key={option.value} type="button" role="radio" aria-checked={participant.studentGender === option.value} onClick={() => setParticipantField("studentGender", option.value)} className={radioCardClass(participant.studentGender === option.value)}>
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Field label="Tanggal Lahir Anak" required error={errors.studentBirthDate}>
                        <input type="date" value={participant.studentBirthDate} onChange={(event) => setParticipantField("studentBirthDate", event.target.value)} className={inputClass} />
                      </Field>
                      <Field label="Nama Orang Tua / Wali" required error={errors.waliName}>
                        <input type="text" value={participant.waliName} onChange={(event) => setParticipantField("waliName", event.target.value)} placeholder="cth. Ahmad Fauzi" className={inputClass} />
                      </Field>
                      <Field label="Nomor WhatsApp Orang Tua / Wali" required error={errors.waliPhone}>
                        <input type="tel" inputMode="tel" value={participant.waliPhone} onChange={(event) => setParticipantField("waliPhone", event.target.value)} placeholder="cth. 0812 3456 7890" className={inputClass} />
                      </Field>
                      <Field label="Email Orang Tua / Wali" hint="Kode pendaftaran dan informasi status dikirim ke email ini bila diisi." error={errors.waliEmail}>
                        <input type="email" value={participant.waliEmail} onChange={(event) => setParticipantField("waliEmail", event.target.value)} placeholder="cth. ortu@email.com" className={inputClass} />
                      </Field>
                      <Field label="Sekolah Anak" error={errors.schoolName}>
                        <input type="text" value={participant.schoolName} onChange={(event) => setParticipantField("schoolName", event.target.value)} placeholder="cth. SD Negeri 1" className={inputClass} />
                      </Field>
                      <Field label="Kelas / Jenjang" error={errors.gradeLevel}>
                        <input type="text" value={participant.gradeLevel} onChange={(event) => setParticipantField("gradeLevel", event.target.value)} placeholder="cth. Kelas 4" className={inputClass} />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Alamat" error={errors.address}>
                          <textarea value={participant.address} onChange={(event) => setParticipantField("address", event.target.value)} rows={3} placeholder="Alamat tempat tinggal" className={inputClass} />
                        </Field>
                      </div>
                    </>
                  )}

                  <div className="sm:col-span-2">
                    <Field label="Foto Peserta" hint="JPG atau PNG · maksimal 10 MB. Membantu tim LIMO mengenal peserta sebelum kelas dimulai.">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                        onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
                        className="mt-2 block w-full cursor-pointer rounded-xl border border-gray-300 bg-white px-4 py-3 text-theme-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-limo-blue-50 file:px-3 file:py-1.5 file:text-theme-xs file:font-bold file:text-limo-blue-700"
                      />
                    </Field>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {/* STEP 3 — Formulir khusus program */}
          {step === 2 && programForm ? (
            <section className="tailadmin-card p-6 sm:p-8">
              <p className="text-theme-xs font-bold uppercase tracking-widest text-gray-400">Informasi Pembelajaran</p>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight text-gray-900">{programForm.heading}</h2>
              <p className="mt-1 text-theme-sm text-gray-500">Setelah data peserta selesai diisi, peserta akan diarahkan ke formulir sesuai program yang dipilih.</p>
              <div className="mt-6 grid gap-6">
                {programForm.fields.map((field) => renderProgramField(field))}
              </div>
            </section>
          ) : null}

          {/* STEP 4 — Persetujuan */}
          {step === 3 ? (
            <section className="tailadmin-card p-6 sm:p-8">
              <h2 className="text-lg font-extrabold tracking-tight text-gray-900">Persetujuan Pendaftaran</h2>
              <div className="mt-4 space-y-3">
                {([
                  { key: "dataTruth", label: "Saya menyatakan bahwa data yang saya berikan adalah benar dan dapat dipertanggungjawabkan." },
                  { key: "dataUse", label: "Saya menyetujui penggunaan data yang diberikan untuk keperluan administrasi, pembelajaran, penjadwalan, dan komunikasi LIMO." },
                  { key: "contact", label: "Saya menyetujui LIMO menghubungi saya melalui WhatsApp, telepon, atau email terkait program yang saya pilih." },
                ] as const).map((item) => (
                  <div key={item.key}>
                    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-theme-sm font-medium transition ${consents[item.key] ? "border-limo-blue-500 bg-limo-blue-50 text-limo-blue-800" : "border-gray-200 bg-white text-gray-700"}`}>
                      <input
                        type="checkbox"
                        checked={consents[item.key]}
                        onChange={(event) => {
                          setConsents((current) => ({ ...current, [item.key]: event.target.checked }));
                          setErrors((current) => ({ ...current, [item.key]: "" }));
                        }}
                        className="mt-0.5 size-4 rounded border-gray-300 text-limo-blue-600 focus:ring-limo-blue-500"
                      />
                      {item.label}
                    </label>
                    {errors[item.key] ? <p className="mt-1 text-theme-xs font-semibold text-error-600">{errors[item.key]}</p> : null}
                  </div>
                ))}
              </div>

              <div className="mt-7">
                <h3 className="font-bold text-gray-900">Persetujuan Dokumentasi</h3>
                <p className="mt-1 text-theme-sm text-gray-500">Pilih salah satu.</p>
                <div role="radiogroup" aria-label="Persetujuan dokumentasi" className="mt-3 space-y-2">
                  {DOCUMENTATION_CONSENT_OPTIONS.map((option) => (
                    <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-theme-sm font-medium transition ${consents.documentation === option.value ? "border-limo-blue-500 bg-limo-blue-50 text-limo-blue-800" : "border-gray-200 bg-white text-gray-700"}`}>
                      <input
                        type="radio"
                        name="documentationConsent"
                        checked={consents.documentation === option.value}
                        onChange={() => {
                          setConsents((current) => ({ ...current, documentation: option.value }));
                          setErrors((current) => ({ ...current, documentation: "" }));
                        }}
                        className="mt-0.5 size-4 border-gray-300 text-limo-blue-600 focus:ring-limo-blue-500"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                {errors.documentation ? <p className="mt-1 text-theme-xs font-semibold text-error-600">{errors.documentation}</p> : null}
              </div>

              <div className="mt-7 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-gray-900">Periksa Data Anda</h3>
                  <button type="button" onClick={() => { setStep(1); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-theme-xs font-bold text-limo-blue-700 hover:text-limo-blue-800">Ubah data</button>
                </div>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  {summaryRows.map((row) => (
                    <div key={row.label}>
                      <dt className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">{row.label}</dt>
                      <dd className="mt-0.5 text-theme-sm font-medium text-gray-800">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>
          ) : null}

          {error ? <p className="tailadmin-alert-error" role="alert">{error}</p> : null}

          <div className="tailadmin-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row">
              {step > 0 ? (
                <button type="button" onClick={goBack} className="tailadmin-button-outline px-5 py-3">{step === 3 ? "Kembali & Periksa Data" : "Kembali"}</button>
              ) : null}
              <Link href="/" className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3 text-theme-sm font-bold text-gray-700 hover:bg-gray-50 sm:hidden">Batal</Link>
            </div>
            {step < steps.length - 1 ? (
              <button type="button" onClick={goNext} disabled={step === 0 && selectablePrograms.length === 0} className="tailadmin-button-primary px-6 py-3">
                {step === 0 ? "Lanjutkan Pendaftaran" : "Lanjutkan"}
              </button>
            ) : (
              <button type="submit" disabled={isSubmitting} className="tailadmin-button-primary px-6 py-3">
                {isSubmitting ? "Mengirim…" : "Kirim Pendaftaran"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
