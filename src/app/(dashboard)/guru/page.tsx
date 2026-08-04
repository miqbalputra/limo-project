import Link from "next/link";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { DashboardHero, EmptyState, MetricCard, ProgressBar, QuickActionCard, SectionHeader } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { getActorDashboardContext, getGuruTodayAgenda } from "@/server/dal/actor-dal";

export const metadata = {
  title: "Guru Dashboard",
};

export default async function GuruDashboardPage() {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const [context, todayAgenda] = await Promise.all([getActorDashboardContext(actor), getGuruTodayAgenda(actor)]);

  if (context.role !== "GURU") return null;

  const totalStudents = context.kelas.reduce((sum, kelas) => sum + kelas._count.enrollments, 0);
  const totalSessions = context.kelas.reduce((sum, kelas) => sum + kelas._count.sessions, 0);
  const totalMaterials = context.kelas.reduce((sum, kelas) => sum + kelas._count.materi, 0);
  const totalExams = context.kelas.reduce((sum, kelas) => sum + kelas._count.ujian, 0);
  const busiestClass = context.kelas.slice().sort((left, right) => right._count.enrollments - left._count.enrollments)[0];

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow="Teacher Workspace"
        title={`Halo, ${actor.name}`}
        description="Kelola kelas, materi, presensi, progres, dan nilai siswa dari satu ruang kerja yang fokus untuk proses mengajar harian."
        actions={<><Link href="/guru/presensi" className="tailadmin-button-primary gap-2"><DashboardIcon name="presensi" className="size-4" />Input Presensi</Link><Link href="/guru/materi" className="tailadmin-button-outline gap-2"><DashboardIcon name="materials" className="size-4" />Kelola Materi</Link></>}
        aside={busiestClass ? <div className="rounded-2xl bg-brand-500 px-5 py-4 text-white shadow-theme-lg"><p className="text-theme-xs text-white/70">Kelas teraktif</p><p className="mt-1 text-lg font-semibold">{busiestClass.name}</p><p className="mt-1 text-theme-xs text-white/80">{busiestClass._count.enrollments} siswa aktif</p></div> : null}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Kelas Aktif" value={context.kelas.length} description="Kelas yang ditugaskan" icon="classes" />
        <MetricCard label="Siswa Dibimbing" value={totalStudents} description="Total enrollment aktif" icon="student" tone="success" />
        <MetricCard label="Sesi Kelas" value={totalSessions} description="Pertemuan yang tersedia" icon="presensi" tone="warning" />
        <MetricCard label="Materi & Ujian" value={totalMaterials + totalExams} description={`${totalMaterials} materi, ${totalExams} ujian`} icon="exam" tone="gray" />
      </section>

      <section>
        <SectionHeader title="Agenda Hari Ini" description="Mulai dari sesi yang dijadwalkan hari ini dan selesaikan input yang masih tertunda." action={<Link href="/guru/presensi" className="text-theme-sm font-semibold text-brand-500 hover:text-brand-600">Buka semua sesi</Link>} />
        {todayAgenda.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {todayAgenda.map((item) => {
              const students = item.kelas._count.enrollments;
              const attendanceReady = students > 0 && item._count.presensi >= students;
              const progressReady = students > 0 && item._count.progresBelajar >= students;

              return (
                <article key={item.id} className="tailadmin-card min-w-0 p-5 ring-1 ring-brand-100">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-theme-sm font-semibold text-brand-600">{item.meetingNumber}</span>
                      <div className="min-w-0">
                        <p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{item.kelas.name}</p>
                        <h2 className="mt-1 truncate font-semibold text-gray-900" title={item.topic}>{item.topic}</h2>
                        <p className="mt-1 text-theme-xs text-gray-500">{formatAgendaTime(item.sessionDate)} / {students} siswa aktif</p>
                      </div>
                    </div>
                    <span className={`w-fit rounded-full px-3 py-1 text-theme-xs font-semibold ${item.status === "FINAL" ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700"}`}>{item.status === "FINAL" ? "Final" : "Draft"}</span>
                  </div>

                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    <AgendaStatus label="Presensi" complete={attendanceReady} value={`${Math.min(item._count.presensi, students)}/${students}`} />
                    <AgendaStatus label="Progres" complete={progressReady} value={`${Math.min(item._count.progresBelajar, students)}/${students}`} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/guru/presensi/${item.id}`} className="tailadmin-button-primary px-3 py-2">Input Presensi</Link>
                    <Link href={`/guru/progres/${item.id}`} className="tailadmin-button-outline px-3 py-2">Input Progres</Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50/70 p-6">
            <p className="font-semibold text-gray-900">Tidak ada sesi terjadwal hari ini</p>
            <p className="mt-1 text-theme-sm text-gray-500">Sesi baru akan muncul di sini setelah admin membuat jadwal untuk kelas aktif Anda.</p>
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Kelas Saya" description="Pantau kesiapan belajar setiap kelas dan lanjutkan pekerjaan guru dengan cepat." action={<Link href="/guru/kelas" className="text-theme-sm font-semibold text-brand-500 hover:text-brand-600">Lihat semua</Link>} />
        {context.kelas.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {context.kelas.map((kelas) => {
              const readiness = Math.min(100, (kelas._count.sessions * 20) + (kelas._count.materi * 15) + (kelas._count.ujian * 10));
              return (
                <article key={kelas.id} className="tailadmin-card p-5 transition hover:-translate-y-0.5 hover:shadow-theme-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{kelas.program.name} / {kelas.level.name}</p>
                      <h2 className="mt-1 font-semibold text-gray-900">{kelas.name}</h2>
                      <p className="mt-2 text-theme-sm text-gray-500">{kelas.scheduleNote || "Jadwal belum dicatat"}</p>
                    </div>
                    <span className="w-fit rounded-full bg-success-50 px-3 py-1 text-theme-xs font-semibold text-success-700">{kelas._count.enrollments} siswa</span>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl bg-gray-50 p-3 text-center">
                    <div><p className="text-lg font-semibold text-gray-900">{kelas._count.sessions}</p><p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Sesi</p></div>
                    <div><p className="text-lg font-semibold text-gray-900">{kelas._count.materi}</p><p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Materi</p></div>
                    <div><p className="text-lg font-semibold text-gray-900">{kelas._count.ujian}</p><p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Ujian</p></div>
                  </div>
                  <div className="mt-5">
                    <div className="mb-2 flex justify-between text-theme-xs text-gray-500"><span>Aktivitas pembelajaran</span><span className="font-semibold text-gray-700">{readiness}%</span></div>
                    <ProgressBar value={readiness} tone={readiness >= 70 ? "success" : "brand"} />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link href={`/guru/kelas/${kelas.id}`} className="tailadmin-button-primary px-3 py-2">Kelola</Link>
                    <Link href={`/guru/kelas/${kelas.id}/ringkasan`} className="tailadmin-button-outline px-3 py-2">Ringkasan</Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="classes" title="Belum ada kelas aktif" description="Kelas yang ditugaskan admin akan tampil di sini. Setelah ada kelas, guru bisa mengelola materi, presensi, progres, dan nilai." />
        )}
      </section>

      <section>
        <SectionHeader title="Akses Mengajar" description="Shortcut untuk pekerjaan yang paling sering dipakai guru." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QuickActionCard href="/guru/materi" icon="materials" label="Materi" description="Buat teks, PDF, gambar, dan link video." />
          <QuickActionCard href="/guru/bank-soal" icon="exam" label="Bank Soal" description="Siapkan soal PG dan esai untuk kelas." />
          <QuickActionCard href="/guru/ujian" icon="exam" label="Ujian" description="Atur evaluasi, durasi, dan input hasil." />
          <QuickActionCard href="/guru/progres" icon="progress" label="Progres" description="Catat pemahaman dan catatan wali." />
        </div>
      </section>
    </div>
  );
}

function AgendaStatus({ label, value, complete }: { label: string; value: string; complete: boolean }) {
  return <div className={`rounded-2xl border px-3 py-2.5 ${complete ? "border-success-100 bg-success-50/70" : "border-warning-100 bg-warning-50/70"}`}><div className="flex items-center justify-between gap-2"><span className="text-theme-xs font-medium text-gray-600">{label}</span><span className={`text-theme-xs font-semibold ${complete ? "text-success-700" : "text-warning-700"}`}>{complete ? "Lengkap" : "Perlu diinput"}</span></div><p className="mt-1 text-sm font-semibold text-gray-900">{value} siswa</p></div>;
}

function formatAgendaTime(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
}
