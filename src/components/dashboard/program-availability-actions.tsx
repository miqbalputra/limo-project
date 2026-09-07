"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/api-json-client";

const OPTIONS = [
  { value: "OPEN", label: "OPEN", dot: "bg-success-500" },
  { value: "LIMITED_SLOTS", label: "LIMITED SLOTS", dot: "bg-warning-500" },
  { value: "FULL", label: "FULL / WAITING LIST", dot: "bg-error-500" },
  { value: "COMING_SOON", label: "COMING SOON", dot: "bg-gray-400" },
];

export function ProgramAvailabilityActions({ id, current, note }: { id: string; current: string; note: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [draftNote, setDraftNote] = useState(note);

  async function change(value: string) {
    setPending(true);
    setError("");
    try {
      await requestJson(`/api/v1/admin/program/${id}`, { method: "PATCH", body: { registrationAvailability: value }, fallbackMessage: "Gagal mengubah status pendaftaran" });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mengubah status pendaftaran");
    } finally {
      setPending(false);
    }
  }

  async function saveNote() {
    setPending(true);
    setError("");
    try {
      await requestJson(`/api/v1/admin/program/${id}`, { method: "PATCH", body: { registrationNote: draftNote }, fallbackMessage: "Gagal menyimpan catatan status" });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menyimpan catatan status");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">Status pendaftaran</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={pending}
            onClick={() => void change(option.value)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-theme-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limo-blue-500/40 disabled:opacity-60 ${current === option.value ? "border-limo-blue-500 bg-limo-blue-50 text-limo-blue-700" : "border-gray-200 bg-white text-gray-600 hover:border-limo-blue-300 hover:bg-limo-blue-50"}`}
          >
            <span className={`size-2 rounded-full ${option.dot}`} />
            {option.label}
          </button>
        ))}
      </div>
      <div className="mt-3">
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400" htmlFor={`note-${id}`}>Catatan status (opsional)</label>
        <div className="mt-1.5 flex gap-2">
          <input id={`note-${id}`} value={draftNote} onChange={(event) => setDraftNote(event.target.value)} placeholder="Contoh: Kelas baru dibuka awal bulan depan" className="tailadmin-input" />
          <button type="button" disabled={pending} onClick={() => void saveNote()} className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-theme-xs font-semibold text-gray-700 hover:border-limo-blue-300 hover:bg-limo-blue-50">{pending ? "Menyimpan..." : "Simpan"}</button>
        </div>
      </div>
      {error ? <p role="alert" className="mt-2 text-theme-xs text-error-700">{error}</p> : null}
    </div>
  );
}
