import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { getStudentSummary } from "@/server/services/report-service";
import { DashboardHero, EmptyState, ProgressBar } from "@/components/dashboard/dashboard-widgets";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { isFeatureEnabled } from "@/server/features/feature-flags";

export const metadata = { title: "Ringkasan Progres" };

export default async function WaliProgresDetailPage({ params }: { params: Promise<{ siswaId: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { siswaId } = await params;
  const summary = await getStudentSummary(actor, siswaId);
  const hadir = (summary.attendance.HADIR || 0) + (summary.attendance.TERLAMBAT || 0);
  const totalAttendance = Object.values(summary.attendance).reduce((sum, value) => sum + value, 0);
  const attendanceRate = totalAttendance ? Math.round((hadir / totalAttendance) * 100) : null;
  const latestProgress = summary.progressTimeline[0];
  const latestExam = summary.examResults[0];

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow={`${summary.siswa.nomorInduk} / ${summary.siswa.program.name}`}
        title={summary.siswa.name}
        description="Ringkasan lengkap progres belajar, nilai final, kehadiran bulanan, dan catatan guru untuk wali murid."
        actions={<><Link href="/wali/progres" className="tailadmin-button-outline px-4 py-2">Kembali</Link><Link href={`/wali/progres/${siswaId}/modul`} className="tailadmin-button-primary px-4 py-2">Lihat Modul</Link>{isFeatureEnabled("assignmentsEnabled") ? <Link href={`/wali/progres/${siswaId}/tugas`} className="tailadmin-button-outline px-4 py-2">Lihat Tugas</Link> : null}<Link href="/wali/nilai" className="tailadmin-button-outline gap-2 px-4 py-2"><DashboardIcon name="exam" className="size-4" />Lihat Nilai</Link></>}
        aside={<div className="grid min-w-72 grid-cols-3 gap-2 rounded-2xl border border-gray-100 bg-white/80 p-3 shadow-theme-xs"><MetricMini label="Pemahaman" value={summary.averageProgress === null ? "-" : summary.averageProgress.toFixed(1)} /><MetricMini label="Nilai" value={summary.averageScore === null ? "-" : summary.averageScore.toFixed(0)} /><MetricMini label="Hadir" value={attendanceRate === null ? "-" : `${attendanceRate}%`} /></div>}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Rata-rata Pemahaman" value={summary.averageProgress === null ? "-" : summary.averageProgress.toFixed(1)} />
        <Metric label="Rata-rata Nilai" value={summary.averageScore === null ? "-" : summary.averageScore.toFixed(1)} />
        <Metric label="Total Hadir" value={String(hadir)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="tailadmin-card p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><DashboardIcon name="progress" className="size-5" /></span>
            <div className="min-w-0">
              <h2 className="font-semibold text-gray-900">Catatan Progres Terbaru</h2>
              <p className="mt-2 text-theme-sm leading-6 text-gray-500">{latestProgress?.publicNote || "Belum ada catatan progres terbaru dari guru."}</p>
            </div>
          </div>
        </article>
        <article className="tailadmin-card p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-success-50 text-success-700"><DashboardIcon name="exam" className="size-5" /></span>
            <div className="min-w-0">
              <h2 className="font-semibold text-gray-900">Nilai Final Terbaru</h2>
              <p className="mt-2 text-theme-sm leading-6 text-gray-500">{latestExam ? `${latestExam.ujian.title}: skor ${latestExam.totalScore?.toString() ?? "-"}` : "Belum ada nilai final terbaru."}</p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Grafik Pemahaman" items={summary.progressTimeline.slice().reverse().map((item, index) => ({ id: `progress-${item.sesiKelas.sessionDate.toISOString()}-${item.category ?? "umum"}-${index}`, label: item.sesiKelas.topic, value: item.understandingScore, max: 5 }))} />
        <ChartCard title="Grafik Nilai" items={summary.examResults.slice().reverse().map((item, index) => ({ id: `exam-${item.updatedAt.toISOString()}-${index}`, label: item.ujian.title, value: Number(item.totalScore || 0), max: 100 }))} />
        <ChartCard title="Kehadiran Bulanan" items={summary.monthlyAttendance.map((item) => ({ label: item.month, value: item.hadir, max: item.total }))} />
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="tailadmin-card p-5">
          <h2 className="font-semibold text-gray-900">Timeline Progres</h2>
          <div className="mt-4 space-y-3">
            {summary.progressTimeline.length > 0 ? summary.progressTimeline.map((item, index) => (
              <article key={`${item.sesiKelas.sessionDate.toISOString()}-${item.category ?? "umum"}-${index}`} className="min-w-0 rounded-xl bg-gray-50 p-3">
                <p className="break-words font-semibold text-gray-900">{item.sesiKelas.topic} / Skor {item.understandingScore}</p>
                <p className="text-theme-sm text-gray-500">{item.publicNote || "Belum ada catatan untuk wali."}</p>
              </article>
            )) : <EmptyState icon="progress" title="Belum ada timeline progres" description="Timeline akan muncul setelah guru menginput progres belajar." />}
          </div>
        </div>
        <div className="tailadmin-card p-5">
          <h2 className="font-semibold text-gray-900">Nilai Final</h2>
          <div className="mt-4 space-y-3">
            {summary.examResults.length > 0 ? summary.examResults.map((item, index) => (
              <article key={`${item.updatedAt.toISOString()}-${item.ujian.title}-${index}`} className="min-w-0 rounded-xl bg-gray-50 p-3">
                <p className="break-words font-semibold text-gray-900">{item.ujian.title}</p>
                <p className="text-theme-sm text-gray-500">Skor {item.totalScore?.toString() ?? "-"}</p>
              </article>
            )) : <EmptyState icon="exam" title="Belum ada nilai final" description="Nilai akan muncul setelah guru memfinalkan hasil ujian." />}
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="tailadmin-card p-5"><p className="text-theme-sm text-gray-500">{label}</p><p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p></article>;
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-2xl bg-gray-50 p-3 text-center"><p className="truncate text-lg font-semibold text-gray-900">{value}</p><p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p></div>;
}

function ChartCard({ title, items }: { title: string; items: { id?: string; label: string; value: number; max: number }[] }) {
  return (
    <article className="tailadmin-card min-w-0 p-5">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.length > 0 ? items.map((item, index) => {
          const percent = item.max > 0 ? Math.min(100, Math.round((item.value / item.max) * 100)) : 0;
          return (
            <div key={item.id ?? `${item.label}-${item.value}-${item.max}-${index}`}>
              <div className="mb-1 flex min-w-0 items-center justify-between gap-3 text-theme-xs text-gray-500"><span className="min-w-0 truncate">{item.label}</span><span className="shrink-0 font-semibold text-gray-700">{item.value}/{item.max}</span></div>
              <ProgressBar value={percent} />
            </div>
          );
        }) : <p className="text-theme-sm text-gray-500">Belum ada data grafik.</p>}
      </div>
    </article>
  );
}
