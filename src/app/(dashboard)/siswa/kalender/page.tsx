import { CalendarRangeNav } from "@/components/dashboard/calendar-range-nav";
import { CalendarView } from "@/components/dashboard/calendar-view";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { getDefaultCalendarRange, listCalendarEvents, resolveCalendarRange } from "@/server/services/calendar-service";

export const metadata = { title: "Kalender Siswa" };

export default async function StudentCalendarPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["SISWA"]);
  const params = await searchParams;
  const range = params.from || params.to ? resolveCalendarRange(params) : getDefaultCalendarRange();
  const { events } = await listCalendarEvents(actor, { from: range.from.toISOString(), to: range.to.toISOString() });
  return <main className="space-y-6"><DashboardHero eyebrow="Jadwal Belajar" title="Kalender Saya" description="Lihat jadwal kelas, release modul, deadline tugas, ujian, dan pengumuman yang berlaku untuk Anda." /><CalendarRangeNav path="/siswa/kalender" from={range.from} to={range.to} /><CalendarView events={events} /></main>;
}
