import Link from "next/link";
import { DashboardHero, EmptyState, MetricCard, SectionHeader } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { listGuruSchedule } from "@/server/services/lms-service";
import { formatJakartaDate, getJakartaDayRange } from "@/server/time/jakarta";

export const metadata = { title: "Jadwal Guru" };

export default async function GuruSchedulePage() {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const range = getJakartaDayRange(-7, 28);
  const { items } = await listGuruSchedule(actor, range.start, range.end);
  const grouped = groupByDate(items);
  const pending = items.filter((item) => {
    const students = item.kelas._count.enrollments;
    return students > 0 && (item._count.presensi < students || item._count.progresBelajar < students);
  }).length;

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Kalender Pengajaran"
        title="Jadwal Kelas"
        description="Lihat sesi tujuh hari terakhir dan empat minggu ke depan. Semua jadwal hanya berasal dari kelas aktif yang ditugaskan kepada Anda."
        aside={<div className="rounded-2xl bg-brand-500 px-5 py-4 text-white shadow-theme-lg"><p className="text-theme-xs text-white/70">Rentang jadwal</p><p className="mt-1 text-lg font-semibold">35 hari pengajaran</p><p className="mt-1 text-theme-xs text-white/80">Sesi terbaru dan yang akan datang</p></div>}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Sesi Terjadwal" value={items.length} description="Dalam rentang kalender" icon="presensi" />
        <MetricCard label="Tanggal Aktif" value={grouped.length} description="Hari dengan sesi" icon="classes" tone="success" />
        <MetricCard label="Perlu Diinput" value={pending} description="Presensi atau progres belum lengkap" icon="progress" tone={pending > 0 ? "warning" : "gray"} />
      </section>

      <section>
        <SectionHeader title="Agenda Kalender" description="Buka presensi atau progres langsung dari sesi yang dijadwalkan." />
        {grouped.length > 0 ? <div className="space-y-5">{grouped.map((group) => <ScheduleDay key={group.date} group={group} />)}</div> : <EmptyState icon="classes" title="Belum ada jadwal" description="Sesi kelas aktif akan muncul di kalender setelah dibuat oleh admin atau Guru." />}
      </section>
    </main>
  );
}

type ScheduleItem = Awaited<ReturnType<typeof listGuruSchedule>>["items"][number];

function groupByDate(items: ScheduleItem[]) {
  const groups = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const date = formatJakartaDate(item.sessionDate);
    groups.set(date, [...(groups.get(date) || []), item]);
  }

  return [...groups.entries()].map(([date, sessions]) => ({ date, sessions }));
}

function ScheduleDay({ group }: { group: { date: string; sessions: ScheduleItem[] } }) {
  const date = new Date(`${group.date}T00:00:00.000Z`);
  const isToday = group.date === formatJakartaDate();

  return (
    <div className="tailadmin-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <div><h2 className="font-semibold text-gray-900">{new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: "Asia/Jakarta" }).format(date)}</h2><p className="mt-1 text-theme-xs text-gray-500">{group.sessions.length} sesi</p></div>
        {isToday ? <span className="rounded-full bg-brand-50 px-3 py-1 text-theme-xs font-semibold text-brand-600">Hari ini</span> : null}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {group.sessions.map((item) => {
          const students = item.kelas._count.enrollments;
          const attendanceComplete = students > 0 && item._count.presensi >= students;
          const progressComplete = students > 0 && item._count.progresBelajar >= students;

          return <article key={item.id} className="rounded-2xl bg-gray-50 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">Pertemuan {item.meetingNumber} / {item.kelas.name}</p><h3 className="mt-1 truncate font-semibold text-gray-900" title={item.topic}>{item.topic}</h3><p className="mt-1 text-theme-xs text-gray-500">{formatTime(item.sessionDate)} / {students} siswa aktif</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.status === "FINAL" ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700"}`}>{item.status === "FINAL" ? "Final" : "Draft"}</span></div><div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold"><span className={attendanceComplete ? "text-success-700" : "text-warning-700"}>Presensi {attendanceComplete ? "lengkap" : "perlu diinput"}</span><span className={progressComplete ? "text-success-700" : "text-warning-700"}>Progres {progressComplete ? "lengkap" : "perlu diinput"}</span></div><div className="mt-4 flex flex-wrap gap-2"><Link href={`/guru/presensi/${item.id}`} className="tailadmin-button-primary px-3 py-2">Presensi</Link><Link href={`/guru/progres/${item.id}`} className="tailadmin-button-outline px-3 py-2">Progres</Link></div></article>;
        })}
      </div>
    </div>
  );
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
}
