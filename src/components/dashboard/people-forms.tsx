"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Option = { id: string; name: string };
type WaliOption = { id: string; user: { name: string; email: string } };

async function postJson(path: string, body: Record<string, string>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(payload.error?.message || "Data gagal disimpan");
  }
}

function useSubmit(path: string) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>, pick: (_formData: FormData) => Record<string, string>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await postJson(path, pick(new FormData(event.currentTarget)));
      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Data gagal disimpan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return { error, isSubmitting, submit };
}

function Field({ name, placeholder, type = "text", required = false }: { name: string; placeholder: string; type?: string; required?: boolean }) {
  return <label className="grid gap-1"><span className="sr-only">{placeholder}</span><input id={`admin-${name}`} name={name} type={type} required={required} placeholder={placeholder} aria-label={placeholder} className="tailadmin-input" /></label>;
}

function Submit({ disabled, children }: { disabled: boolean; children: string }) {
  return <button type="submit" disabled={disabled} className="tailadmin-button-primary">{disabled ? "Menyimpan..." : children}</button>;
}

export function GuruForm() {
  const { error, isSubmitting, submit } = useSubmit("/api/v1/admin/guru");

  return (
    <form onSubmit={(event) => submit(event, (data) => ({ name: String(data.get("name") || ""), email: String(data.get("email") || ""), phone: String(data.get("phone") || ""), address: String(data.get("address") || "") }))} className="tailadmin-card grid gap-3 p-5">
      <h2 className="font-semibold text-gray-900">Tambah Guru</h2>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      <Field name="name" placeholder="Nama guru" required />
      <Field name="email" placeholder="Email" type="email" required />
      <Field name="phone" placeholder="Nomor HP" />
      <textarea name="address" aria-label="Alamat guru" placeholder="Alamat" className="tailadmin-input" />
      <Submit disabled={isSubmitting}>Simpan Guru</Submit>
    </form>
  );
}

export function WaliForm() {
  const { error, isSubmitting, submit } = useSubmit("/api/v1/admin/wali");

  return (
    <form onSubmit={(event) => submit(event, (data) => ({ name: String(data.get("name") || ""), email: String(data.get("email") || ""), phone: String(data.get("phone") || ""), address: String(data.get("address") || "") }))} className="tailadmin-card grid gap-3 p-5">
      <h2 className="font-semibold text-gray-900">Tambah Wali</h2>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      <Field name="name" placeholder="Nama wali" required />
      <Field name="email" placeholder="Email" type="email" required />
      <Field name="phone" placeholder="Nomor HP" />
      <textarea name="address" aria-label="Alamat wali" placeholder="Alamat" className="tailadmin-input" />
      <Submit disabled={isSubmitting}>Simpan Wali</Submit>
    </form>
  );
}

export function SiswaForm({ programs, kelas, walis }: { programs: Option[]; kelas: (Option & { programId: string })[]; walis: WaliOption[] }) {
  const { error, isSubmitting, submit } = useSubmit("/api/v1/admin/siswa");

  return (
    <form onSubmit={(event) => submit(event, (data) => ({ nomorInduk: String(data.get("nomorInduk") || ""), name: String(data.get("name") || ""), birthDate: String(data.get("birthDate") || ""), programId: String(data.get("programId") || ""), waliProfileId: String(data.get("waliProfileId") || ""), kelasId: String(data.get("kelasId") || ""), startDate: String(data.get("startDate") || "") }))} className="tailadmin-card grid gap-3 p-5">
      <h2 className="font-semibold text-gray-900">Tambah Siswa</h2>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      <Field name="nomorInduk" placeholder="Nomor induk" required />
      <Field name="name" placeholder="Nama siswa" required />
      <Field name="birthDate" placeholder="Tanggal lahir" type="date" />
      <select name="programId" required aria-label="Program siswa" className="tailadmin-input">
        <option value="">Pilih program</option>
        {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
      </select>
      <select name="waliProfileId" aria-label="Wali siswa" className="tailadmin-input">
        <option value="">Tanpa wali dulu</option>
        {walis.map((wali) => <option key={wali.id} value={wali.id}>{wali.user.name} - {wali.user.email}</option>)}
      </select>
      <select name="kelasId" aria-label="Kelas siswa" className="tailadmin-input">
        <option value="">Tanpa kelas dulu</option>
        {kelas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <Field name="startDate" placeholder="Tanggal masuk kelas" type="date" />
      <Submit disabled={isSubmitting}>Simpan Siswa</Submit>
    </form>
  );
}
