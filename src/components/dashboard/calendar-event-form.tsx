"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { formatUiLabel } from "@/lib/ui-labels";
import { requestJson } from "@/lib/api-json-client";

type ClassOption = { id: string; name: string };

export function CalendarEventForm({ classes, allowGlobal = false, allowAllClasses = false }: { classes: ClassOption[]; allowGlobal?: boolean; allowAllClasses?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [classId, setClassId] = useState(allowAllClasses || allowGlobal ? "" : classes[0]?.id || "");
  const [eventType, setEventType] = useState("ANNOUNCEMENT");
  const [visibility, setVisibility] = useState("ALL");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedClass = classes.find((item) => item.id === classId);
  const targetLabel = selectedClass?.name || (allowGlobal ? "Semua kelas secara global" : "Semua kelas yang saya kelola");
  const hasNoManagedClasses = !allowGlobal && classes.length === 0;

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await requestJson("/api/v1/calendar/events", {
        method: "POST",
        body: { title, description: description || undefined, classId: classId || undefined, eventType, visibility, startAt, endAt: endAt || undefined, allDay },
        fallbackMessage: "Agenda gagal dibuat",
      });
      setTitle("");
      setDescription("");
      setStartAt("");
      setEndAt("");
      setAllDay(false);
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Agenda gagal dibuat");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tailadmin-card overflow-hidden" aria-labelledby="calendar-event-form-title">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-limo-blue-50 text-limo-blue-500" aria-hidden="true"><CalendarPlusIcon /></span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-limo-blue-500">Atur agenda</p>
            <h2 id="calendar-event-form-title" className="mt-0.5 text-base font-semibold text-gray-900">Tambah agenda kalender</h2>
            <p className="mt-0.5 truncate text-theme-xs text-gray-500">Untuk {targetLabel.toLowerCase()}.</p>
          </div>
        </div>
        <button type="button" onClick={() => { setError(""); setOpen(true); }} disabled={hasNoManagedClasses} className="tailadmin-button-primary shrink-0 px-4 py-2.5">
          <PlusIcon />
          Tambah agenda
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4" role="presentation" onClick={() => setOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="calendar-event-dialog-title" className="flex max-h-[min(720px,calc(100vh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-theme-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 sm:p-6">
              <div>
                <p className="text-theme-xs font-semibold uppercase tracking-[0.18em] text-limo-blue-500">Agenda baru</p>
                <h2 id="calendar-event-dialog-title" className="mt-1 text-xl font-semibold text-gray-900">Tambah agenda kalender</h2>
                <p className="mt-1 text-theme-sm text-gray-500">Pilih kelas dan waktu. Detail tambahan bersifat opsional.</p>
              </div>
              <button type="button" aria-label="Tutup form agenda" onClick={() => setOpen(false)} className="grid size-9 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"><CloseIcon /></button>
            </div>

            <form onSubmit={(event) => void submit(event)} className="min-h-0 overflow-y-auto p-5 sm:p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label htmlFor="calendar-event-title" className="mb-1.5 block text-theme-xs font-semibold text-gray-700">Judul agenda</label>
                  <input id="calendar-event-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Contoh: Ujian tengah modul" className="tailadmin-input" required minLength={2} maxLength={160} autoFocus />
                </div>

                <div>
                  <label htmlFor="calendar-event-class" className="mb-1.5 block text-theme-xs font-semibold text-gray-700">Kelas tujuan</label>
                  <select id="calendar-event-class" aria-label="Kelas agenda" value={classId} onChange={(event) => setClassId(event.target.value)} className="tailadmin-input">
                    <option value="">{allowGlobal ? "Semua kelas (global)" : "Semua kelas saya"}</option>
                    {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <p className="mt-1.5 text-[11px] leading-4 text-gray-400">{classId ? "Agenda hanya tampil pada kelas ini." : allowGlobal ? "Agenda tampil pada seluruh akun yang relevan." : "Agenda akan dibuat pada setiap kelas yang Anda kelola."}</p>
                </div>

                <div>
                  <label htmlFor="calendar-event-type" className="mb-1.5 block text-theme-xs font-semibold text-gray-700">Jenis agenda</label>
                  <select id="calendar-event-type" value={eventType} onChange={(event) => setEventType(event.target.value)} className="tailadmin-input">
                    <option value="ANNOUNCEMENT">{formatUiLabel("ANNOUNCEMENT")}</option>
                    <option value="HOLIDAY">{formatUiLabel("HOLIDAY")}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="calendar-event-start" className="mb-1.5 block text-theme-xs font-semibold text-gray-700">Mulai</label>
                  <input id="calendar-event-start" value={startAt} onChange={(event) => setStartAt(event.target.value)} type="datetime-local" className="tailadmin-input" required />
                </div>

                <div>
                  <label htmlFor="calendar-event-end" className="mb-1.5 block text-theme-xs font-semibold text-gray-700">Selesai <span className="font-normal text-gray-400">(opsional)</span></label>
                  <input id="calendar-event-end" value={endAt} onChange={(event) => setEndAt(event.target.value)} type="datetime-local" className="tailadmin-input" />
                </div>

                <label className="flex items-center gap-2 text-theme-sm text-gray-600 md:col-span-2">
                  <input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} className="size-4 rounded border-gray-300 text-limo-blue-500 focus:ring-limo-blue-500/20" />
                  Agenda sepanjang hari
                </label>

                <details className="rounded-xl border border-gray-200 md:col-span-2">
                  <summary className="cursor-pointer px-4 py-3 text-theme-xs font-semibold text-gray-700">Opsi tambahan</summary>
                  <div className="grid gap-4 border-t border-gray-100 p-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="calendar-event-description" className="mb-1.5 block text-theme-xs font-semibold text-gray-700">Catatan <span className="font-normal text-gray-400">(opsional)</span></label>
                      <textarea id="calendar-event-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Lokasi atau instruksi singkat" className="tailadmin-input min-h-20 resize-y" maxLength={10000} />
                    </div>
                    <div>
                      <label htmlFor="calendar-event-visibility" className="mb-1.5 block text-theme-xs font-semibold text-gray-700">Tampil untuk</label>
                      <select id="calendar-event-visibility" value={visibility} onChange={(event) => setVisibility(event.target.value)} className="tailadmin-input">
                        <option value="ALL">{formatUiLabel("ALL")} pengguna terkait</option>
                        <option value="GURU">{formatUiLabel("GURU")}</option>
                        <option value="SISWA">{formatUiLabel("SISWA")}</option>
                        <option value="WALI">{formatUiLabel("WALI")}</option>
                      </select>
                    </div>
                  </div>
                </details>
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-theme-xs text-gray-400">Waktu mengikuti zona Asia/Jakarta.</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {error ? <p className="tailadmin-alert-error" role="alert">{error}</p> : null}
                  <button type="button" onClick={() => setOpen(false)} className="tailadmin-button-outline px-4 py-2.5">Batal</button>
                  <button type="submit" disabled={busy} className="tailadmin-button-primary px-4 py-2.5">{busy ? "Menyimpan..." : "Simpan agenda"}</button>
                </div>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function CalendarPlusIcon() {
  return <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17M12 12.5v5M9.5 15h5" strokeLinecap="round" /></svg>;
}

function PlusIcon() {
  return <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M10 4v12M4 10h12" strokeLinecap="round" /></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" /></svg>;
}
