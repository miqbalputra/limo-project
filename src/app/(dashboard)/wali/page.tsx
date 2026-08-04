import Link from "next/link";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { DashboardHero, EmptyState, MetricCard, ProgressBar, QuickActionCard, SectionHeader } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { getActorDashboardContext } from "@/server/dal/actor-dal";

export const metadata = {
  title: "Wali Dashboard",
};

export default async function WaliDashboardPage() {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const context = await getActorDashboardContext(actor);

  if (context.role !== "WALI") return null;

  const children = context.children;
  const totalAttendance = children.reduce((sum, child) => sum + child.presensi.length, 0);
  const attended = children.reduce((sum, child) => sum + child.presensi.filter((item) => item.status === "HADIR" || item.status === "TERLAMBAT").length, 0);
  const attendanceRate = totalAttendance ? Math.round((attended / totalAttendance) * 100) : 0;
  const progressScores = children.flatMap((child) => child.progresBelajar.map((item) => item.understandingScore));
  const averageProgress = progressScores.length ? (progressScores.reduce((sum, score) => sum + score, 0) / progressScores.length).toFixed(1) : "-";
  const openBills = children.reduce((sum, child) => sum + child.tagihan.length, 0);
  const examScores = children.flatMap((child) => child.hasilUjian.map((item) => Number(item.totalScore || 0)));
  const averageScore = examScores.length ? Math.round(examScores.reduce((sum, score) => sum + score, 0) / examScores.length) : null;
  const childrenNeedingAttention = children.filter((child) => {
    const childAttendance = child.presensi.length;
    const childAttended = child.presensi.filter((item) => item.status === "HADIR" || item.status === "TERLAMBAT").length;
    const childAttendanceRate = childAttendance ? Math.round((childAttended / childAttendance) * 100) : null;
    const childProgress = child.progresBelajar.length ? child.progresBelajar.reduce((sum, item) => sum + item.understandingScore, 0) / child.progresBelajar.length : null;

    return child.tagihan.length > 0 || (childAttendanceRate !== null && childAttendanceRate < 75) || (childProgress !== null && childProgress < 3);
  });

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow="Parent Portal"
        title={`Halo, ${actor.name}`}
        description="Pantau perkembangan anak, presensi, nilai, dan tagihan dari satu dashboard yang sederhana untuk orang tua."
        actions={<><Link href="/wali/tugas" className="tailadmin-button-primary gap-2"><DashboardIcon name="exam" className="size-4" />Tugas Anak</Link><Link href="/wali/progres" className="tailadmin-button-outline gap-2"><DashboardIcon name="progress" className="size-4" />Lihat Progres</Link><Link href="/wali/tagihan" className="tailadmin-button-outline gap-2"><DashboardIcon name="billing" className="size-4" />Cek Tagihan</Link></>}
        aside={<div className="rounded-2xl bg-gray-900 px-5 py-4 text-left text-white shadow-theme-lg"><p className="text-theme-xs text-white/60">Rata-rata nilai</p><p className="mt-1 text-3xl font-semibold">{averageScore ?? "-"}</p><p className="mt-1 text-theme-xs text-white/70">dari nilai final anak</p></div>}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Anak Terhubung" value={children.length} description="Siswa yang dapat dipantau" icon="student" />
        <MetricCard label="Kehadiran" value={`${attendanceRate}%`} description={`${attended} dari ${totalAttendance} presensi hadir/terlambat`} icon="presensi" tone="success" />
        <MetricCard label="Pemahaman" value={averageProgress} description="Rata-rata skor progres 1-5" icon="progress" tone="warning" />
        <MetricCard label="Tagihan Aktif" value={openBills} description="Belum lunas, pending, atau overdue" icon="billing" tone={openBills > 0 ? "error" : "gray"} />
      </section>

      {childrenNeedingAttention.length > 0 ? (
        <section className="rounded-3xl border border-warning-100 bg-warning-50/60 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-warning-800">Perlu Perhatian</h2>
              <p className="mt-1 text-theme-sm text-warning-700">Ada tagihan aktif, presensi rendah, atau progres yang perlu dipantau lebih dekat.</p>
            </div>
            <Link href="/wali/tagihan" className="tailadmin-button-primary px-4 py-2">Cek Tagihan</Link>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {childrenNeedingAttention.slice(0, 6).map((child) => (
              <Link key={child.id} href={`/wali/progres/${child.id}`} className="min-w-0 rounded-2xl bg-white p-3 shadow-theme-xs transition hover:shadow-theme-sm">
                <p className="truncate text-theme-sm font-semibold text-gray-900" title={child.name}>{child.name}</p>
                <p className="mt-1 text-theme-xs text-gray-500">{child.tagihan.length > 0 ? `${child.tagihan.length} tagihan aktif` : "Lihat detail perkembangan"}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeader title="Ringkasan Anak" description="Pilih kartu anak untuk melihat progres belajar, presensi, nilai, dan tagihan yang relevan." action={children.length > 0 ? <Link href="/wali/progres" className="text-theme-sm font-semibold text-brand-500 hover:text-brand-600">Semua progres</Link> : null} />
        {children.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {children.map((child) => {
              const childAttendance = child.presensi.length;
              const childAttended = child.presensi.filter((item) => item.status === "HADIR" || item.status === "TERLAMBAT").length;
              const childAttendanceRate = childAttendance ? Math.round((childAttended / childAttendance) * 100) : 0;
              const childProgress = child.progresBelajar.length ? child.progresBelajar.reduce((sum, item) => sum + item.understandingScore, 0) / child.progresBelajar.length : null;
              const latestScore = child.hasilUjian[0]?.totalScore;
              const latestNote = child.progresBelajar[0]?.publicNote;
              return (
                <article key={child.id} className="tailadmin-card min-w-0 p-5 transition hover:-translate-y-0.5 hover:shadow-theme-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-lg font-semibold text-brand-600">{child.name.slice(0, 1).toUpperCase()}</span>
                      <div className="min-w-0">
                      <p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{child.program.name} / {child.nomorInduk}</p>
                      <h2 className="mt-1 truncate font-semibold text-gray-900" title={child.name}>{child.name}</h2>
                      <p className="mt-2 text-theme-sm text-gray-500">Status siswa: {child.status}</p>
                      </div>
                    </div>
                    <span className={`w-fit rounded-full px-3 py-1 text-theme-xs font-semibold ${child.tagihan.length > 0 ? "bg-error-50 text-error-700" : "bg-success-50 text-success-700"}`}>{child.tagihan.length > 0 ? `${child.tagihan.length} tagihan aktif` : "Lunas"}</span>
                  </div>
                  <div className="mt-5 grid min-w-0 grid-cols-3 gap-2 rounded-2xl bg-gray-50 p-3 text-center">
                    <div><p className="text-lg font-semibold text-gray-900">{childAttendanceRate}%</p><p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Hadir</p></div>
                    <div><p className="text-lg font-semibold text-gray-900">{childProgress === null ? "-" : childProgress.toFixed(1)}</p><p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Progres</p></div>
                    <div><p className="text-lg font-semibold text-gray-900">{latestScore != null ? Number(latestScore).toFixed(0) : "-"}</p><p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Nilai</p></div>
                  </div>
                  <div className="mt-5">
                    <div className="mb-2 flex justify-between text-theme-xs text-gray-500"><span>Kehadiran</span><span className="font-semibold text-gray-700">{childAttended}/{childAttendance}</span></div>
                    <ProgressBar value={childAttendanceRate} tone={childAttendanceRate >= 80 ? "success" : "warning"} />
                  </div>
                  <p className="mt-4 line-clamp-2 rounded-2xl bg-gray-50 p-3 text-theme-sm leading-6 text-gray-500">{latestNote || "Belum ada catatan terbaru dari guru."}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link href={`/wali/progres/${child.id}`} className="tailadmin-button-primary px-3 py-2">Detail Progres</Link>
                    <Link href="/wali/nilai" className="tailadmin-button-outline px-3 py-2">Nilai</Link>
                    <Link href="/wali/tagihan" className="tailadmin-button-outline px-3 py-2">Tagihan</Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="student" title="Belum ada siswa terhubung" description="Akun wali akan menampilkan data setelah admin menghubungkan siswa. Hubungi admin LIMO jika data anak belum muncul." />
        )}
      </section>

      <section>
        <SectionHeader title="Akses Orang Tua" description="Menu penting untuk memantau perkembangan anak tanpa harus mencari satu per satu." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <QuickActionCard href="/wali/tugas" icon="exam" label="Tugas Anak" description="Ujian online yang bisa dikerjakan dari akun wali." />
          <QuickActionCard href="/wali/progres" icon="progress" label="Progres Anak" description="Grafik pemahaman, catatan guru, dan trend belajar." />
          <QuickActionCard href="/wali/presensi" icon="presensi" label="Presensi" description="Rekap kehadiran dan kedisiplinan belajar." />
          <QuickActionCard href="/wali/nilai" icon="exam" label="Nilai" description="Riwayat hasil ujian dan evaluasi final." />
          <QuickActionCard href="/wali/tagihan" icon="billing" label="Tagihan" description="Status pembayaran dan instruksi Mayar." />
        </div>
      </section>
    </div>
  );
}
