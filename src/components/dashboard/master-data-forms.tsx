"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { FormFieldError } from "@/components/dashboard/form-field-error";
import { validateWithSchema, hasFieldErrors, type FieldErrors } from "@/lib/client-validation";
import { requestJson } from "@/lib/api-json-client";
import { createKelasSchema, createLevelSchema, createProgramSchema } from "@/server/validation/master-data";

type Option = {
  id: string;
  name: string;
};

type GuruOption = {
  id: string;
  user: {
    name: string;
    email: string;
  };
};

async function postJson(path: string, body: Record<string, string | number>) {
  await requestJson(path, { method: "POST", body, fallbackMessage: "Data gagal disimpan" });
}

function SubmitButton({ isSubmitting, label }: { isSubmitting: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={isSubmitting}
      className="tailadmin-button-primary"
    >
      {isSubmitting ? "Menyimpan..." : label}
    </button>
  );
}

export function ProgramForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = {
      name: String(formData.get("name") || ""),
      kind: String(formData.get("kind") || ""),
      description: String(formData.get("description") || ""),
    };

    const errors = validateWithSchema(createProgramSchema, body);
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) {
      setError("Periksa kembali data program.");
      return;
    }

    setIsSubmitting(true);
    try {
      await postJson("/api/v1/admin/program", body);
      form.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Program gagal disimpan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="tailadmin-card grid gap-3 p-5">
      <h2 className="font-semibold text-gray-900">Tambah Program</h2>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      <input id="program-name" name="name" required aria-invalid={Boolean(fieldErrors.name)} aria-describedby="program-name-error" aria-label="Nama program" placeholder="Nama program" className="tailadmin-input" />
      <FormFieldError id="program-name-error" errors={fieldErrors.name} />
      <select name="kind" required aria-invalid={Boolean(fieldErrors.kind)} aria-describedby="program-kind-error" aria-label="Jenis program" className="tailadmin-input">
        <option value="ENGLISH">Bahasa Inggris</option>
        <option value="ARABIC_KIDS">Arabic for Kids</option>
        <option value="NAHWU">Nahwu</option>
        <option value="MATH_ACADEMIC_SUPPORT">Math & Academic Support for Akhwat</option>
      </select>
      <FormFieldError id="program-kind-error" errors={fieldErrors.kind} />
      <textarea name="description" aria-invalid={Boolean(fieldErrors.description)} aria-describedby="program-description-error" aria-label="Deskripsi program" placeholder="Deskripsi" className="tailadmin-input" />
      <FormFieldError id="program-description-error" errors={fieldErrors.description} />
      <SubmitButton isSubmitting={isSubmitting} label="Simpan Program" />
    </form>
  );
}

export function LevelForm({ programs }: { programs: Option[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = {
      programId: String(formData.get("programId") || ""),
      name: String(formData.get("name") || ""),
      order: Number(formData.get("order") || 0),
      description: String(formData.get("description") || ""),
    };

    const errors = validateWithSchema(createLevelSchema, body);
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) {
      setError("Periksa kembali data level.");
      return;
    }

    setIsSubmitting(true);
    try {
      await postJson("/api/v1/admin/level", body);
      form.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Level gagal disimpan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="tailadmin-card grid gap-3 p-5">
      <h2 className="font-semibold text-gray-900">Tambah Level</h2>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      <select name="programId" required aria-invalid={Boolean(fieldErrors.programId)} aria-describedby="level-program-error" aria-label="Program level" className="tailadmin-input">
        <option value="">Pilih program</option>
        {programs.map((program) => (
          <option key={program.id} value={program.id}>{program.name}</option>
        ))}
      </select>
      <FormFieldError id="level-program-error" errors={fieldErrors.programId} />
      <input name="name" required aria-invalid={Boolean(fieldErrors.name)} aria-describedby="level-name-error" aria-label="Nama level" placeholder="Nama level" className="tailadmin-input" />
      <FormFieldError id="level-name-error" errors={fieldErrors.name} />
      <input name="order" type="number" min={0} defaultValue={0} aria-invalid={Boolean(fieldErrors.order)} aria-describedby="level-order-error" aria-label="Urutan level" className="tailadmin-input" />
      <FormFieldError id="level-order-error" errors={fieldErrors.order} />
      <textarea name="description" aria-invalid={Boolean(fieldErrors.description)} aria-describedby="level-description-error" aria-label="Deskripsi level" placeholder="Deskripsi" className="tailadmin-input" />
      <FormFieldError id="level-description-error" errors={fieldErrors.description} />
      <SubmitButton isSubmitting={isSubmitting} label="Simpan Level" />
    </form>
  );
}

export function KelasForm({ programs, levels, gurus }: { programs: Option[]; levels: (Option & { programId: string })[]; gurus: GuruOption[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = {
      programId: String(formData.get("programId") || ""),
      levelId: String(formData.get("levelId") || ""),
      guruProfileId: String(formData.get("guruProfileId") || ""),
      name: String(formData.get("name") || ""),
      scheduleNote: String(formData.get("scheduleNote") || ""),
    };

    const errors = validateWithSchema(createKelasSchema, body);
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) {
      setError("Periksa kembali data kelas.");
      return;
    }

    setIsSubmitting(true);
    try {
      await postJson("/api/v1/admin/kelas", body);
      form.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kelas gagal disimpan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="tailadmin-card grid gap-3 p-5">
      <h2 className="font-semibold text-gray-900">Tambah Kelas</h2>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      <select name="programId" required aria-invalid={Boolean(fieldErrors.programId)} aria-describedby="kelas-program-error" aria-label="Program kelas" className="tailadmin-input">
        <option value="">Pilih program</option>
        {programs.map((program) => (
          <option key={program.id} value={program.id}>{program.name}</option>
        ))}
      </select>
      <FormFieldError id="kelas-program-error" errors={fieldErrors.programId} />
      <select name="levelId" required aria-invalid={Boolean(fieldErrors.levelId)} aria-describedby="kelas-level-error" aria-label="Level kelas" className="tailadmin-input">
        <option value="">Pilih level</option>
        {levels.map((level) => (
          <option key={level.id} value={level.id}>{level.name}</option>
        ))}
      </select>
      <FormFieldError id="kelas-level-error" errors={fieldErrors.levelId} />
      <select name="guruProfileId" aria-invalid={Boolean(fieldErrors.guruProfileId)} aria-describedby="kelas-guru-error" aria-label="Guru pengampu kelas" className="tailadmin-input">
        <option value="">Tanpa guru dulu</option>
        {gurus.map((guru) => (
          <option key={guru.id} value={guru.id}>{guru.user.name} - {guru.user.email}</option>
        ))}
      </select>
      <FormFieldError id="kelas-guru-error" errors={fieldErrors.guruProfileId} />
      <input name="name" required aria-invalid={Boolean(fieldErrors.name)} aria-describedby="kelas-name-error" aria-label="Nama kelas" placeholder="Nama kelas" className="tailadmin-input" />
      <FormFieldError id="kelas-name-error" errors={fieldErrors.name} />
      <input name="scheduleNote" aria-invalid={Boolean(fieldErrors.scheduleNote)} aria-describedby="kelas-schedule-error" aria-label="Catatan jadwal kelas" placeholder="Catatan jadwal" className="tailadmin-input" />
      <FormFieldError id="kelas-schedule-error" errors={fieldErrors.scheduleNote} />
      <SubmitButton isSubmitting={isSubmitting} label="Simpan Kelas" />
    </form>
  );
}
