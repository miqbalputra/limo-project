import { CalendarRangeNav } from "@/components/dashboard/calendar-range-nav";
import { CalendarView } from "@/components/dashboard/calendar-view";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { resolveWaliChildId } from "@/server/dal/wali-selector-dal";
import { listCalendarEvents, listCalendarFilterClasses, resolveCalendarPageRange } from "@/server/services/calendar-service";

export const metadata = { title: "Kalender Anak" };

export default async function WaliCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; from?: string; to?: string; classId?: string; anak?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const params = await searchParams;
  const selectedChildId = await resolveWaliChildId(actor, params.anak);
  const range = resolveCalendarPageRange(params);
  const [{ events }, { items: classes }] = await Promise.all([listCalendarEvents(actor, { from: range.start.toISOString(), to: range.end.toISOString(), classId: params.classId, siswaId: selectedChildId }), listCalendarFilterClasses(actor, selectedChildId)]);
  return <main className="space-y-6"><DashboardHero eyebrow="Jadwal Anak" title="Kalender Anak" description="Lihat agenda seluruh anak atau filter ke kelas tertentu." /><CalendarRangeNav path="/wali/kalender" from={range.start} to={range.end} month={range.month} classId={params.classId} childId={selectedChildId} classes={classes} /><CalendarView events={events} from={range.start} to={range.end} month={range.month} /></main>;
}
