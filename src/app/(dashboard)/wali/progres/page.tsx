import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { getActorDashboardContext } from "@/server/dal/actor-dal";
import { DashboardHero, EmptyState, ProgressBar } from "@/components/dashboard/dashboard-widgets";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";

export const metadata = { title: "Progres Anak" };

export default async function WaliProgresPage() {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const context = await getActorDashboardContext(actor);
  const children = context.role === "WALI" ? context.children : [];
  const progressScores = children.flatMap((child) => child.progresBelajar.map((item) => item.understandingScore));
  const examScores = children.flatMap((child) => child.hasilUjian.map((item) => Number(item.totalScore || 0)));
  const averageProgress = progressScores.length ? progressScores.reduce((sum, value) => sum + value, 0) / progressScores.length : null;
  const averageScore = examScores.length ? examScores.reduce((sum, value) => sum + value, 0) / examScores.length : null;
  const childrenWithActivity = children.filter((child) => child.progresBelajar.length > 0 || child.hasilUjian.length > 0 || child.presensi.length > 0);
  const childrenWithoutActivity = children.filter((child) => child.progresBelajar.length === 0 && child.hasilUjian.length === 0 && child.presensi.length === 0);

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Perkembangan Anak"
        title="Progres Anak"
        description="Pantau pemahaman, nilai final, dan catatan terbaru dari guru dalam satu halaman ringkas. Pilih anak untuk melihat timeline lengkap."
        aside={<HeroStats childCount={children.length} averageProgress={averageProgress} averageScore={averageScore} />}
      />

      {children.length > 0 ? (
        <>
        <section className="grid gap-4 xl:grid-cols-2">
          {childrenWithActivity.map((child) => {
            const childProgress = child.progresBelajar.length ? child.progresBelajar.reduce((sum, item) => sum + item.understandingScore, 0) / child.progresBelajar.length : null;
            const latestProgress = child.progresBelajar[0];
            const latestScore = child.hasilUjian[0]?.totalScore;
            const attendanceTotal = child.presensi.length;
            const attendancePresent = child.presensi.filter((item) => item.status === "HADIR" || item.status === "TERLAMBAT").length;
            const attendanceRate = attendanceTotal ? Math.round((attendancePresent / attendanceTotal) * 100) : null;
            const status = getProgressStatus(childProgress, attendanceRate);

            return (
              <article key={child.id} className="tailadmin-card min-w-0 p-5 transition hover:-translate-y-0.5 hover:shadow-theme-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-lg font-semibold text-brand-600">{child.name.slice(0, 1).toUpperCase()}</span>
                    <div className="min-w-0">
                      <p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{child.nomorInduk} / {child.program.name}</p>
                      <h2 className="mt-1 truncate text-lg font-semibold text-gray-900" title={child.name}>{child.name}</h2>
                      <p className="mt-1 text-theme-xs text-gray-500">Status siswa: {child.status}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    <span className={`rounded-full px-3 py-1 text-theme-xs font-semibold ${status.className}`}>{status.label}</span>
                    <Link href={`/wali/progres/${child.id}`} className="tailadmin-button-primary px-4 py-2">Detail</Link>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <SmallMetric label="Pemahaman" value={childProgress === null ? "-" : childProgress.toFixed(1)} helper="Skala 1-5" />
                  <SmallMetric label="Nilai Terakhir" value={latestScore?.toString() ?? "-"} helper="Final" />
                  <SmallMetric label="Kehadiran" value={attendanceRate === null ? "-" : `${attendanceRate}%`} helper={`${attendancePresent}/${attendanceTotal} sesi`} />
                </div>

                <div className="mt-5 space-y-3">
                  {childProgress !== null ? <ProgressBar value={childProgress} max={5} tone={childProgress >= 4 ? "success" : "warning"} /> : <div className="h-2 rounded-full bg-gray-100" />}
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <div className="flex items-start gap-3">
                      <DashboardIcon name="progress" className="mt-0.5 size-5 shrink-0 text-gray-400" />
                      <div className="min-w-0">
                        <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">Catatan terbaru</p>
                        <p className="mt-1 text-theme-sm leading-6 text-gray-600">{latestProgress?.publicNote || "Belum ada catatan progres terbaru dari guru."}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
        {childrenWithActivity.length === 0 ? <EmptyState icon="progress" title="Belum ada progres tercatat" description="Kartu progres akan muncul setelah guru menginput pemahaman, presensi, atau nilai anak." /> : null}
        {childrenWithoutActivity.length > 0 ? <InactiveChildren title="Belum Ada Aktivitas Belajar" description="Anak berikut sudah terhubung ke akun wali, tetapi belum memiliki presensi, progres, atau nilai final." items={childrenWithoutActivity} /> : null}
        </>
      ) : (
        <EmptyState icon="student" title="Belum ada anak terhubung" description="Akun wali akan menampilkan progres setelah admin menghubungkan data anak." />
      )}
    </main>
  );
}

function getProgressStatus(progress: number | null, attendanceRate: number | null) {
  if (progress === null && attendanceRate === null) {
    return { label: "Belum ada data", className: "bg-gray-100 text-gray-600" };
  }

  if ((progress !== null && progress >= 4) && (attendanceRate === null || attendanceRate >= 80)) {
    return { label: "Stabil", className: "bg-success-50 text-success-700" };
  }

  if ((progress !== null && progress < 3) || (attendanceRate !== null && attendanceRate < 70)) {
    return { label: "Perlu perhatian", className: "bg-warning-50 text-warning-700" };
  }

  return { label: "Berkembang", className: "bg-brand-50 text-brand-600" };
}

function InactiveChildren({ title, description, items }: { title: string; description: string; items: { id: string; name: string; nomorInduk: string; program: { name: string } }[] }) {
  return (
    <section className="tailadmin-card p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 text-theme-sm text-gray-500">{description}</p>
        </div>
        <span className="text-theme-xs font-semibold text-gray-400">{items.length} anak</span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((child) => (
          <Link key={child.id} href={`/wali/progres/${child.id}`} className="min-w-0 rounded-2xl border border-gray-100 bg-gray-50 p-3 transition hover:border-brand-200 hover:bg-brand-50/40">
            <p className="truncate text-theme-sm font-semibold text-gray-900" title={child.name}>{child.name}</p>
            <p className="mt-1 truncate text-theme-xs text-gray-500">{child.nomorInduk} / {child.program.name}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function HeroStats({ childCount, averageProgress, averageScore }: { childCount: number; averageProgress: number | null; averageScore: number | null }) {
  return (
    <div className="grid min-w-64 grid-cols-3 gap-2 rounded-2xl border border-gray-100 bg-white/80 p-3 shadow-theme-xs">
      <SmallMetric label="Anak" value={childCount} helper="Terhubung" />
      <SmallMetric label="Progres" value={averageProgress === null ? "-" : averageProgress.toFixed(1)} helper="Rata-rata" />
      <SmallMetric label="Nilai" value={averageScore === null ? "-" : averageScore.toFixed(0)} helper="Rata-rata" />
    </div>
  );
}

function SmallMetric({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-gray-50 p-3 text-center">
      <p className="truncate text-xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 truncate text-[11px] font-semibold text-gray-600">{label}</p>
      <p className="mt-0.5 truncate text-[10px] text-gray-400">{helper}</p>
    </div>
  );
}
