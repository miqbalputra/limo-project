"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);

    try {
      await postJson("/api/v1/admin/program", {
        name: String(formData.get("name") || ""),
        kind: String(formData.get("kind") || ""),
        description: String(formData.get("description") || ""),
      });
      event.currentTarget.reset();
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
      <input id="program-name" name="name" required aria-label="Nama program" placeholder="Nama program" className="tailadmin-input" />
      <select name="kind" required aria-label="Jenis program" className="tailadmin-input">
        <option value="ENGLISH">Bahasa Inggris</option>
        <option value="ARABIC">Bahasa Arab</option>
      </select>
      <textarea name="description" aria-label="Deskripsi program" placeholder="Deskripsi" className="tailadmin-input" />
      <SubmitButton isSubmitting={isSubmitting} label="Simpan Program" />
    </form>
  );
}

export function LevelForm({ programs }: { programs: Option[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);

    try {
      await postJson("/api/v1/admin/level", {
        programId: String(formData.get("programId") || ""),
        name: String(formData.get("name") || ""),
        order: Number(formData.get("order") || 0),
        description: String(formData.get("description") || ""),
      });
      event.currentTarget.reset();
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
      <select name="programId" required aria-label="Program level" className="tailadmin-input">
        <option value="">Pilih program</option>
        {programs.map((program) => (
          <option key={program.id} value={program.id}>{program.name}</option>
        ))}
      </select>
      <input name="name" required aria-label="Nama level" placeholder="Nama level" className="tailadmin-input" />
      <input name="order" type="number" min={0} defaultValue={0} aria-label="Urutan level" className="tailadmin-input" />
      <textarea name="description" aria-label="Deskripsi level" placeholder="Deskripsi" className="tailadmin-input" />
      <SubmitButton isSubmitting={isSubmitting} label="Simpan Level" />
    </form>
  );
}

export function KelasForm({ programs, levels, gurus }: { programs: Option[]; levels: (Option & { programId: string })[]; gurus: GuruOption[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);

    try {
      await postJson("/api/v1/admin/kelas", {
        programId: String(formData.get("programId") || ""),
        levelId: String(formData.get("levelId") || ""),
        guruProfileId: String(formData.get("guruProfileId") || ""),
        name: String(formData.get("name") || ""),
        scheduleNote: String(formData.get("scheduleNote") || ""),
      });
      event.currentTarget.reset();
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
      <select name="programId" required aria-label="Program kelas" className="tailadmin-input">
        <option value="">Pilih program</option>
        {programs.map((program) => (
          <option key={program.id} value={program.id}>{program.name}</option>
        ))}
      </select>
      <select name="levelId" required aria-label="Level kelas" className="tailadmin-input">
        <option value="">Pilih level</option>
        {levels.map((level) => (
          <option key={level.id} value={level.id}>{level.name}</option>
        ))}
      </select>
      <select name="guruProfileId" aria-label="Guru pengampu kelas" className="tailadmin-input">
        <option value="">Tanpa guru dulu</option>
        {gurus.map((guru) => (
          <option key={guru.id} value={guru.id}>{guru.user.name} - {guru.user.email}</option>
        ))}
      </select>
      <input name="name" required aria-label="Nama kelas" placeholder="Nama kelas" className="tailadmin-input" />
      <input name="scheduleNote" aria-label="Catatan jadwal kelas" placeholder="Catatan jadwal" className="tailadmin-input" />
      <SubmitButton isSubmitting={isSubmitting} label="Simpan Kelas" />
    </form>
  );
}
