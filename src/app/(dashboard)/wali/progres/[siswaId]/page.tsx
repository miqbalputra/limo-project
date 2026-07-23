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
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="tailadmin-card p-5">
          <h2 className="font-semibold text-gray-900">Timeline Progres</h2>
          <div className="mt-4 space-y-3">
            {summary.progressTimeline.map((item) => (
              <article key={`${item.sesiKelas.sessionDate.toISOString()}-${item.category}`} className="rounded-xl bg-gray-50 p-3">
                <p className="font-semibold text-gray-900">{item.sesiKelas.topic} / Skor {item.understandingScore}</p>
                <p className="text-theme-sm text-gray-500">{item.publicNote || "Belum ada catatan untuk wali."}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="tailadmin-card p-5">
          <h2 className="font-semibold text-gray-900">Nilai Final</h2>
          <div className="mt-4 space-y-3">
            {summary.examResults.map((item) => (
              <article key={item.ujian.title} className="rounded-xl bg-gray-50 p-3">
                <p className="font-semibold text-gray-900">{item.ujian.title}</p>
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
