import { CalendarRangeNav } from "@/components/dashboard/calendar-range-nav";
import { CalendarView } from "@/components/dashboard/calendar-view";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { listCalendarEvents, listCalendarFilterClasses, resolveCalendarPageRange } from "@/server/services/calendar-service";

export const metadata = { title: "Kalender Siswa" };

export default async function StudentCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; from?: string; to?: string; classId?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["SISWA"]);
  const params = await searchParams;
  const range = resolveCalendarPageRange(params);
  const [{ events }, { items: classes }] = await Promise.all([listCalendarEvents(actor, { from: range.start.toISOString(), to: range.end.toISOString(), classId: params.classId }), listCalendarFilterClasses(actor)]);
  return <main className="space-y-6"><DashboardHero eyebrow="Jadwal Belajar" title="Kalender Saya" description="Lihat agenda dan filter berdasarkan kelas yang Anda ikuti." /><CalendarRangeNav path="/siswa/kalender" from={range.start} to={range.end} month={range.month} classId={params.classId} classes={classes} /><CalendarView events={events} from={range.start} to={range.end} month={range.month} /></main>;
}
