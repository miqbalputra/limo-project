import { requireActor, requireRole } from "@/server/auth/session";
import { getWaliExamHistory } from "@/server/services/report-service";
import { DashboardHero, EmptyState, ProgressBar } from "@/components/dashboard/dashboard-widgets";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";

export const metadata = { title: "Riwayat Nilai" };

export default async function WaliNilaiPage() {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { children } = await getWaliExamHistory(actor);
  const childrenWithScores = children.filter((child) => child.hasilUjian.length > 0);
  const childrenWithoutScores = children.filter((child) => child.hasilUjian.length === 0);
  const allScores = children.flatMap((child) => child.hasilUjian.map((result) => Number(result.totalScore || 0)));
  const averageScore = allScores.length ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length : null;
  const bestScore = allScores.length ? Math.max(...allScores) : null;
  const latestResult = children.flatMap((child) => child.hasilUjian.map((result) => ({ childName: child.name, result }))).sort((left, right) => right.result.updatedAt.getTime() - left.result.updatedAt.getTime())[0];

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Evaluasi Belajar"
        title="Riwayat Nilai"
        description="Pantau nilai final anak, ujian terakhir, rata-rata capaian, dan kelas terkait tanpa harus membaca tabel panjang."
        aside={<ScoreHero childCount={children.length} resultCount={allScores.length} averageScore={averageScore} bestScore={bestScore} />}
      />

      {latestResult ? (
        <section className="tailadmin-card overflow-hidden p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-success-50 text-success-700"><DashboardIcon name="exam" className="size-6" /></span>
              <div className="min-w-0">
                <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">Nilai terbaru</p>
                <h2 className="mt-1 truncate text-lg font-semibold text-gray-900" title={latestResult.result.ujian.title}>{latestResult.result.ujian.title}</h2>
                <p className="mt-1 text-theme-sm text-gray-500">{latestResult.childName} / {latestResult.result.ujian.kelas.program.name} - {latestResult.result.ujian.kelas.name}</p>
              </div>
            </div>
            <div className="min-w-32 rounded-2xl bg-gray-50 p-4 text-center">
              <p className="text-3xl font-semibold text-gray-900">{latestResult.result.totalScore?.toString() ?? "-"}</p>
              <p className="mt-1 text-theme-xs text-gray-500">Skor final</p>
            </div>
          </div>
        </section>
      ) : null}

      {children.length > 0 ? (
        <>
        <section className="grid gap-4 xl:grid-cols-2">
          {childrenWithScores.map((child) => {
            const scores = child.hasilUjian.map((result) => Number(result.totalScore || 0));
            const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
            const latest = child.hasilUjian[0];
            const status = getScoreStatus(average);

            return (
              <article key={child.id} className="tailadmin-card min-w-0 p-5 transition hover:-translate-y-0.5 hover:shadow-theme-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-lg font-semibold text-brand-600">{child.name.slice(0, 1).toUpperCase()}</span>
                    <div className="min-w-0">
                      <p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{child.nomorInduk} / {child.program.name}</p>
                      <h2 className="mt-1 truncate text-lg font-semibold text-gray-900" title={child.name}>{child.name}</h2>
                      <p className="mt-1 text-theme-xs text-gray-500">{child.hasilUjian.length} nilai final / status {child.status}</p>
                    </div>
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1 text-theme-xs font-semibold ${status.className}`}>{status.label}</span>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <ScoreMetric label="Rata-rata" value={average.toFixed(0)} />
                  <ScoreMetric label="Terbaru" value={latest.totalScore?.toString() ?? "-"} />
                  <ScoreMetric label="Tertinggi" value={Math.max(...scores).toFixed(0)} />
                </div>

                <div className="mt-5 space-y-3">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-theme-xs text-gray-500"><span>Rata-rata nilai</span><span className="font-semibold text-gray-700">{average.toFixed(0)}/100</span></div>
                    <ProgressBar value={average} tone={average >= 80 ? "success" : average >= 70 ? "brand" : "warning"} />
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-gray-100">
                    {child.hasilUjian.slice(0, 3).map((result) => (
                      <div key={result.id} className="grid grid-cols-[1fr_auto] gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0">
                        <div className="min-w-0">
                          <p className="truncate text-theme-sm font-semibold text-gray-900" title={result.ujian.title}>{result.ujian.title}</p>
                          <p className="mt-1 text-theme-xs text-gray-500">{result.ujian.kelas.name} / {formatDate(result.ujian.examDate)}</p>
                        </div>
                        <p className="self-center text-lg font-semibold text-success-700">{result.totalScore?.toString() ?? "-"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
        {childrenWithScores.length === 0 ? <EmptyState icon="exam" title="Belum ada nilai final" description="Nilai akan tampil setelah guru menginput dan memfinalkan hasil ujian." /> : null}
        {childrenWithoutScores.length > 0 ? <NoScoreList items={childrenWithoutScores} /> : null}
        </>
      ) : (
        <EmptyState icon="student" title="Belum ada anak terhubung" description="Akun wali akan menampilkan nilai setelah admin menghubungkan data anak." />
      )}
    </main>
  );
}

function ScoreHero({ childCount, resultCount, averageScore, bestScore }: { childCount: number; resultCount: number; averageScore: number | null; bestScore: number | null }) {
  return (
    <div className="grid min-w-72 grid-cols-4 gap-2 rounded-2xl border border-gray-100 bg-white/80 p-3 shadow-theme-xs">
      <ScoreMetric label="Anak" value={childCount} />
      <ScoreMetric label="Hasil" value={resultCount} />
      <ScoreMetric label="Rata-rata" value={averageScore === null ? "-" : averageScore.toFixed(0)} />
      <ScoreMetric label="Tertinggi" value={bestScore === null ? "-" : bestScore.toFixed(0)} />
    </div>
  );
}

function ScoreMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-2xl bg-gray-50 p-3 text-center">
      <p className="truncate text-xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 truncate text-[11px] font-semibold text-gray-600">{label}</p>
    </div>
  );
}

function getScoreStatus(average: number) {
  if (average >= 85) {
    return { label: "Sangat baik", className: "bg-success-50 text-success-700" };
  }

  if (average >= 70) {
    return { label: "Baik", className: "bg-brand-50 text-brand-600" };
  }

  return { label: "Perlu dukungan", className: "bg-warning-50 text-warning-700" };
}

function NoScoreList({ items }: { items: { id: string; name: string; nomorInduk: string; program: { name: string } }[] }) {
  return (
    <section className="tailadmin-card p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Belum Ada Nilai Final</h2>
          <p className="mt-1 text-theme-sm text-gray-500">Anak berikut sudah terhubung, tetapi belum memiliki hasil ujian final.</p>
        </div>
        <span className="text-theme-xs font-semibold text-gray-400">{items.length} anak</span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((child) => (
          <div key={child.id} className="min-w-0 rounded-2xl border border-gray-100 bg-gray-50 p-3">
            <p className="truncate text-theme-sm font-semibold text-gray-900" title={child.name}>{child.name}</p>
            <p className="mt-1 truncate text-theme-xs text-gray-500">{child.nomorInduk} / {child.program.name}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "Tanggal belum diatur";
}
