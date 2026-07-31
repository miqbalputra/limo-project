import { requireActor, requireRole } from "@/server/auth/session";
import { getActorDashboardContext } from "@/server/dal/actor-dal";
import { getStudentSummary } from "@/server/services/report-service";
import { DashboardHero, EmptyState, ProgressBar } from "@/components/dashboard/dashboard-widgets";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";

export const metadata = { title: "Presensi Anak" };

export default async function WaliPresensiPage() {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const context = await getActorDashboardContext(actor);
  const summaries = context.role === "WALI"
    ? await Promise.all(context.children.map((child) => getStudentSummary(actor, child.id)))
    : [];
  const totals = summaries.reduce((result, summary) => {
    const hadir = (summary.attendance.HADIR || 0) + (summary.attendance.TERLAMBAT || 0);
    const total = Object.values(summary.attendance).reduce((sum, value) => sum + value, 0);

    return { hadir: result.hadir + hadir, total: result.total + total };
  }, { hadir: 0, total: 0 });
  const overallRate = totals.total ? Math.round((totals.hadir / totals.total) * 100) : null;
  const summariesWithAttendance = summaries.filter((summary) => Object.values(summary.attendance).reduce((sum, value) => sum + value, 0) > 0);
  const summariesWithoutAttendance = summaries.filter((summary) => Object.values(summary.attendance).reduce((sum, value) => sum + value, 0) === 0);

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Kehadiran"
        title="Presensi Anak"
        description="Lihat ringkasan kehadiran setiap anak, jumlah sesi tercatat, dan tren bulanan yang mudah dipahami."
        aside={<PresenceHero childCount={summaries.length} total={totals.total} rate={overallRate} />}
      />

      {summaries.length > 0 ? (
        <>
        <section className="grid gap-4 xl:grid-cols-2">
          {summariesWithAttendance.map((summary) => {
          const hadir = (summary.attendance.HADIR || 0) + (summary.attendance.TERLAMBAT || 0);
          const izin = summary.attendance.IZIN || 0;
          const sakit = summary.attendance.SAKIT || 0;
          const alpa = summary.attendance.ALPA || 0;
          const total = Object.values(summary.attendance).reduce((sum, value) => sum + value, 0);
          const rate = total ? Math.round((hadir / total) * 100) : 0;
          const status = getAttendanceStatus(rate);

          return (
            <article key={summary.siswa.id} className="tailadmin-card min-w-0 p-5 transition hover:-translate-y-0.5 hover:shadow-theme-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-success-50 text-lg font-semibold text-success-700">{summary.siswa.name.slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0">
                    <p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{summary.siswa.nomorInduk} / {summary.siswa.program.name}</p>
                    <h2 className="mt-1 truncate text-lg font-semibold text-gray-900" title={summary.siswa.name}>{summary.siswa.name}</h2>
                    <p className="mt-1 text-theme-xs text-gray-500">{total} sesi tercatat</p>
                  </div>
                </div>
                <span className={`w-fit rounded-full px-3 py-1 text-theme-xs font-semibold ${status.className}`}>{status.label}</span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5">
                <PresenceMetric label="Hadir" value={hadir} />
                <PresenceMetric label="Izin" value={izin} />
                <PresenceMetric label="Sakit" value={sakit} />
                <PresenceMetric label="Alpa" value={alpa} />
                <PresenceMetric label="Total" value={total} />
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-theme-xs text-gray-500"><span>Attendance rate</span><span className="font-semibold text-gray-700">{rate}%</span></div>
                  <ProgressBar value={rate} tone={rate >= 80 ? "success" : "warning"} />
                </div>
                {summary.monthlyAttendance.length > 0 ? summary.monthlyAttendance.map((item) => {
                  const percent = item.total ? Math.round((item.hadir / item.total) * 100) : 0;
                  return (
                    <div key={item.month} className="rounded-2xl bg-gray-50 p-3">
                      <div className="mb-2 flex justify-between text-theme-xs text-gray-500"><span>{item.month}</span><span className="font-semibold text-gray-700">{item.hadir}/{item.total}</span></div>
                      <ProgressBar value={percent} tone={percent >= 80 ? "success" : "warning"} />
                    </div>
                  );
                }) : (
                  <div className="flex items-start gap-3 rounded-2xl bg-gray-50 p-4">
                    <DashboardIcon name="presensi" className="mt-0.5 size-5 shrink-0 text-gray-400" />
                    <p className="text-theme-sm leading-6 text-gray-500">Belum ada data presensi. Rekap akan muncul setelah guru menginput presensi kelas.</p>
                  </div>
                )}
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

function getAttendanceStatus(rate: number) {
  if (rate >= 90) {
    return { label: "Sangat baik", className: "bg-success-50 text-success-700" };
  }

  if (rate >= 75) {
    return { label: "Cukup baik", className: "bg-brand-50 text-brand-600" };
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
    <div className="grid min-w-64 grid-cols-3 gap-2 rounded-2xl border border-gray-100 bg-white/80 p-3 shadow-theme-xs">
      <PresenceMetric label="Anak" value={childCount} />
      <PresenceMetric label="Sesi" value={total} />
      <PresenceMetric label="Rate" value={rate === null ? "-" : `${rate}%`} />
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
