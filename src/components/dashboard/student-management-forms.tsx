"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Option = { id: string; name: string };
type WaliOption = { id: string; user: { name: string; email: string } };

async function mutate(path: string, method: string, body?: Record<string, unknown>) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || "Data gagal diproses");
}

function useMutation() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function run(action: () => Promise<void>) {
    setError("");
    setIsSubmitting(true);
    try {
      await action();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Data gagal diproses");
    } finally {
      setIsSubmitting(false);
    }
  }

  return { error, isSubmitting, run };
}

export function UpdateStudentForm({
  student,
  programs,
}: {
  student: { id: string; name: string; birthDate: string; programId: string; status: string };
  programs: Option[];
}) {
  const mutation = useMutation();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void mutation.run(() => mutate(`/api/v1/admin/siswa/${student.id}`, "PATCH", {
      name: String(data.get("name") || ""),
      birthDate: String(data.get("birthDate") || ""),
      programId: String(data.get("programId") || ""),
      status: String(data.get("status") || "ACTIVE"),
    }));
  }

  return (
    <form onSubmit={onSubmit} className="tailadmin-card grid gap-3 p-5">
      <h2 className="font-semibold text-gray-900">Data Siswa</h2>
      {mutation.error ? <p className="tailadmin-alert-error">{mutation.error}</p> : null}
      <input name="name" required defaultValue={student.name} className="tailadmin-input" />
      <input name="birthDate" type="date" defaultValue={student.birthDate} className="tailadmin-input" />
      <select name="programId" required defaultValue={student.programId} className="tailadmin-input">
        {programs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <select name="status" defaultValue={student.status} className="tailadmin-input">
        <option value="ACTIVE">Aktif</option>
        <option value="INACTIVE">Tidak Aktif</option>
        <option value="GRADUATED">Lulus</option>
        <option value="ARCHIVED">Arsip</option>
      </select>
      <button disabled={mutation.isSubmitting} className="tailadmin-button-primary">{mutation.isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}</button>
    </form>
  );
}

export function StudentRelationForm({ studentId, walis }: { studentId: string; walis: WaliOption[] }) {
  const mutation = useMutation();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void mutation.run(async () => {
      await mutate(`/api/v1/admin/siswa/${studentId}/wali`, "POST", {
        waliProfileId: String(data.get("waliProfileId") || ""),
        relationship: String(data.get("relationship") || "Wali"),
        isPrimary: data.get("isPrimary") === "on",
      });
      form.reset();
    });
  }

  return (
    <form onSubmit={onSubmit} className="tailadmin-card grid gap-3 p-5">
      <h2 className="font-semibold text-gray-900">Hubungkan Wali</h2>
      {mutation.error ? <p className="tailadmin-alert-error">{mutation.error}</p> : null}
      <select name="waliProfileId" required className="tailadmin-input">
        <option value="">Pilih wali</option>
        {walis.map((item) => <option key={item.id} value={item.id}>{item.user.name} - {item.user.email}</option>)}
      </select>
      <input name="relationship" defaultValue="Orang tua" className="tailadmin-input" />
      <label className="text-theme-sm text-gray-700"><input name="isPrimary" type="checkbox" className="mr-2 accent-brand-500" />Wali utama</label>
      <button disabled={mutation.isSubmitting} className="tailadmin-button-primary">Hubungkan Wali</button>
    </form>
  );
}

export function TransferStudentForm({ studentId, kelas }: { studentId: string; kelas: Option[] }) {
  const mutation = useMutation();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void mutation.run(() => mutate(`/api/v1/admin/siswa/${studentId}/transfer`, "POST", {
      kelasId: String(data.get("kelasId") || ""),
      startDate: String(data.get("startDate") || ""),
    }));
  }

  return (
    <form onSubmit={onSubmit} className="tailadmin-card grid gap-3 p-5">
      <h2 className="font-semibold text-gray-900">Mutasi Kelas</h2>
      {mutation.error ? <p className="tailadmin-alert-error">{mutation.error}</p> : null}
      <select name="kelasId" required className="tailadmin-input">
        <option value="">Pilih kelas tujuan</option>
        {kelas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <input name="startDate" type="date" required className="tailadmin-input" />
      <button disabled={mutation.isSubmitting} className="tailadmin-button-primary">Pindahkan Kelas</button>
    </form>
  );
}

export function StudentRecordActions({ studentId, archived }: { studentId: string; archived: boolean }) {
  const mutation = useMutation();
  const action = archived
    ? () => mutate(`/api/v1/admin/siswa/${studentId}/restore`, "POST")
    : () => mutate(`/api/v1/admin/siswa/${studentId}`, "DELETE");

  return (
    <div>
      {mutation.error ? <p className="mb-2 tailadmin-alert-error">{mutation.error}</p> : null}
      <button
        type="button"
        disabled={mutation.isSubmitting}
        onClick={() => void mutation.run(action)}
        className={archived ? "tailadmin-button-primary" : "inline-flex rounded-lg bg-error-500 px-4 py-2.5 text-theme-sm font-medium text-white hover:bg-error-700 disabled:opacity-50"}
      >
        {archived ? "Pulihkan Siswa" : "Arsipkan Siswa"}
      </button>
    </div>
  );
}

export function RemoveWaliButton({ studentId, waliProfileId }: { studentId: string; waliProfileId: string }) {
  const mutation = useMutation();
  return (
    <button
      type="button"
      disabled={mutation.isSubmitting}
      onClick={() => void mutation.run(() => mutate(`/api/v1/admin/siswa/${studentId}/wali/${waliProfileId}`, "DELETE"))}
      className="text-theme-xs font-semibold text-error-700 hover:underline disabled:opacity-50"
    >
      Lepas
    </button>
  );
}
