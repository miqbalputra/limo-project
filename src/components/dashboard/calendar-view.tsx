import Link from "next/link";
import type { CalendarEventDto } from "@/server/services/calendar-service";
import { APP_TIME_ZONE, formatJakartaDate } from "@/server/time/jakarta";

const dateFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: APP_TIME_ZONE });
const timeFormatter = new Intl.DateTimeFormat("id-ID", { timeStyle: "short", timeZone: APP_TIME_ZONE });

export function CalendarView({ events }: { events: CalendarEventDto[] }) {
  const groups = new Map<string, CalendarEventDto[]>();
  for (const event of events) groups.set(formatJakartaDate(event.startAt), [...(groups.get(formatJakartaDate(event.startAt)) || []), event]);
  const entries = [...groups.entries()];

  if (entries.length === 0) return <div className="tailadmin-card p-8 text-center"><p className="font-semibold text-gray-900">Belum ada event pada rentang ini</p><p className="mt-2 text-theme-sm text-gray-500">Jadwal kelas, deadline, ujian, dan pengumuman akan muncul di sini.</p></div>;

  return <div className="space-y-5">{entries.map(([date, items]) => <section key={date} className="tailadmin-card p-5"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3"><h2 className="font-semibold capitalize text-gray-900">{dateFormatter.format(new Date(`${date}T00:00:00+07:00`))}</h2><span className="rounded-full bg-gray-50 px-3 py-1 text-theme-xs font-semibold text-gray-500">{items.length} event</span></div><div className="mt-4 grid gap-3 lg:grid-cols-2">{items.map((event) => <article key={event.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{event.eventType.replaceAll("_", " ")}{event.className ? ` / ${event.className}` : ""}</p><h3 className="mt-1 break-words font-semibold text-gray-900">{event.title}</h3><p className="mt-1 text-theme-xs text-gray-500">{event.allDay ? "Sepanjang hari" : `${timeFormatter.format(event.startAt)}${event.endAt ? ` - ${timeFormatter.format(event.endAt)}` : ""}`}</p></div><span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-gray-500">{event.status || "Info"}</span></div>{event.description ? <p className="mt-3 whitespace-pre-line text-theme-xs leading-5 text-gray-600">{event.description}</p> : null}<Link href={event.href} className="mt-4 inline-block text-theme-xs font-semibold text-brand-600 hover:text-brand-700">Buka tindakan</Link></article>)}</div></section>)}</div>;
}
