import { requireActor, requireRole } from "@/server/auth/session";
import { getWaliExamHistory } from "@/server/services/report-service";

export const metadata = { title: "Riwayat Nilai" };

export default async function WaliNilaiPage() {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { children } = await getWaliExamHistory(actor);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Riwayat Nilai</h1>
        <p className="mt-2 tailadmin-muted">Pantau riwayat nilai ujian anak, kelas, tanggal ujian, dan durasi pengerjaan.</p>
      </div>

      <section className="grid gap-4">
        {children.map((child) => (
          <article key={child.id} className="tailadmin-card p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-theme-sm font-semibold text-brand-500">{child.nomorInduk}</p>
                <h2 className="mt-1 text-lg font-semibold text-gray-900">{child.name}</h2>
              </div>
              <p className="text-theme-sm text-gray-500">{child.hasilUjian.length} hasil final</p>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
              <div className="grid grid-cols-[1.4fr_1fr_90px] bg-gray-50 px-4 py-3 text-theme-xs font-semibold uppercase tracking-wide text-gray-500 sm:grid-cols-[1.6fr_1fr_120px_90px]">
                <span>Ujian</span>
                <span>Kelas</span>
                <span className="hidden sm:block">Tanggal</span>
                <span>Skor</span>
              </div>
              {child.hasilUjian.length > 0 ? child.hasilUjian.map((result) => (
                <div key={result.id} className="grid grid-cols-[1.4fr_1fr_90px] border-t border-gray-100 px-4 py-3 text-theme-sm text-gray-700 sm:grid-cols-[1.6fr_1fr_120px_90px]">
                  <span className="font-semibold text-gray-900">{result.ujian.title}</span>
                  <span>{result.ujian.kelas.program.name} / {result.ujian.kelas.name}</span>
                  <span className="hidden sm:block">{result.ujian.examDate?.toISOString().slice(0, 10) ?? "-"}</span>
                  <span className="font-semibold text-success-700">{result.totalScore?.toString() ?? "-"}</span>
                </div>
              )) : (
                <p className="border-t border-gray-100 px-4 py-4 text-theme-sm text-gray-500">Belum ada nilai final.</p>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
