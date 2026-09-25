"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/api-json-client";

type KelasOption = { id: string; name: string };
type SiswaOption = { id: string; name: string; nomorInduk: string };

export function SertifikatIssueForm({ kelasOptions }: { kelasOptions: KelasOption[] }) {
  const router = useRouter();
  const [kelasId, setKelasId] = useState("");
  const [siswaId, setSiswaId] = useState("");
  const [students, setStudents] = useState<SiswaOption[]>([]);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  async function onKelasChange(value: string) {
    setKelasId(value);
    setSiswaId("");
    setStudents([]);
    setError("");
    if (!value) return;

    setLoadingStudents(true);
    try {
      const result = await requestJson<{ items: SiswaOption[] }>(`/api/v1/admin/siswa?kelasId=${encodeURIComponent(value)}&pageSize=100`, { fallbackMessage: "Gagal memuat siswa" });
      setStudents(result.data.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memuat siswa");
    } finally {
      setLoadingStudents(false);
    }
  }

  async function submit() {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result = await requestJson<{ item: { code: string } }>("/api/v1/sertifikat", {
        method: "POST",
        body: { siswaId, kelasId, title, note },
        fallbackMessage: "Sertifikat gagal diterbitkan",
      });
      setNotice(`Sertifikat diterbitkan dengan kode ${result.data.item.code}.`);
      setTitle("");
      setNote("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sertifikat gagal diterbitkan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tailadmin-card grid gap-3 p-5">
      <h2 className="font-semibold text-gray-900">Terbitkan sertifikat</h2>
      <p className="text-theme-xs text-gray-500">Pilih kelas lalu siswa yang terdaftar pada kelas tersebut.</p>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      {notice ? <p role="status" className="tailadmin-alert-success">{notice}</p> : null}

      <label className="grid gap-1 text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Kelas
        <select value={kelasId} onChange={(event) => void onKelasChange(event.target.value)} aria-label="Pilih kelas" className="mt-1 tailadmin-input">
          <option value="">Pilih kelas</option>
          {kelasOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </label>

      <label className="grid gap-1 text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Siswa
        <select value={siswaId} onChange={(event) => setSiswaId(event.target.value)} aria-label="Pilih siswa" disabled={!kelasId || loadingStudents} className="mt-1 tailadmin-input disabled:opacity-60">
          <option value="">{loadingStudents ? "Memuat siswa..." : "Pilih siswa"}</option>
          {students.map((student) => <option key={student.id} value={student.id}>{student.name} - {student.nomorInduk}</option>)}
        </select>
      </label>

      <label className="grid gap-1 text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Judul sertifikat (opsional)
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Otomatis dari program dan kelas" aria-label="Judul sertifikat" dir="auto" className="mt-1 tailadmin-input" />
      </label>

      <label className="grid gap-1 text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Catatan (opsional)
        <textarea value={note} onChange={(event) => setNote(event.target.value)} aria-label="Catatan sertifikat" dir="auto" className="mt-1 tailadmin-input" />
      </label>

      <button type="button" onClick={() => void submit()} disabled={busy || !siswaId || !kelasId} className="tailadmin-button-primary w-fit px-5 py-2.5">{busy ? "Menerbitkan..." : "Terbitkan sertifikat"}</button>
    </section>
  );
}
