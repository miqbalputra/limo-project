import { requireActor, requireRole } from "@/server/auth/session";
import { getStudentSummary } from "@/server/services/report-service";

export const metadata = { title: "Ringkasan Progres" };

export default async function WaliProgresDetailPage({ params }: { params: Promise<{ siswaId: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { siswaId } = await params;
  const summary = await getStudentSummary(actor, siswaId);

  return (
    <main className="space-y-6">
      <div>
        <p className="text-theme-sm font-semibold text-brand-500">{summary.siswa.nomorInduk} / {summary.siswa.program.name}</p>
        <h1 className="mt-1 tailadmin-page-title">{summary.siswa.name}</h1>
      </div>
      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Rata-rata Pemahaman" value={summary.averageProgress === null ? "-" : summary.averageProgress.toFixed(1)} />
        <Metric label="Rata-rata Nilai" value={summary.averageScore === null ? "-" : summary.averageScore.toFixed(1)} />
        <Metric label="Total Hadir" value={String((summary.attendance.HADIR || 0) + (summary.attendance.TERLAMBAT || 0))} />
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Grafik Pemahaman" items={summary.progressTimeline.slice().reverse().map((item) => ({ label: item.sesiKelas.topic, value: item.understandingScore, max: 5 }))} />
        <ChartCard title="Grafik Nilai" items={summary.examResults.slice().reverse().map((item) => ({ label: item.ujian.title, value: Number(item.totalScore || 0), max: 100 }))} />
        <ChartCard title="Kehadiran Bulanan" items={summary.monthlyAttendance.map((item) => ({ label: item.month, value: item.hadir, max: item.total }))} />
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="tailadmin-card p-5">
          <h2 className="font-semibold text-gray-900">Timeline Progres</h2>
          <div className="mt-4 space-y-3">
            {summary.progressTimeline.map((item) => (
              <article key={`${item.sesiKelas.sessionDate.toISOString()}-${item.category}`} className="min-w-0 rounded-xl bg-gray-50 p-3">
                <p className="break-words font-semibold text-gray-900">{item.sesiKelas.topic} / Skor {item.understandingScore}</p>
                <p className="text-theme-sm text-gray-500">{item.publicNote || "Belum ada catatan untuk wali."}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="tailadmin-card p-5">
          <h2 className="font-semibold text-gray-900">Nilai Final</h2>
          <div className="mt-4 space-y-3">
            {summary.examResults.map((item) => (
              <article key={item.ujian.title} className="min-w-0 rounded-xl bg-gray-50 p-3">
                <p className="break-words font-semibold text-gray-900">{item.ujian.title}</p>
                <p className="text-theme-sm text-gray-500">Skor {item.totalScore?.toString() ?? "-"}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="tailadmin-card p-5"><p className="text-theme-sm text-gray-500">{label}</p><p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p></article>;
}

function ChartCard({ title, items }: { title: string; items: { label: string; value: number; max: number }[] }) {
  return (
    <article className="tailadmin-card min-w-0 p-5">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.length > 0 ? items.map((item) => {
          const percent = item.max > 0 ? Math.min(100, Math.round((item.value / item.max) * 100)) : 0;
          return (
            <div key={`${item.label}-${item.value}`}>
              <div className="mb-1 flex min-w-0 items-center justify-between gap-3 text-theme-xs text-gray-500"><span className="min-w-0 truncate">{item.label}</span><span className="shrink-0 font-semibold text-gray-700">{item.value}/{item.max}</span></div>
              <div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${percent}%` }} /></div>
            </div>
          );
        }) : <p className="text-theme-sm text-gray-500">Belum ada data grafik.</p>}
      </div>
    </article>
  );
}
