import { requireActor, requireRole } from "@/server/auth/session";
import { getClassStudentHistory, getClassSummary } from "@/server/services/report-service";
import { GuruStudentHistory } from "@/components/dashboard/guru-student-history";

export const metadata = { title: "Ringkasan Kelas" };

export default async function GuruKelasRingkasanPage({ params, searchParams }: { params: Promise<{ kelasId: string }>; searchParams: Promise<{ siswaId?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { kelasId } = await params;
  const { siswaId } = await searchParams;
  const summary = await getClassSummary(actor, kelasId);
  const studentHistory = siswaId ? await getClassStudentHistory(actor, kelasId, siswaId) : null;

  return (
    <main className="space-y-6">
      <div>
        <p className="text-theme-sm font-semibold text-brand-500">{summary.kelas.program.name} / {summary.kelas.level.name}</p>
        <h1 className="mt-1 tailadmin-page-title">Ringkasan {summary.kelas.name}</h1>
      </div>
      {studentHistory ? <GuruStudentHistory history={studentHistory} /> : null}
      <section className="tailadmin-card overflow-hidden">
        <div className="hidden grid-cols-[1fr_120px_160px_120px] gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-theme-sm font-semibold text-gray-600 md:grid">
          <span>Siswa</span><span>Kehadiran</span><span>Pemahaman</span><span>Nilai</span>
        </div>
        {summary.rows.map((row) => (
          <article key={row.id} className="grid gap-2 border-b border-gray-200 px-5 py-4 last:border-b-0 md:grid-cols-[1fr_120px_160px_120px]">
            <div><p className="font-semibold text-gray-900">{row.name}</p><p className="text-theme-sm text-gray-500">{row.nomorInduk}</p></div>
            <BarValue value={row.attendanceRate} label={`${row.hadir}/${row.totalPresensi}`} max={100} />
            <BarValue value={row.averageProgress} label={row.averageProgress === null ? "-" : row.averageProgress.toFixed(1)} max={5} />
            <BarValue value={row.averageScore} label={row.averageScore === null ? "-" : row.averageScore.toFixed(1)} max={100} />
          </article>
        ))}
      </section>
    </main>
  );
}

function BarValue({ value, label, max }: { value: number | null; label: string; max: number }) {
  const percent = value === null || max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));

  return (
    <div>
      <p className="mb-1 text-theme-sm font-semibold text-gray-700">{label}</p>
      <div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${percent}%` }} /></div>
    </div>
  );
}
