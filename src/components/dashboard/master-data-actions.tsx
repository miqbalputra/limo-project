"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Resource = "program" | "level" | "kelas";
type GuruOption = { id: string; user: { name: string; email: string } };

export function MasterDataActions({
  resource,
  id,
  name,
  description = "",
  order = 0,
  scheduleNote = "",
  guruProfileId = "",
  guruOptions = [],
  archived = false,
}: {
  resource: Resource;
  id: string;
  name: string;
  description?: string;
  order?: number;
  scheduleNote?: string;
  guruProfileId?: string;
  guruOptions?: GuruOption[];
  archived?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftDescription, setDraftDescription] = useState(description);
  const [draftOrder, setDraftOrder] = useState(String(order));
  const [draftScheduleNote, setDraftScheduleNote] = useState(scheduleNote);
  const [draftGuruProfileId, setDraftGuruProfileId] = useState(guruProfileId);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function request(path: string, method: "PATCH" | "DELETE", body?: unknown) {
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Aksi gagal diproses");
      setEditing(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aksi gagal diproses");
    } finally {
      setIsSubmitting(false);
    }
  }

  function save() {
    const body = resource === "program"
      ? { name: draftName, description: draftDescription }
      : resource === "level"
        ? { name: draftName, order: Number(draftOrder), description: draftDescription }
        : { name: draftName, scheduleNote: draftScheduleNote, guruProfileId: draftGuruProfileId };
    void request(`/api/v1/admin/${resource}/${id}`, "PATCH", body);
  }

  function archive() {
    if (window.confirm(`Arsipkan ${resource} ini? Data historis tetap dipertahankan.`)) {
      void request(`/api/v1/admin/${resource}/${id}`, "DELETE");
    }
  }

  if (editing) {
    return (
      <div className="mt-4 grid gap-2 rounded-xl border border-brand-100 bg-brand-50/40 p-3">
        <input value={draftName} onChange={(event) => setDraftName(event.target.value)} aria-label={`Nama ${resource}`} className="tailadmin-input" />
        {resource === "level" ? <input value={draftOrder} onChange={(event) => setDraftOrder(event.target.value)} type="number" min={0} aria-label="Urutan level" className="tailadmin-input" /> : null}
        {resource === "kelas" ? <>
          <select value={draftGuruProfileId} onChange={(event) => setDraftGuruProfileId(event.target.value)} aria-label="Guru pengampu kelas" className="tailadmin-input"><option value="">Tanpa guru</option>{guruOptions.map((guru) => <option key={guru.id} value={guru.id}>{guru.user.name} - {guru.user.email}</option>)}</select>
          <input value={draftScheduleNote} onChange={(event) => setDraftScheduleNote(event.target.value)} aria-label="Catatan jadwal kelas" className="tailadmin-input" />
        </> : null}
        {resource !== "kelas" ? <textarea value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} aria-label={`Deskripsi ${resource}`} className="tailadmin-input" /> : null}
        <div className="flex flex-wrap gap-2"><button type="button" onClick={save} disabled={isSubmitting} className="tailadmin-button-primary px-3 py-2">{isSubmitting ? "Menyimpan..." : "Simpan"}</button><button type="button" onClick={() => setEditing(false)} disabled={isSubmitting} className="tailadmin-button-outline px-3 py-2">Batal</button></div>
        {error ? <p role="alert" className="text-theme-xs text-error-700">{error}</p> : null}
      </div>
    );
  }

  return <div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" onClick={() => setEditing(true)} disabled={archived || isSubmitting} className="tailadmin-button-outline px-3 py-2">Edit</button>{!archived ? <button type="button" onClick={archive} disabled={isSubmitting} className="inline-flex rounded-lg bg-error-50 px-3 py-2 text-theme-xs font-semibold text-error-700 hover:bg-error-100">Arsipkan</button> : <span className="rounded-full bg-gray-100 px-3 py-2 text-theme-xs font-semibold text-gray-500">Diarsipkan</span>}{error ? <p role="alert" className="w-full text-theme-xs text-error-700">{error}</p> : null}</div>;
}
