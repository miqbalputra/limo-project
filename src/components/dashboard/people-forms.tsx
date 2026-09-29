"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { ZodType } from "zod";
import { PasswordField } from "@/components/dashboard/password-field";
import { FormFieldError } from "@/components/dashboard/form-field-error";
import { validateWithSchema, hasFieldErrors, type FieldErrors } from "@/lib/client-validation";
import { requestJson } from "@/lib/api-json-client";
import { createGuruSchema, createSiswaSchema, createWaliSchema, updateGuruSchema, updateWaliSchema } from "@/server/validation/master-data";

type Option = { id: string; name: string };
type WaliOption = { id: string; user: { name: string; email: string } };

async function postJson(path: string, body: Record<string, string>, method: "POST" | "PATCH" = "POST") {
  await requestJson(path, { method, body, fallbackMessage: "Data gagal disimpan" });
}

function useSubmit<T>(path: string, { method = "POST", resetOnSuccess = true, schema }: { method?: "POST" | "PATCH"; resetOnSuccess?: boolean; schema?: ZodType<T> } = {}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>, pick: (_formData: FormData) => Record<string, string>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");

    const body = pick(new FormData(form));
    if (schema) {
      const errors = validateWithSchema(schema, body);
      setFieldErrors(errors);
      if (hasFieldErrors(errors)) {
        setError("Periksa kembali data yang diisi.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await postJson(path, body, method);
      if (resetOnSuccess) form.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Data gagal disimpan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return { error, fieldErrors, isSubmitting, submit };
}

function Field({ name, placeholder, type = "text", required = false, errors }: { name: string; placeholder: string; type?: string; required?: boolean; errors?: string[] }) {
  return <label className="grid gap-1"><span className="sr-only">{placeholder}</span><input id={`admin-${name}`} name={name} type={type} required={required} placeholder={placeholder} aria-label={placeholder} aria-invalid={Boolean(errors?.length)} aria-describedby={`admin-${name}-error`} className="tailadmin-input" /><FormFieldError id={`admin-${name}-error`} errors={errors} /></label>;
}

function Submit({ disabled, children }: { disabled: boolean; children: string }) {
  return <button type="submit" disabled={disabled} className="tailadmin-button-primary">{disabled ? "Menyimpan..." : children}</button>;
}

export function GuruForm() {
  const { error, fieldErrors, isSubmitting, submit } = useSubmit("/api/v1/admin/guru", { schema: createGuruSchema });

  return (
    <form onSubmit={(event) => submit(event, (data) => ({ name: String(data.get("name") || ""), email: String(data.get("email") || ""), phone: String(data.get("phone") || ""), address: String(data.get("address") || ""), password: String(data.get("password") || "") }))} className="tailadmin-card grid gap-3 p-5">
      <h2 className="font-semibold text-gray-900">Tambah Guru</h2>
      <p className="text-theme-xs text-gray-500">Isi password untuk langsung mengaktifkan akun tanpa tautan aktivasi; kosongkan bila akun cukup menerima tautan aktivasi.</p>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      <Field name="name" placeholder="Nama guru" required errors={fieldErrors.name} />
      <Field name="email" placeholder="Email" type="email" required errors={fieldErrors.email} />
      <Field name="phone" placeholder="Nomor HP" errors={fieldErrors.phone} />
      <textarea name="address" aria-label="Alamat guru" aria-invalid={Boolean(fieldErrors.address)} aria-describedby="admin-address-error" placeholder="Alamat" className="tailadmin-input" />
      <FormFieldError id="admin-address-error" errors={fieldErrors.address} />
      <PasswordField name="password" label="Password awal guru" hint="Minimal 8 karakter. Password tidak ditampilkan lagi setelah akun disimpan." />
      <Submit disabled={isSubmitting}>Simpan Guru</Submit>
    </form>
  );
}

export function WaliForm() {
  const { error, fieldErrors, isSubmitting, submit } = useSubmit("/api/v1/admin/wali", { schema: createWaliSchema });

  return (
    <form onSubmit={(event) => submit(event, (data) => ({ name: String(data.get("name") || ""), email: String(data.get("email") || ""), phone: String(data.get("phone") || ""), address: String(data.get("address") || ""), password: String(data.get("password") || "") }))} className="tailadmin-card grid gap-3 p-5">
      <h2 className="font-semibold text-gray-900">Tambah Wali</h2>
      <p className="text-theme-xs text-gray-500">Isi password untuk langsung mengaktifkan akun tanpa tautan aktivasi; kosongkan bila akun cukup menerima tautan aktivasi.</p>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      <Field name="name" placeholder="Nama wali" required errors={fieldErrors.name} />
      <Field name="email" placeholder="Email" type="email" required errors={fieldErrors.email} />
      <Field name="phone" placeholder="Nomor HP" errors={fieldErrors.phone} />
      <textarea name="address" aria-label="Alamat wali" aria-invalid={Boolean(fieldErrors.address)} aria-describedby="admin-address-error" placeholder="Alamat" className="tailadmin-input" />
      <FormFieldError id="admin-address-error" errors={fieldErrors.address} />
      <PasswordField name="password" label="Password awal wali" hint="Minimal 8 karakter. Password tidak ditampilkan lagi setelah akun disimpan." />
      <Submit disabled={isSubmitting}>Simpan Wali</Submit>
    </form>
  );
}

export function PersonProfileForm({ type, profile }: { type: "guru" | "wali"; profile: { id: string; name: string; email: string; phone: string | null; address: string | null } }) {
  const label = type === "guru" ? "Guru" : "Wali";
  const { error, fieldErrors, isSubmitting, submit } = useSubmit(`/api/v1/admin/${type}/${profile.id}`, { method: "PATCH", resetOnSuccess: false, schema: type === "guru" ? updateGuruSchema : updateWaliSchema });

  return (
    <form onSubmit={(event) => submit(event, (data) => ({ name: String(data.get("name") || ""), email: String(data.get("email") || ""), phone: String(data.get("phone") || ""), address: String(data.get("address") || "") }))} className="tailadmin-card grid gap-4 p-5 sm:p-6">
      <div><p className="text-theme-xs font-semibold uppercase tracking-[0.16em] text-limo-blue-700">Profil {label}</p><h2 className="mt-1 font-semibold text-gray-900">Data kontak dan akun</h2><p className="mt-1 text-theme-sm text-gray-500">Perubahan identitas dan kontak dicatat pada log audit.</p></div>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1"><span className="text-theme-xs font-medium text-gray-600">Nama {label.toLowerCase()}</span><input name="name" required defaultValue={profile.name} aria-label={`Nama ${label.toLowerCase()}`} aria-invalid={Boolean(fieldErrors.name)} aria-describedby="profile-name-error" className="tailadmin-input" /><FormFieldError id="profile-name-error" errors={fieldErrors.name} /></label>
        <label className="grid gap-1"><span className="text-theme-xs font-medium text-gray-600">Email</span><input name="email" type="email" required defaultValue={profile.email} aria-label="Email" aria-invalid={Boolean(fieldErrors.email)} aria-describedby="profile-email-error" className="tailadmin-input" /><FormFieldError id="profile-email-error" errors={fieldErrors.email} /></label>
      </div>
      <label className="grid gap-1"><span className="text-theme-xs font-medium text-gray-600">Nomor HP</span><input name="phone" defaultValue={profile.phone || ""} aria-label="Nomor HP" aria-invalid={Boolean(fieldErrors.phone)} aria-describedby="profile-phone-error" className="tailadmin-input" /><FormFieldError id="profile-phone-error" errors={fieldErrors.phone} /></label>
      <label className="grid gap-1"><span className="text-theme-xs font-medium text-gray-600">Alamat</span><textarea name="address" defaultValue={profile.address || ""} aria-label="Alamat" aria-invalid={Boolean(fieldErrors.address)} aria-describedby="profile-address-error" className="tailadmin-input min-h-28" /><FormFieldError id="profile-address-error" errors={fieldErrors.address} /></label>
      <Submit disabled={isSubmitting}>Simpan Perubahan</Submit>
    </form>
  );
}

export function SiswaForm({ programs, kelas, walis }: { programs: Option[]; kelas: (Option & { programId: string })[]; walis: WaliOption[] }) {
  const { error, fieldErrors, isSubmitting, submit } = useSubmit("/api/v1/admin/siswa", { schema: createSiswaSchema });

  return (
    <form onSubmit={(event) => submit(event, (data) => ({ nomorInduk: String(data.get("nomorInduk") || ""), name: String(data.get("name") || ""), birthDate: String(data.get("birthDate") || ""), programId: String(data.get("programId") || ""), waliProfileId: String(data.get("waliProfileId") || ""), kelasId: String(data.get("kelasId") || ""), startDate: String(data.get("startDate") || "") }))} className="tailadmin-card grid gap-3 p-5">
      <h2 className="font-semibold text-gray-900">Tambah Siswa</h2>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      <Field name="nomorInduk" placeholder="Nomor induk" required errors={fieldErrors.nomorInduk} />
      <Field name="name" placeholder="Nama siswa" required errors={fieldErrors.name} />
      <Field name="birthDate" placeholder="Tanggal lahir" type="date" errors={fieldErrors.birthDate} />
      <select name="programId" required aria-label="Program siswa" aria-invalid={Boolean(fieldErrors.programId)} aria-describedby="siswa-program-error" className="tailadmin-input">
        <option value="">Pilih program</option>
        {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
      </select>
      <FormFieldError id="siswa-program-error" errors={fieldErrors.programId} />
      <select name="waliProfileId" aria-label="Wali siswa" className="tailadmin-input">
        <option value="">Tanpa wali dulu</option>
        {walis.map((wali) => <option key={wali.id} value={wali.id}>{wali.user.name} - {wali.user.email}</option>)}
      </select>
      <select name="kelasId" aria-label="Kelas siswa" className="tailadmin-input">
        <option value="">Tanpa kelas dulu</option>
        {kelas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <Field name="startDate" placeholder="Tanggal masuk kelas" type="date" errors={fieldErrors.startDate} />
      <Submit disabled={isSubmitting}>Simpan Siswa</Submit>
    </form>
  );
}
