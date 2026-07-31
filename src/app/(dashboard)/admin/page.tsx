import Link from "next/link";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { DashboardHero, MetricCard, QuickActionCard, SectionHeader } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { getActorDashboardContext } from "@/server/dal/actor-dal";
import { listPendaftaran } from "@/server/services/pendaftaran-service";
import { listSiswa } from "@/server/services/people-service";

export const metadata = { title: "Admin Dashboard" };

const quickActions = [
  { label: "Review pendaftaran", href: "/admin/pendaftaran", icon: "registration" as const, text: "Tinjau calon siswa baru" },
  { label: "Tambah siswa", href: "/admin/siswa", icon: "student" as const, text: "Kelola data dan enrollment" },
  { label: "Kelola kelas", href: "/admin/kelas", icon: "classes" as const, text: "Atur kelas dan guru" },
  { label: "Kelola pengguna", href: "/admin/users", icon: "users" as const, text: "Status akun dan session" },
];

export default async function AdminDashboardPage() {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const [context, registrations, students] = await Promise.all([
    getActorDashboardContext(actor),
    listPendaftaran(actor),
    listSiswa(actor, { pageSize: 5, sort: "createdAt", direction: "desc" }),
  ]);

  if (context.role !== "ADMIN") return null;

  const latestRegistrations = registrations.items.slice(0, 5);
  const maxUserCount = Math.max(context.studentCount, context.teacherCount, context.guardianCount, 1);

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow="Admin Command Center"
        title={`Selamat datang, ${actor.name}`}
        description="Pantau pendaftaran, siswa, kelas, pembayaran, dan operasional LIMO dari satu dashboard yang ringkas dan siap ditindaklanjuti."
        actions={<><Link href="/admin/pendaftaran" className="tailadmin-button-primary gap-2"><DashboardIcon name="registration" className="size-4" />Review Pendaftaran</Link><Link href="/admin/siswa" className="tailadmin-button-outline gap-2"><DashboardIcon name="student" className="size-4" />Kelola Siswa</Link></>}
        aside={<div className="rounded-2xl bg-gray-900 px-5 py-4 text-left text-white shadow-theme-lg"><p className="text-theme-xs text-white/60">Tugas prioritas</p><p className="mt-1 text-3xl font-semibold">{context.pendingRegistrations}</p><p className="mt-1 text-theme-xs text-white/70">pendaftaran perlu review</p></div>}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Siswa" value={context.studentCount} description="Siswa aktif terdaftar" icon="student" />
        <MetricCard label="Total Guru" value={context.teacherCount} description="Pengajar tercatat" icon="teacher" tone="success" />
        <MetricCard label="Total Wali" value={context.guardianCount} description="Akun wali murid" icon="guardian" tone="warning" />
        <MetricCard label="Perlu Review" value={context.pendingRegistrations} description="Pendaftaran menunggu" icon="registration" tone={context.pendingRegistrations > 0 ? "error" : "gray"} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 sm:px-6">
            <div><h2 className="font-semibold text-gray-900">Pendaftaran Terbaru</h2><p className="mt-1 text-theme-xs text-gray-500">Status calon siswa yang baru masuk</p></div>
            <Link href="/admin/pendaftaran" className="text-theme-sm font-semibold text-brand-500 hover:text-brand-600">Lihat semua</Link>
          </div>
          <div className="hidden grid-cols-[1.2fr_1fr_140px] gap-4 bg-gray-50 px-6 py-3 text-theme-xs font-semibold uppercase tracking-wide text-gray-500 sm:grid">
            <span>Calon Siswa</span><span>Program</span><span>Status</span>
          </div>
          <div className="divide-y divide-gray-100">
            {latestRegistrations.length ? latestRegistrations.map((item) => (
              <div key={item.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1.2fr_1fr_140px] sm:items-center sm:gap-4 sm:px-6">
                <div><p className="text-theme-sm font-semibold text-gray-800">{item.studentName}</p><p className="text-theme-xs text-gray-500">{item.kode}</p></div>
                <p className="text-theme-sm text-gray-600">{item.program.name}</p>
                <span className="w-fit rounded-full bg-brand-50 px-3 py-1 text-theme-xs font-semibold text-brand-600">{item.status}</span>
              </div>
            )) : <p className="px-6 py-10 text-center text-theme-sm text-gray-500">Belum ada pendaftaran masuk.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6">
          <h2 className="font-semibold text-gray-900">Komposisi Pengguna</h2>
          <p className="mt-1 text-theme-xs text-gray-500">Data akun dan siswa saat ini</p>
          <div className="mt-6 space-y-5">
            {[
              ["Siswa", context.studentCount, "bg-brand-500"],
              ["Guru", context.teacherCount, "bg-success-500"],
              ["Wali", context.guardianCount, "bg-warning-500"],
            ].map(([label, value, color]) => (
              <div key={String(label)}>
                <div className="mb-2 flex justify-between text-theme-sm"><span className="font-medium text-gray-700">{label}</span><span className="font-semibold text-gray-900">{value}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${(Number(value) / maxUserCount) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="mt-7 border-t border-gray-100 pt-5">
            <p className="text-theme-xs font-medium uppercase tracking-wide text-gray-400">Siswa terbaru</p>
            <div className="mt-3 space-y-3">
              {students.items.slice(0, 3).map((student) => (
                <Link key={student.id} href={`/admin/siswa/${student.id}`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-50">
                  <span className="grid size-9 place-items-center rounded-full bg-brand-50 text-theme-xs font-bold text-brand-600">{student.name.slice(0, 1)}</span>
                  <span className="min-w-0"><span className="block truncate text-theme-sm font-medium text-gray-800">{student.name}</span><span className="block text-theme-xs text-gray-500">{student.program.name}</span></span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionHeader title="Akses Cepat" description="Tugas operasional yang sering digunakan" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <QuickActionCard key={action.href} href={action.href} icon={action.icon} label={action.label} description={action.text} />
          ))}
        </div>
      </section>
    </div>
  );
}
