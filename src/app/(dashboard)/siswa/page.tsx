import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { DashboardHero, EmptyState, MetricCard, QuickActionCard, SectionHeader } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { getStudentDashboard } from "@/server/services/student-service";

export const metadata = { title: "Dashboard Siswa" };

export default async function StudentDashboardPage() {
  if (!isFeatureEnabled("studentPortalEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["SISWA"]);
  const dashboard = await getStudentDashboard(actor);
  const attendanceRate = dashboard.attendance.total ? Math.round((dashboard.attendance.attended / dashboard.attendance.total) * 100) : 0;

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Student Portal"
        title={`Halo, ${dashboard.profile.name}`}
        description="Lanjutkan belajar dari kelas aktif, lihat jadwal terdekat, materi terbaru, dan feedback akademik Anda."
        actions={<><Link href="/siswa/kelas" className="tailadmin-button-primary gap-2"><DashboardIcon name="classes" className="size-4" />Buka Kelas Saya</Link><Link href="/siswa/profil" className="tailadmin-button-outline gap-2"><DashboardIcon name="profile" className="size-4" />Lihat Profil</Link></>}
        aside={<div className="rounded-2xl bg-brand-500 px-5 py-4 text-white shadow-theme-lg"><p className="text-theme-xs text-white/70">Program</p><p className="mt-1 text-lg font-semibold">{dashboard.profile.program.name}</p><p className="mt-1 text-theme-xs text-white/80">{dashboard.profile.nomorInduk}</p></div>}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Kelas Aktif" value={dashboard.classes.length} description="Enrollment yang sedang berjalan" icon="classes" />
        <MetricCard label="Kehadiran" value={`${attendanceRate}%`} description={`${dashboard.attendance.attended} dari ${dashboard.attendance.total} presensi hadir`} icon="presensi" tone="success" />
        <MetricCard label="Materi Baru" value={dashboard.materials.length} description="Materi published terbaru" icon="materials" tone="warning" />
        <MetricCard label="Notifikasi" value={dashboard.notifications.unreadCount} description="Notifikasi belum dibaca" icon="audit" tone={dashboard.notifications.unreadCount > 0 ? "error" : "gray"} />
      </section>

      <section>
        <SectionHeader title="Kegiatan Terdekat" description="Jadwal kelas yang perlu Anda perhatikan berikutnya." action={<Link href="/siswa/kelas" className="text-theme-sm font-semibold text-brand-500">Lihat kelas</Link>} />
        {dashboard.schedule.length > 0 ? <div className="grid gap-3 lg:grid-cols-2">{dashboard.schedule.map((item) => <article key={item.id} className="tailadmin-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{item.kelas.name}</p><h2 className="mt-1 font-semibold text-gray-900">{item.topic}</h2><p className="mt-1 text-theme-sm text-gray-500">Pertemuan {item.meetingNumber} / {formatDateTime(item.sessionDate)}</p></div><span className="rounded-full bg-gray-50 px-3 py-1 text-theme-xs font-semibold text-gray-600">{item.status}</span></div></article>)}</div> : <EmptyState icon="presensi" title="Belum ada jadwal terdekat" description="Jadwal akan tampil setelah kelas aktif Anda memiliki sesi pembelajaran." />}
      </section>

      {isFeatureEnabled("assignmentsEnabled") ? <section>
        <SectionHeader title="Tugas Online" description="Tugas yang perlu Anda kerjakan atau lanjutkan." action={<Link href="/siswa/kelas" className="text-theme-sm font-semibold text-brand-500">Lihat kelas</Link>} />
        {dashboard.assignments.length > 0 ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{dashboard.assignments.map((item) => <Link key={item.id} href={`/siswa/tugas/${item.id}`} className="tailadmin-card block p-4 transition hover:border-brand-200 hover:shadow-theme-sm"><p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{item.kelas.name} / {item.submissionType}</p><h2 className="mt-1 font-semibold text-gray-900">{item.title}</h2><p className="mt-2 text-theme-xs text-gray-500">{item.latestSubmission?.status || "Belum dimulai"}{item.dueAt ? ` / Tenggat ${formatDateTime(item.dueAt)}` : " / Tanpa tenggat"}</p></Link>)}</div> : <EmptyState icon="exam" title="Belum ada tugas online" description="Tugas published dari Guru akan tampil di sini." />}
      </section> : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <div>
          <SectionHeader title="Lanjutkan Belajar" description="Materi terbaru dari kelas yang Anda ikuti." />
          {dashboard.materials.length > 0 ? <div className="space-y-3">{dashboard.materials.map((item) => <Link key={item.id} href={`/siswa/kelas/${item.kelas.id}`} className="block tailadmin-card p-4 transition hover:border-brand-200 hover:shadow-theme-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{item.kelas.name}</p><h2 className="mt-1 font-semibold text-gray-900">{item.title}</h2></div><span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-semibold text-brand-700">{item.type}</span></div><p className="mt-2 text-theme-xs text-gray-500">Diperbarui {formatDate(item.updatedAt)}</p></Link>)}</div> : <EmptyState icon="materials" title="Belum ada materi" description="Materi published dari Guru akan tampil di sini." />}
        </div>

        <div>
          <SectionHeader title="Evaluasi Tersedia" description="Ujian yang dipublikasikan untuk kelas aktif Anda." />
          {dashboard.exams.length > 0 ? <div className="space-y-3">{dashboard.exams.map((item) => <article key={item.id} className="tailadmin-card p-4"><p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{item.kelas.name}</p><h2 className="mt-1 font-semibold text-gray-900">{item.title}</h2><p className="mt-2 text-theme-xs text-gray-500">{item.examDate ? `Tanggal ${formatDateTime(item.examDate)}` : "Tanggal belum ditentukan"} / Durasi {item.durationMinutes} menit</p><p className="mt-2 text-theme-xs text-gray-500">Mode {item.deliveryMode}. Akses pengerjaan akan tersedia setelah alur tugas Siswa diaktifkan.</p></article>)}</div> : <EmptyState icon="exam" title="Belum ada evaluasi" description="Ujian yang sudah dipublikasikan Guru akan tampil di sini." />}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div>
          <SectionHeader title="Feedback Terbaru" description="Nilai dan catatan yang sudah tersedia untuk Anda." />
          {dashboard.scores.length > 0 ? <div className="space-y-3">{dashboard.scores.map((item) => <article key={item.id} className="tailadmin-card p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-gray-900">{item.ujian.title}</h2><p className="mt-1 text-theme-xs text-gray-500">Diperbarui {formatDate(item.updatedAt)}</p></div><span className="text-lg font-semibold text-success-700">{item.totalScore == null ? "-" : Number(item.totalScore).toFixed(0)}</span></div></article>)}</div> : <EmptyState icon="exam" title="Belum ada nilai" description="Nilai final yang sudah dipublikasikan akan tampil di sini." />}
        </div>
        <div>
          <SectionHeader title="Progres Belajar" description="Catatan pemahaman terbaru dari Guru." />
          {dashboard.progress.length > 0 ? <div className="space-y-3">{dashboard.progress.map((item) => <article key={item.id} className="tailadmin-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-theme-xs text-gray-500">{item.sesiKelas.kelas.name} / {item.sesiKelas.topic}</p><p className="mt-1 text-theme-sm text-gray-700">{item.publicNote || "Belum ada catatan publik."}</p></div><span className="rounded-full bg-warning-50 px-3 py-1 text-theme-xs font-semibold text-warning-700">{item.understandingScore}/5</span></div></article>)}</div> : <EmptyState icon="progress" title="Belum ada progres" description="Catatan progres dari Guru akan tampil setelah sesi pembelajaran selesai." />}
        </div>
      </section>

      <section>
        <SectionHeader title="Akses Cepat" description="Tindakan yang paling sering digunakan." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><QuickActionCard href="/siswa/kelas" icon="classes" label="Kelas Saya" description="Buka materi dan riwayat kegiatan kelas." /><QuickActionCard href="/siswa/profil" icon="profile" label="Profil" description="Periksa identitas dan identifier login." /><QuickActionCard href="/ubah-password" icon="lock" label="Ubah Password" description="Perbarui password akun secara aman." /></div>
      </section>
    </main>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(value);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
}
