"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type KelasOption = { id: string; name: string };
type SoalOption = { id: string; label: string };

export function UjianForm({ kelasOptions, soalOptions }: { kelasOptions: KelasOption[]; soalOptions: SoalOption[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);
    const selectedQuestionIds = data.getAll("bankSoalId").map(String);
    const questions = selectedQuestionIds.map((id) => ({
      bankSoalId: id,
      weight: Number(data.get(`weight-${id}`) || 1),
    }));

    try {
      const response = await fetch("/api/v1/ujian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kelasId: String(data.get("kelasId") || ""),
          title: String(data.get("title") || ""),
          description: String(data.get("description") || ""),
          status: String(data.get("status") || "DRAFT"),
          examDate: String(data.get("examDate") || ""),
          questions,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(payload.error?.message || "Ujian gagal disimpan");
      }

      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ujian gagal disimpan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="tailadmin-card grid gap-3 p-5">
      <h2 className="font-semibold text-gray-900">Buat Ujian</h2>
      {error ? <p className="tailadmin-alert-error">{error}</p> : null}
      <select name="kelasId" required className="tailadmin-input">
        <option value="">Pilih kelas</option>
        {kelasOptions.map((kelas) => <option key={kelas.id} value={kelas.id}>{kelas.name}</option>)}
      </select>
      <input name="title" required placeholder="Judul ujian" className="tailadmin-input" />
      <textarea name="description" placeholder="Deskripsi" className="tailadmin-input" />
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="examDate" type="date" className="tailadmin-input" />
        <select name="status" className="tailadmin-input">
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Publish</option>
        </select>
      </div>
      <div className="rounded-xl border border-gray-200 p-4">
        <p className="text-theme-sm font-semibold text-gray-700">Pilih Soal</p>
        <div className="mt-3 grid gap-3">
          {soalOptions.map((soal) => (
            <label key={soal.id} className="grid gap-2 rounded-lg bg-gray-50 p-3 text-theme-sm text-gray-700 sm:grid-cols-[1fr_100px]">
              <span><input name="bankSoalId" type="checkbox" value={soal.id} className="mr-2 accent-brand-500" />{soal.label}</span>
              <input name={`weight-${soal.id}`} type="number" min={0.1} step={0.1} defaultValue={1} className="tailadmin-input px-2 py-1" />
            </label>
          ))}
        </div>
      </div>
      <button disabled={isSubmitting} className="tailadmin-button-primary">
        {isSubmitting ? "Menyimpan..." : "Simpan Ujian"}
      </button>
    </form>
  );
}
