"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { formatUiLabel } from "@/lib/ui-labels";
import { requestJson } from "@/lib/api-json-client";

export type RppEditValues = {
  id: string;
  mode: string;
  title: string;
  planDate: string;
  meetingNumber: number | null;
  topic: string;
  difficulty: string;
  durationMinutes: number | null;
  notes: string;
  learningObjectives: string;
  materials: string;
  activities: string;
  assessment: string;
};

export function RppActions({ item }: { item: RppEditValues }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/v1/guru/rpp/${item.id}`, {
        method: "PUT",
        body: {
          title: String(data.get("title") || ""),
          planDate: String(data.get("planDate") || ""),
          meetingNumber: String(data.get("meetingNumber") || ""),
          topic: String(data.get("topic") || ""),
          difficulty: String(data.get("difficulty") || "Sedang"),
          durationMinutes: String(data.get("durationMinutes") || ""),
          notes: String(data.get("notes") || ""),
          learningObjectives: String(data.get("learningObjectives") || ""),
          materials: String(data.get("materials") || ""),
          activities: String(data.get("activities") || ""),
          assessment: String(data.get("assessment") || ""),
        },
        fallbackMessage: "RPP gagal diperbarui",
      });
      toast.success("RPP diperbarui.");
      setEditing(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "RPP gagal diperbarui");
    } finally {
      setBusy(false);
    }
  }

  if (item.mode !== "FORM") return null;

  if (editing) {
    return (
      <form onSubmit={save} className="mt-4 grid gap-3 rounded-xl border border-limo-blue-100 bg-limo-blue-50/40 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="title" required defaultValue={item.title} aria-label="Judul RPP" className="tailadmin-input" />
          <input name="planDate" required type="date" defaultValue={item.planDate} aria-label="Tanggal RPP" className="tailadmin-input" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <input name="meetingNumber" type="number" min={1} defaultValue={item.meetingNumber ?? ""} aria-label="Pertemuan ke" placeholder="Pertemuan ke" className="tailadmin-input" />
          <input name="topic" required defaultValue={item.topic} aria-label="Materi/topik" placeholder="Materi/topik" className="tailadmin-input" />
          <select name="difficulty" defaultValue={item.difficulty} aria-label="Tingkat kesulitan" className="tailadmin-input">
            <option value="Mudah">{formatUiLabel("Mudah")}</option>
            <option value="Sedang">{formatUiLabel("Sedang")}</option>
            <option value="Sulit">{formatUiLabel("Sulit")}</option>
          </select>
        </div>
        <textarea name="learningObjectives" defaultValue={item.learningObjectives} aria-label="Tujuan pembelajaran" placeholder="Tujuan pembelajaran" className="tailadmin-input min-h-20" />
        <textarea name="materials" defaultValue={item.materials} aria-label="Materi dan media" placeholder="Materi dan media" className="tailadmin-input min-h-20" />
        <textarea name="activities" defaultValue={item.activities} aria-label="Langkah kegiatan" placeholder="Langkah kegiatan" className="tailadmin-input min-h-24" />
        <textarea name="assessment" defaultValue={item.assessment} aria-label="Asesmen" placeholder="Asesmen" className="tailadmin-input min-h-20" />
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="durationMinutes" type="number" min={1} max={600} defaultValue={item.durationMinutes ?? ""} aria-label="Durasi menit" placeholder="Durasi (menit)" className="tailadmin-input" />
          <input name="notes" defaultValue={item.notes} aria-label="Catatan tambahan" placeholder="Catatan tambahan (opsional)" className="tailadmin-input" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="tailadmin-button-primary px-3 py-2 text-theme-xs">{busy ? "Menyimpan..." : "Simpan perubahan"}</button>
          <button type="button" disabled={busy} onClick={() => { setEditing(false); setError(""); }} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Batal</button>
        </div>
        {error ? <p role="alert" className="text-theme-xs text-error-700">{error}</p> : null}
      </form>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => { setError(""); setEditing(true); }} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Ubah</button>
      {error ? <p role="alert" className="w-full text-theme-xs text-error-700">{error}</p> : null}
    </div>
  );
}
