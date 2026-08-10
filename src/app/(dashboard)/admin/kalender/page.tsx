import { CalendarEventForm } from "@/components/dashboard/calendar-event-form";
import { CalendarRangeNav } from "@/components/dashboard/calendar-range-nav";
import { CalendarView } from "@/components/dashboard/calendar-view";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { listCalendarEventClasses, listCalendarEvents, resolveCalendarPageRange } from "@/server/services/calendar-service";

export const metadata = { title: "Kalender Operasional" };

export default async function AdminCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; from?: string; to?: string; classId?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const params = await searchParams;
  const range = resolveCalendarPageRange(params);
  const [{ events }, { items: classes }] = await Promise.all([listCalendarEvents(actor, { from: range.start.toISOString(), to: range.end.toISOString(), classId: params.classId }), listCalendarEventClasses(actor)]);
  return <main className="space-y-6"><DashboardHero eyebrow="Kalender Pendidikan" title="Kalender Admin" description="Kelola agenda global atau agenda kelas tanpa menduplikasi jadwal dari sumber akademik." /><CalendarRangeNav path="/admin/kalender" from={range.start} to={range.end} month={range.month} classId={params.classId} classes={classes} /><CalendarEventForm classes={classes} allowGlobal allowAllClasses /><CalendarView events={events} from={range.start} to={range.end} month={range.month} canManageManualEvents /></main>;
}
