import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { listMyKelas } from "@/server/services/lms-service";
import { DashboardHero, EmptyState, ProgressBar } from "@/components/dashboard/dashboard-widgets";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";

export const metadata = { title: "Kelas Saya" };

export default async function GuruKelasPage() {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { items } = await listMyKelas(actor);
  const totalStudents = items.reduce((sum, item) => sum + item._count.enrollments, 0);
  const totalSessions = items.reduce((sum, item) => sum + item._count.sessions, 0);
  const totalMaterials = items.reduce((sum, item) => sum + item._count.materi, 0);

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Ruang Mengajar"
        title="Kelas Saya"
        description="Lihat kelas yang ditugaskan, jumlah siswa aktif, kesiapan sesi/materi, dan akses cepat ke presensi, progres, materi, serta ringkasan kelas."
        aside={<ClassHero totalClasses={items.length} totalStudents={totalStudents} totalSessions={totalSessions} />}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Kelas Aktif" value={items.length} helper="Ditugaskan ke akun guru" icon="classes" tone="brand" />
        <SummaryCard label="Siswa Aktif" value={totalStudents} helper="Total enrollment aktif" icon="student" tone="success" />
        <SummaryCard label="Materi" value={totalMaterials} helper="Materi pembelajaran tersedia" icon="materials" tone="warning" />
      </section>

      {items.length > 0 ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {items.map((item) => {
            const readiness = Math.min(100, Math.round(((item._count.sessions > 0 ? 50 : 0) + (item._count.materi > 0 ? 30 : 0) + (item._count.enrollments > 0 ? 20 : 0))));
            const status = readiness >= 80 ? { label: "Siap mengajar", className: "bg-success-50 text-success-700" } : readiness >= 50 ? { label: "Perlu dilengkapi", className: "bg-warning-50 text-warning-700" } : { label: "Setup awal", className: "bg-error-50 text-error-700" };

            return (
              <article key={item.id} className="tailadmin-card min-w-0 p-5 transition hover:-translate-y-0.5 hover:shadow-theme-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600"><DashboardIcon name="classes" className="size-6" /></span>
                    <div className="min-w-0">
                      <p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{item.program.name} / {item.level.name}</p>
                      <h2 className="mt-1 truncate text-lg font-semibold text-gray-900" title={item.name}>{item.name}</h2>
                      <p className="mt-1 text-theme-sm text-gray-500">{item._count.enrollments} siswa aktif</p>
                    </div>
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1 text-theme-xs font-semibold ${status.className}`}>{status.label}</span>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-gray-50 p-3 text-center">
                  <MiniStat label="Siswa" value={item._count.enrollments} />
                  <MiniStat label="Sesi" value={item._count.sessions} />
                  <MiniStat label="Materi" value={item._count.materi} />
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex justify-between text-theme-xs text-gray-500"><span>Kesiapan kelas</span><span className="font-semibold text-gray-700">{readiness}%</span></div>
                  <ProgressBar value={readiness} tone={readiness >= 80 ? "success" : "warning"} />
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href={`/guru/kelas/${item.id}`} className="tailadmin-button-primary px-4 py-2">Kelola Kelas</Link>
                  <Link href={`/guru/kelas/${item.id}/ringkasan`} className="tailadmin-button-outline px-4 py-2">Ringkasan</Link>
                  <Link href="/guru/presensi" className="tailadmin-button-outline px-4 py-2">Presensi</Link>
                  <Link href="/guru/progres" className="tailadmin-button-outline px-4 py-2">Progres</Link>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState icon="classes" title="Belum ada kelas aktif" description="Kelas yang ditugaskan admin akan tampil di sini. Hubungi admin LIMO jika jadwal mengajar belum muncul." />
      )}
    </main>
  );
}

function ClassHero({ totalClasses, totalStudents, totalSessions }: { totalClasses: number; totalStudents: number; totalSessions: number }) {
  return (
    <div className="grid min-w-72 grid-cols-3 gap-2 rounded-2xl border border-gray-100 bg-white/80 p-3 shadow-theme-xs">
      <MiniStat label="Kelas" value={totalClasses} />
      <MiniStat label="Siswa" value={totalStudents} />
      <MiniStat label="Sesi" value={totalSessions} />
    </div>
  );
}

function SummaryCard({ label, value, helper, icon, tone }: { label: string; value: number; helper: string; icon: "classes" | "student" | "materials"; tone: "brand" | "success" | "warning" }) {
  const classes = {
    brand: "bg-brand-50 text-brand-600",
    success: "bg-success-50 text-success-700",
    warning: "bg-warning-50 text-warning-700",
  }[tone];

  return (
    <article className="tailadmin-card min-w-0 p-5">
      <span className={`grid size-11 place-items-center rounded-xl ${classes}`}><DashboardIcon name={icon} className="size-5" /></span>
      <p className="mt-4 text-3xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-theme-sm font-semibold text-gray-700">{label}</p>
      <p className="mt-1 text-theme-xs text-gray-500">{helper}</p>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="min-w-0 rounded-2xl bg-white p-3 shadow-theme-xs"><p className="truncate text-xl font-semibold text-gray-900">{value}</p><p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p></div>;
}
