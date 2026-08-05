import { CalendarEventForm } from "@/components/dashboard/calendar-event-form";
import { CalendarRangeNav } from "@/components/dashboard/calendar-range-nav";
import { CalendarView } from "@/components/dashboard/calendar-view";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { getDefaultCalendarRange, listCalendarEventClasses, listCalendarEvents, resolveCalendarRange } from "@/server/services/calendar-service";

export const metadata = { title: "Kalender Operasional" };

export default async function AdminCalendarPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const params = await searchParams;
  const range = params.from || params.to ? resolveCalendarRange(params) : getDefaultCalendarRange();
  const [{ events }, { items: classes }] = await Promise.all([listCalendarEvents(actor, { from: range.from.toISOString(), to: range.to.toISOString() }), listCalendarEventClasses(actor)]);
  return <main className="space-y-6"><DashboardHero eyebrow="Kalender Operasional" title="Kalender Admin" description="Kelola event global atau event kelas tanpa menduplikasi jadwal dari sumber akademik." /><CalendarRangeNav path="/admin/kalender" from={range.from} to={range.to} /><CalendarEventForm classes={classes} allowGlobal /><CalendarView events={events} /></main>;
}
