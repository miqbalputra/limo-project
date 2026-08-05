"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ClassOption = { id: string; name: string };

export function CalendarEventForm({ classes, allowGlobal = false }: { classes: ClassOption[]; allowGlobal?: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState(classes[0]?.id || "");
  const [eventType, setEventType] = useState("ANNOUNCEMENT");
  const [visibility, setVisibility] = useState("ALL");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/calendar/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, classId: classId || undefined, eventType, visibility, startAt, endAt: endAt || undefined, allDay }) });
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Event gagal dibuat");
      setTitle("");
      setStartAt("");
      setEndAt("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Event gagal dibuat");
    } finally {
      setBusy(false);
    }
  }

  return <section className="tailadmin-card p-5"><div><p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">Event manual</p><h2 className="mt-1 text-lg font-semibold text-gray-900">Tambah pengumuman atau hari libur</h2><p className="mt-1 text-theme-sm text-gray-500">Event ini tidak menduplikasi sesi, tugas, atau ujian dari sumber utama.</p></div><div className="mt-4 grid gap-3 md:grid-cols-2"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Judul event" className="tailadmin-input md:col-span-2" /><select value={classId} onChange={(event) => setClassId(event.target.value)} className="tailadmin-input"><option value="">{allowGlobal ? "Semua kelas" : "Pilih kelas"}</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={eventType} onChange={(event) => setEventType(event.target.value)} className="tailadmin-input"><option value="ANNOUNCEMENT">Pengumuman</option><option value="HOLIDAY">Hari libur</option></select><select value={visibility} onChange={(event) => setVisibility(event.target.value)} className="tailadmin-input"><option value="ALL">Semua pengguna</option><option value="GURU">Guru</option><option value="SISWA">Siswa</option><option value="WALI">Wali</option></select><input value={startAt} onChange={(event) => setStartAt(event.target.value)} type="datetime-local" className="tailadmin-input" /><input value={endAt} onChange={(event) => setEndAt(event.target.value)} type="datetime-local" className="tailadmin-input" /><label className="flex items-center gap-2 text-theme-sm text-gray-600 md:col-span-2"><input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} /> Sepanjang hari</label></div><div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" disabled={busy || !title.trim() || (!allowGlobal && !classId) || !startAt} onClick={() => void submit()} className="tailadmin-button-primary px-4 py-2">{busy ? "Menyimpan..." : "Simpan Event"}</button>{error ? <p className="text-theme-xs text-error-600">{error}</p> : null}</div></section>;
}
