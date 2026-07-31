import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { listWaliTaskChildren } from "@/server/services/online-exam-service";
import { DashboardHero, EmptyState, ProgressBar } from "@/components/dashboard/dashboard-widgets";

export const metadata = { title: "Tugas Anak" };

export default async function WaliTugasPage() {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { children } = await listWaliTaskChildren(actor);
  const totalTasks = children.reduce((sum, child) => sum + child.taskCount, 0);
  const pendingTasks = children.reduce((sum, child) => sum + child.notStartedCount + child.inProgressCount, 0);
  const reviewTasks = children.reduce((sum, child) => sum + child.reviewCount, 0);
  const finalTasks = children.reduce((sum, child) => sum + child.finalCount, 0);

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Belajar di Rumah"
        title="Tugas Anak"
        description="Pilih anak untuk melihat tugas atau ujian online yang bisa dikerjakan langsung melalui akun wali. Orang tua mendampingi, anak tetap menjawab sendiri."
        aside={<HeroStats total={totalTasks} pending={pendingTasks} review={reviewTasks} final={finalTasks} />}
      />

      {children.length > 0 ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {children.map((child) => {
            const doneRate = child.taskCount > 0 ? Math.round((child.finalCount / child.taskCount) * 100) : 0;

            return (
              <article key={child.id} className="tailadmin-card min-w-0 p-5 transition hover:-translate-y-0.5 hover:shadow-theme-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-lg font-semibold text-brand-600">{child.name.slice(0, 1).toUpperCase()}</span>
                    <div className="min-w-0">
                      <p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{child.nomorInduk} / {child.program.name}</p>
                      <h2 className="mt-1 truncate text-lg font-semibold text-gray-900" title={child.name}>{child.name}</h2>
                      <p className="mt-1 text-theme-sm text-gray-500">{child.taskCount} tugas tersedia</p>
                    </div>
                  </div>
                  <Link href={`/wali/tugas/${child.id}`} className="tailadmin-button-primary shrink-0 px-4 py-2">Lihat Tugas</Link>
                </div>

                <div className="mt-5 grid grid-cols-4 gap-2 rounded-2xl bg-gray-50 p-3 text-center">
                  <MiniStat label="Belum" value={child.notStartedCount} />
                  <MiniStat label="Proses" value={child.inProgressCount} />
                  <MiniStat label="Review" value={child.reviewCount} />
                  <MiniStat label="Selesai" value={child.finalCount} />
                </div>
                <div className="mt-5">
                  <div className="mb-2 flex justify-between text-theme-xs text-gray-500"><span>Progress tugas selesai</span><span className="font-semibold text-gray-700">{doneRate}%</span></div>
                  <ProgressBar value={doneRate} tone={doneRate >= 100 ? "success" : "brand"} />
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState icon="student" title="Belum ada anak terhubung" description="Tugas anak akan tampil setelah admin menghubungkan data anak ke akun wali." />
      )}
    </main>
  );
}

function HeroStats({ total, pending, review, final }: { total: number; pending: number; review: number; final: number }) {
  return (
    <div className="grid min-w-80 grid-cols-4 gap-2 rounded-2xl border border-gray-100 bg-white/80 p-3 shadow-theme-xs">
      <MiniStat label="Total" value={total} />
      <MiniStat label="Perlu" value={pending} />
      <MiniStat label="Review" value={review} />
      <MiniStat label="Final" value={final} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="min-w-0 rounded-2xl bg-white p-3 shadow-theme-xs"><p className="truncate text-xl font-semibold text-gray-900">{value}</p><p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p></div>;
}
