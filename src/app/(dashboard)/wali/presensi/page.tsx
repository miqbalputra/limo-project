import { requireActor, requireRole } from "@/server/auth/session";
import { getActorDashboardContext } from "@/server/dal/actor-dal";
import { resolveWaliChildId } from "@/server/dal/wali-selector-dal";
import { getStudentSummary } from "@/server/services/report-service";
import { DashboardHero, EmptyState, ProgressBar } from "@/components/dashboard/dashboard-widgets";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import Link from "next/link";
import { formatUiLabel } from "@/lib/ui-labels";

export const metadata = { title: "Presensi Anak" };

export default async function WaliPresensiPage({ searchParams }: { searchParams: Promise<{ anak?: string; month?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { anak, month } = await searchParams;
  const period = resolveMonthRange(month);
  const context = await getActorDashboardContext(actor, await resolveWaliChildId(actor, anak));
  const summaries = context.role === "WALI"
    ? await Promise.all(context.children.map((child) => getStudentSummary(actor, child.id, { attendanceFrom: period.from, attendanceTo: period.to })))
    : [];
  const totals = summaries.reduce((result, summary) => {
    const hadir = summary.attendance.HADIR || 0;
    const terlambat = summary.attendance.TERLAMBAT || 0;
    const izin = summary.attendance.IZIN || 0;
    const sakit = summary.attendance.SAKIT || 0;
    const alpa = summary.attendance.ALPA || 0;
    const total = hadir + terlambat + izin + sakit + alpa;

    return { hadir: result.hadir + hadir, terlambat: result.terlambat + terlambat, izin: result.izin + izin, sakit: result.sakit + sakit, alpa: result.alpa + alpa, total: result.total + total };
  }, { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0, total: 0 });
  const overallRate = totals.total ? Math.round((totals.hadir / totals.total) * 100) : null;
  const summariesWithAttendance = summaries.filter((summary) => summary.attendanceTimeline.length > 0);
  const summariesWithoutAttendance = summaries.filter((summary) => summary.attendanceTimeline.length === 0);

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Kehadiran"
        title="Presensi Anak"
        description="Lihat status hadir, terlambat, izin, sakit, dan alpa setiap anak berdasarkan periode yang dipilih."
        aside={<PresenceHero childCount={summaries.length} total={totals.total} rate={overallRate} />}
      />

      <AttendanceFilter month={period.month} childId={anak} />

      {summaries.length > 0 ? (
        <>
        <section className="grid gap-4 xl:grid-cols-2">
           {summariesWithAttendance.map((summary) => {
          const hadir = summary.attendance.HADIR || 0;
          const terlambat = summary.attendance.TERLAMBAT || 0;
          const izin = summary.attendance.IZIN || 0;
          const sakit = summary.attendance.SAKIT || 0;
          const alpa = summary.attendance.ALPA || 0;
          const total = hadir + terlambat + izin + sakit + alpa;
          const rate = total ? Math.round((hadir / total) * 100) : 0;
          const status = getAttendanceStatus(rate);

          return (
            <article key={summary.siswa.id} className="tailadmin-card min-w-0 p-5 transition hover:-translate-y-0.5 hover:shadow-theme-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-success-50 text-lg font-semibold text-success-700">{summary.siswa.name.slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0">
                    <p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-700">{summary.siswa.nomorInduk} / {summary.siswa.program.name}</p>
                    <h2 className="mt-1 truncate text-lg font-semibold text-gray-900" title={summary.siswa.name}>{summary.siswa.name}</h2>
                    <p className="mt-1 text-theme-xs text-gray-500">{total} sesi tercatat</p>
                  </div>
                </div>
                <span className={`w-fit rounded-full px-3 py-1 text-theme-xs font-semibold ${status.className}`}>{status.label}</span>
              </div>

               <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                 <PresenceMetric label="Hadir" value={hadir} />
                 <PresenceMetric label="Terlambat" value={terlambat} />
                 <PresenceMetric label="Izin" value={izin} />
                 <PresenceMetric label="Sakit" value={sakit} />
                 <PresenceMetric label="Alpa" value={alpa} />
                <PresenceMetric label="Total" value={total} />
              </div>

              <div className="mt-5 space-y-4">
                <div>
                   <div className="mb-2 flex items-center justify-between text-theme-xs text-gray-500"><span>Tingkat hadir</span><span className="font-semibold text-gray-700">{rate}%</span></div>
                   <ProgressBar value={rate} tone={rate >= 80 ? "success" : "warning"} />
                 </div>
                 {summary.monthlyAttendance.length > 0 ? summary.monthlyAttendance.map((item) => {
                   const percent = item.total ? Math.round((item.hadir / item.total) * 100) : 0;
                   return (
                     <div key={item.month} className="rounded-2xl bg-gray-50 p-3">
                       <div className="mb-2 flex flex-wrap justify-between gap-2 text-theme-xs text-gray-500"><span>{item.month}</span><span className="font-semibold text-gray-700">Hadir {item.hadir} / Terlambat {item.terlambat} / Total {item.total}</span></div>
                       <ProgressBar value={percent} tone={percent >= 80 ? "success" : "warning"} />
                       <p className="mt-2 text-theme-xs text-gray-500">Izin {item.izin} / Sakit {item.sakit} / Alpa {item.alpa}</p>
                     </div>
                   );
                 }) : (
                  <div className="flex items-start gap-3 rounded-2xl bg-gray-50 p-4">
                    <DashboardIcon name="presensi" className="mt-0.5 size-5 shrink-0 text-gray-400" />
                    <p className="text-theme-sm leading-6 text-gray-500">Belum ada data presensi. Rekap akan muncul setelah guru menginput presensi kelas.</p>
                   </div>
                 )}
                 <details className="rounded-2xl border border-gray-100 bg-white p-4">
                   <summary className="cursor-pointer text-theme-sm font-semibold text-gray-800">Detail sesi ({summary.attendanceTimeline.length})</summary>
                   <div className="mt-3 space-y-2">
                     {summary.attendanceTimeline.map((item) => <div key={`${item.sessionDate.toISOString()}-${item.meetingNumber}`} className="rounded-xl bg-gray-50 p-3"><div className="flex flex-wrap justify-between gap-2"><p className="text-theme-sm font-semibold text-gray-800">{item.meetingNumber}. {item.topic}</p><span className="text-theme-xs font-semibold text-gray-600">{formatUiLabel(item.status)}</span></div><p className="mt-1 text-theme-xs text-gray-500">{formatDate(item.sessionDate)}{item.note ? ` / ${item.note}` : ""}</p></div>)}
                   </div>
                 </details>
               </div>
            </article>
          );
          })}
        </section>
        {summariesWithAttendance.length === 0 ? <EmptyState icon="presensi" title="Belum ada presensi tercatat" description="Rekap presensi akan muncul setelah guru menginput kehadiran kelas." /> : null}
        {summariesWithoutAttendance.length > 0 ? <NoAttendanceList summaries={summariesWithoutAttendance} /> : null}
        </>
      ) : (
        <EmptyState icon="student" title="Belum ada anak terhubung" description="Akun wali akan menampilkan presensi setelah admin menghubungkan data anak." />
      )}
    </main>
  );
}

function resolveMonthRange(month?: string) {
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { month: "", from: undefined, to: undefined };
  const from = new Date(`${month}-01T00:00:00.000Z`);
  const to = new Date(from);
  to.setUTCMonth(to.getUTCMonth() + 1);
  return { month, from, to };
}

function AttendanceFilter({ month, childId }: { month: string; childId?: string }) {
  const resetHref = childId ? `/wali/presensi?anak=${encodeURIComponent(childId)}` : "/wali/presensi";
  return <form method="get" className="tailadmin-card flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between"><label className="grid gap-1"><span className="text-theme-xs font-medium text-gray-600">Periode presensi</span><input type="month" name="month" defaultValue={month} className="tailadmin-input" /></label>{childId ? <input type="hidden" name="anak" value={childId} /> : null}<div className="flex flex-wrap gap-2"><button type="submit" className="tailadmin-button-primary px-4 py-2">Terapkan</button>{month ? <Link href={resetHref} className="tailadmin-button-outline px-4 py-2">Reset</Link> : null}</div></form>;
}

function getAttendanceStatus(rate: number) {
  if (rate >= 90) {
    return { label: "Sangat baik", className: "bg-success-50 text-success-700" };
  }

  if (rate >= 75) {
    return { label: "Cukup baik", className: "bg-limo-blue-50 text-limo-blue-700" };
  }

  return { label: "Perlu perhatian", className: "bg-warning-50 text-warning-700" };
}

function NoAttendanceList({ summaries }: { summaries: Awaited<ReturnType<typeof getStudentSummary>>[] }) {
  return (
    <section className="tailadmin-card p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Belum Ada Presensi</h2>
          <p className="mt-1 text-theme-sm text-gray-500">Anak berikut sudah terhubung, tetapi belum memiliki presensi yang dicatat guru.</p>
        </div>
        <span className="text-theme-xs font-semibold text-gray-400">{summaries.length} anak</span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {summaries.map((summary) => (
          <div key={summary.siswa.id} className="min-w-0 rounded-2xl border border-gray-100 bg-gray-50 p-3">
            <p className="truncate text-theme-sm font-semibold text-gray-900" title={summary.siswa.name}>{summary.siswa.name}</p>
            <p className="mt-1 truncate text-theme-xs text-gray-500">{summary.siswa.nomorInduk} / {summary.siswa.program.name}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PresenceHero({ childCount, total, rate }: { childCount: number; total: number; rate: number | null }) {
  return (
    <div className="grid w-full min-w-0 grid-cols-3 gap-2 rounded-2xl border border-gray-100 bg-white/80 p-3 shadow-theme-xs lg:w-auto lg:min-w-64">
      <PresenceMetric label="Anak" value={childCount} />
      <PresenceMetric label="Sesi" value={total} />
      <PresenceMetric label="Tingkat" value={rate === null ? "-" : `${rate}%`} />
    </div>
  );
}

function PresenceMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-2xl bg-gray-50 p-3 text-center">
      <p className="truncate text-xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 truncate text-[11px] font-semibold text-gray-600">{label}</p>
    </div>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(value);
}
