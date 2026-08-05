import { CalendarRangeNav } from "@/components/dashboard/calendar-range-nav";
import { CalendarView } from "@/components/dashboard/calendar-view";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { getDefaultCalendarRange, listCalendarEvents, resolveCalendarRange } from "@/server/services/calendar-service";

export const metadata = { title: "Kalender Anak" };

export default async function WaliCalendarPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const params = await searchParams;
  const range = params.from || params.to ? resolveCalendarRange(params) : getDefaultCalendarRange();
  const { events } = await listCalendarEvents(actor, { from: range.from.toISOString(), to: range.to.toISOString() });
  return <main className="space-y-6"><DashboardHero eyebrow="Jadwal Anak" title="Kalender Anak" description="Jadwal kelas, deadline, ujian, dan pengumuman seluruh anak yang terhubung ke akun Wali." /><CalendarRangeNav path="/wali/kalender" from={range.from} to={range.to} /><CalendarView events={events} /></main>;
}
