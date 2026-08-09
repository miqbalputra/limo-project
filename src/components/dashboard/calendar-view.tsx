"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import type { CalendarEventDto } from "@/server/services/calendar-service";
import { APP_TIME_ZONE, formatJakartaDate, formatJakartaPeriod } from "@/server/time/jakarta";
import { formatUiLabel } from "@/lib/ui-labels";
import { requestJson } from "@/lib/api-json-client";

const DAY_MS = 24 * 60 * 60 * 1000;
const weekdayLabels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const dateFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: APP_TIME_ZONE });
const dayNumberFormatter = new Intl.DateTimeFormat("id-ID", { day: "numeric", timeZone: APP_TIME_ZONE });
const timeFormatter = new Intl.DateTimeFormat("id-ID", { timeStyle: "short", timeZone: APP_TIME_ZONE });

const eventStyles: Record<string, string> = {
  CLASS_SESSION: "border-limo-blue-500 bg-limo-blue-50 text-limo-blue-700",
  MODULE_RELEASE: "border-limo-sky-500 bg-limo-sky-50 text-limo-sky-700",
  ASSIGNMENT_DUE: "border-limo-yellow-500 bg-limo-yellow-50 text-limo-yellow-800",
  QUIZ_DUE: "border-limo-blue-400 bg-limo-blue-50 text-limo-blue-700",
  EXAM: "border-limo-red-500 bg-limo-red-50 text-limo-red-700",
  REMEDIAL_DUE: "border-limo-green-500 bg-limo-green-50 text-limo-green-700",
  HOLIDAY: "border-limo-neutral-400 bg-limo-neutral-100 text-limo-neutral-700",
  ANNOUNCEMENT: "border-limo-sky-400 bg-limo-sky-50 text-limo-sky-700",
};

const eventDotStyles: Record<string, string> = {
  CLASS_SESSION: "bg-limo-blue-500",
  MODULE_RELEASE: "bg-limo-sky-500",
  ASSIGNMENT_DUE: "bg-limo-yellow-500",
  QUIZ_DUE: "bg-limo-blue-400",
  EXAM: "bg-limo-red-500",
  REMEDIAL_DUE: "bg-limo-green-500",
  HOLIDAY: "bg-limo-neutral-500",
  ANNOUNCEMENT: "bg-limo-sky-400",
};

const eventLabels: Record<string, string> = {
  CLASS_SESSION: "Sesi kelas",
  MODULE_RELEASE: "Rilis modul",
  ASSIGNMENT_DUE: "Deadline tugas",
  QUIZ_DUE: "Deadline kuis",
  EXAM: "Ujian",
  REMEDIAL_DUE: "Deadline remedial",
  HOLIDAY: "Hari libur",
  ANNOUNCEMENT: "Pengumuman",
};

function dayKey(date: Date) {
  return formatJakartaDate(date);
}

function buildDays(from: Date, to: Date) {
  const days: Date[] = [];
  for (let cursor = from.getTime(); cursor < to.getTime(); cursor += DAY_MS) days.push(new Date(cursor));
  return days;
}

function formatEventTime(event: CalendarEventDto) {
  if (event.allDay) return "Seharian";
  return `${timeFormatter.format(event.startAt)}${event.endAt ? ` - ${timeFormatter.format(event.endAt)}` : ""}`;
}

export function CalendarView({ events, from, to, month, canManageManualEvents = false }: { events: CalendarEventDto[]; from: Date; to: Date; month?: string; canManageManualEvents?: boolean }) {
  const router = useRouter();
  const calendarRef = useRef<HTMLElement>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CalendarEventDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const days = buildDays(from, to);
  const currentMonth = month || formatJakartaPeriod(new Date(from.getTime() + 7 * DAY_MS));
  const today = dayKey(new Date());
  const eventsByDay = new Map<string, CalendarEventDto[]>();

  for (const event of events) {
    const key = dayKey(event.startAt);
    eventsByDay.set(key, [...(eventsByDay.get(key) || []), event]);
  }
  const agendaDays = days
    .map((date) => ({ date, events: eventsByDay.get(dayKey(date)) || [] }))
    .filter((day) => day.events.length > 0);

  useEffect(() => {
    if (!selectedEvent) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedEvent(null);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedEvent]);

  async function deleteEvent() {
    if (!deleteTarget || deleteTarget.sourceType !== "CalendarEvent") return;
    setDeleting(true);
    setDeleteError("");

    try {
      await requestJson(`/api/v1/calendar/events/${deleteTarget.sourceId}`, { method: "DELETE", fallbackMessage: "Agenda gagal dihapus" });
      setDeleteTarget(null);
      setSelectedEvent(null);
      router.refresh();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Agenda gagal dihapus");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section ref={calendarRef} tabIndex={-1} className="tailadmin-card overflow-hidden outline-none" aria-labelledby="calendar-grid-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4 sm:p-5">
        <div>
          <p className="text-theme-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Tampilan bulanan</p>
          <h2 id="calendar-grid-title" className="mt-1 text-lg font-semibold text-gray-900">Agenda dan jadwal</h2>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1.5 text-theme-xs font-medium text-gray-500">
          <span className="size-1.5 rounded-full bg-limo-blue-500" aria-hidden="true" />
          {events.length} agenda pada tampilan ini
        </div>
      </div>

      <div className="hidden grid-cols-7 border-b border-gray-100 bg-gray-50/80 md:grid" aria-hidden="true">
        {weekdayLabels.map((label) => <div key={label} className="px-3 py-3 text-center text-theme-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>)}
      </div>

      <div className="divide-y divide-gray-100 md:hidden" data-testid="calendar-mobile-agenda" aria-label="Agenda pada tampilan ini">
        {agendaDays.length > 0 ? agendaDays.map(({ date, events: dayEvents }) => {
          const key = dayKey(date);
          return (
            <section key={key} className="p-4" aria-label={dateFormatter.format(date)}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-700">{dayNumberFormatter.format(date)}</p>
                  <h3 className="text-theme-sm font-semibold text-gray-900">{dateFormatter.format(date)}</h3>
                </div>
                <span className="rounded-full bg-gray-50 px-2.5 py-1 text-theme-xs font-semibold text-gray-500">{dayEvents.length} agenda</span>
              </div>
              <div className="space-y-2">
                {dayEvents.map((event) => {
                  const eventTitle = event.className ? `${event.className}: ${event.title}` : event.title;
                  return (
                    <button key={event.id} type="button" onClick={() => { setDeleteError(""); setSelectedEvent(event); }} aria-label={`Buka agenda ${eventTitle}`} className={`flex min-h-11 w-full items-center gap-3 rounded-xl border-l-4 px-3 py-2 text-left transition hover:brightness-95 ${eventStyles[event.eventType] || "border-limo-neutral-400 bg-limo-neutral-50 text-limo-neutral-700"}`}>
                      <span className={`size-2 shrink-0 rounded-full ${eventDotStyles[event.eventType] || "bg-limo-neutral-500"}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1"><span className="block text-[10px] font-medium opacity-80">{formatEventTime(event)}</span><span className="block break-words text-theme-xs font-semibold">{eventTitle}</span></span>
                      <span className="shrink-0 text-[10px] font-semibold opacity-75">{eventLabels[event.eventType] || formatUiLabel(event.eventType)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        }) : <div className="px-5 py-12 text-center"><p className="font-semibold text-gray-900">Belum ada agenda</p><p className="mt-2 text-theme-sm leading-6 text-gray-500">Agenda kelas, tenggat, dan pengumuman pada rentang ini akan tampil di sini.</p></div>}
      </div>

      <div className="hidden grid-cols-7 divide-x divide-y divide-gray-100 md:grid" role="grid" aria-label="Kalender bulanan">
        {days.map((date) => {
          const key = dayKey(date);
          const dayEvents = eventsByDay.get(key) || [];
          const isOutsideMonth = formatJakartaPeriod(date) !== currentMonth;
          const isToday = key === today;
          const dateLabel = new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: APP_TIME_ZONE }).format(date);

          return (
            <div key={key} role="gridcell" aria-label={`${dateLabel}, ${dayEvents.length} agenda`} className={`min-h-48 min-w-0 overflow-hidden bg-white p-2.5 ${isOutsideMonth ? "bg-gray-25/70" : ""}`}>
              <div className="flex items-center justify-between gap-1">
                <span className={`flex size-7 items-center justify-center rounded-full text-theme-xs font-semibold ${isToday ? "bg-limo-blue-500 text-white shadow-theme-xs" : isOutsideMonth ? "text-gray-300" : "text-gray-600"}`} aria-label={isToday ? "Hari ini" : undefined}>{dayNumberFormatter.format(date)}</span>
                {dayEvents.length > 0 ? <span className="text-[9px] font-medium text-gray-400">{dayEvents.length}</span> : null}
              </div>

              <div className="mt-2 space-y-1">
                {dayEvents.map((event) => {
                  const eventTitle = event.className ? `${event.className}: ${event.title}` : event.title;
                  return (
                      <button key={event.id} type="button" onClick={() => { setDeleteError(""); setSelectedEvent(event); }} aria-label={`Buka agenda ${eventTitle}`} className={`block min-h-11 w-full min-w-0 truncate rounded-md border-l-2 px-2 py-1.5 text-left text-theme-xs font-semibold leading-tight transition hover:brightness-95 ${eventStyles[event.eventType] || "border-limo-neutral-400 bg-limo-neutral-50 text-limo-neutral-700"}`} title={eventTitle}>
                        <span className="flex min-w-0 items-center gap-1">
                         <span className="size-1.5 shrink-0 rounded-full bg-current opacity-70" aria-hidden="true" />
                         <span className="min-w-0 truncate">
                           <span className="opacity-70">{event.allDay ? "Seharian / " : `${timeFormatter.format(event.startAt)} / `}</span>
                           {eventTitle}
                         </span>
                       </span>
                     </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden flex-wrap gap-x-4 gap-y-2 border-t border-gray-100 px-5 py-3 text-theme-xs text-gray-500 md:flex">
        {Object.entries(eventLabels).map(([type, label]) => <span key={type} className="inline-flex items-center gap-1.5"><span className={`size-2 rounded-full ${eventDotStyles[type] || "bg-gray-400"}`} aria-hidden="true" />{label}</span>)}
      </div>

      {selectedEvent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4" role="presentation" onClick={() => setSelectedEvent(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="calendar-event-detail-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-theme-xl sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                 <p className={`text-theme-xs font-semibold uppercase tracking-wide ${eventStyles[selectedEvent.eventType]?.split(" ").find((item) => item.startsWith("text-")) || "text-limo-blue-700"}`}>{eventLabels[selectedEvent.eventType] || formatUiLabel(selectedEvent.eventType)}</p>
                <h2 id="calendar-event-detail-title" className="mt-1 break-words text-xl font-semibold text-gray-900">{selectedEvent.title}</h2>
              </div>
              <button type="button" aria-label="Tutup detail agenda" onClick={() => setSelectedEvent(null)} className="grid size-11 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <CloseIcon />
              </button>
            </div>

            <div className="mt-5 space-y-3 text-theme-sm text-gray-600">
              <p><strong className="font-semibold text-gray-900">Waktu:</strong> {selectedEvent.allDay ? "Sepanjang hari" : `${dateFormatter.format(selectedEvent.startAt)} / ${formatEventTime(selectedEvent)}`}</p>
              {selectedEvent.className ? <p><strong className="font-semibold text-gray-900">Kelas:</strong> {selectedEvent.className}</p> : <p><strong className="font-semibold text-gray-900">Target:</strong> Semua kelas</p>}
               {selectedEvent.status ? <p><strong className="font-semibold text-gray-900">Status:</strong> {formatUiLabel(selectedEvent.status)}</p> : null}
              {selectedEvent.description ? <p className="whitespace-pre-line rounded-xl bg-gray-50 p-3 leading-6">{selectedEvent.description}</p> : null}
              {deleteError ? <p className="tailadmin-alert-error" role="alert">{deleteError}</p> : null}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              {canManageManualEvents && selectedEvent.sourceType === "CalendarEvent" ? <button type="button" disabled={deleting} onClick={() => { setDeleteError(""); setDeleteTarget(selectedEvent); setSelectedEvent(null); }} className="tailadmin-button-outline min-h-11 border-error-200 px-4 py-2 text-error-600">Hapus agenda</button> : null}
              <button type="button" onClick={() => setSelectedEvent(null)} className="tailadmin-button-outline min-h-11 px-4 py-2">Tutup</button>
              <Link href={selectedEvent.href} className="tailadmin-button-primary inline-flex min-h-11 items-center px-4 py-2">Buka agenda</Link>
            </div>
          </section>
        </div>
      ) : null}
      <ConfirmDialog open={Boolean(deleteTarget)} title="Hapus agenda kalender?" description={deleteTarget ? <>Agenda <strong>{deleteTarget.title}</strong> akan dihapus dan tidak dapat dipulihkan.</> : ""} confirmLabel="Ya, hapus agenda" variant="destructive" isBusy={deleting} error={deleteError} returnFocusRef={calendarRef} onClose={() => { if (!deleting) { setDeleteTarget(null); setDeleteError(""); } }} onConfirm={() => void deleteEvent()} />
    </section>
  );
}

function CloseIcon() {
  return <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" /></svg>;
}
