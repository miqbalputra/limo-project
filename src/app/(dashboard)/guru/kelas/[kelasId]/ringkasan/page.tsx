import { requireActor, requireRole } from "@/server/auth/session";
import { getClassSummary } from "@/server/services/report-service";

export const metadata = { title: "Ringkasan Kelas" };

export default async function GuruKelasRingkasanPage({ params }: { params: Promise<{ kelasId: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { kelasId } = await params;
  const summary = await getClassSummary(actor, kelasId);

  return (
    <main className="space-y-6">
      <div>
        <p className="text-theme-sm font-semibold text-brand-500">{summary.kelas.program.name} / {summary.kelas.level.name}</p>
        <h1 className="mt-1 tailadmin-page-title">Ringkasan {summary.kelas.name}</h1>
      </div>
      <section className="tailadmin-card overflow-hidden">
        <div className="hidden grid-cols-[1fr_120px_160px_120px] gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-theme-sm font-semibold text-gray-600 md:grid">
          <span>Siswa</span><span>Kehadiran</span><span>Pemahaman</span><span>Nilai</span>
        </div>
        {summary.rows.map((row) => (
          <article key={row.id} className="grid gap-2 border-b border-gray-200 px-5 py-4 last:border-b-0 md:grid-cols-[1fr_120px_160px_120px]">
            <div><p className="font-semibold text-gray-900">{row.name}</p><p className="text-theme-sm text-gray-500">{row.nomorInduk}</p></div>
            <p className="text-theme-sm text-gray-700">{row.hadir}/{row.totalPresensi}</p>
            <p className="text-theme-sm text-gray-700">{row.averageProgress === null ? "-" : row.averageProgress.toFixed(1)}</p>
            <p className="text-theme-sm text-gray-700">{row.averageScore === null ? "-" : row.averageScore.toFixed(1)}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
