import { requireActor, requireRole } from "@/server/auth/session";
import { getActorDashboardContext } from "@/server/dal/actor-dal";
import { getStudentSummary } from "@/server/services/report-service";

export const metadata = { title: "Presensi Anak" };

export default async function WaliPresensiPage() {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const context = await getActorDashboardContext(actor);
  const summaries = context.role === "WALI"
    ? await Promise.all(context.children.map((child) => getStudentSummary(actor, child.id)))
    : [];

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Presensi Anak</h1>
        <p className="mt-2 tailadmin-muted">Rekap kehadiran per anak dan grafik kehadiran bulanan.</p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        {summaries.map((summary) => {
          const hadir = (summary.attendance.HADIR || 0) + (summary.attendance.TERLAMBAT || 0);
          const total = Object.values(summary.attendance).reduce((sum, value) => sum + value, 0);
          const rate = total ? Math.round((hadir / total) * 100) : 0;

          return (
            <article key={summary.siswa.id} className="tailadmin-card p-5">
              <p className="text-theme-sm font-semibold text-brand-500">{summary.siswa.nomorInduk} / {summary.siswa.program.name}</p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900">{summary.siswa.name}</h2>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-theme-xs text-gray-500">
                <span className="rounded-xl bg-gray-50 p-3"><b className="block text-xl text-gray-900">{hadir}</b>Hadir</span>
                <span className="rounded-xl bg-gray-50 p-3"><b className="block text-xl text-gray-900">{total}</b>Total</span>
                <span className="rounded-xl bg-gray-50 p-3"><b className="block text-xl text-gray-900">{rate}%</b>Rate</span>
              </div>
              <div className="mt-4 space-y-3">
                {summary.monthlyAttendance.length > 0 ? summary.monthlyAttendance.map((item) => {
                  const percent = item.total ? Math.round((item.hadir / item.total) * 100) : 0;
                  return (
                    <div key={item.month}>
                      <div className="mb-1 flex justify-between text-theme-xs text-gray-500"><span>{item.month}</span><span>{item.hadir}/{item.total}</span></div>
                      <div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-success-500" style={{ width: `${percent}%` }} /></div>
                    </div>
                  );
                }) : <p className="text-theme-sm text-gray-500">Belum ada data presensi.</p>}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
