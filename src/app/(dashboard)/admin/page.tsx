import Link from "next/link";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { ResponsiveDataView } from "@/components/dashboard/responsive-data-view";
import { DashboardHero, MetricCard, QuickActionCard, SectionHeader } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { getActorDashboardContext } from "@/server/dal/actor-dal";
import { listAdminMaterialFiles } from "@/server/services/admin-material-service";
import { listPendaftaran } from "@/server/services/pendaftaran-service";
import { listSiswa } from "@/server/services/people-service";
import { formatRupiah } from "@/lib/money";
import { formatUiLabel, getUiToneClass } from "@/lib/ui-labels";

export const metadata = { title: "Beranda Admin" };

const quickActions = [
  { label: "Tinjau pendaftaran", href: "/admin/pendaftaran", icon: "registration" as const, text: "Tinjau calon siswa baru" },
  { label: "Tambah siswa", href: "/admin/siswa", icon: "student" as const, text: "Kelola data dan enrollment" },
  { label: "Kelola kelas", href: "/admin/kelas", icon: "classes" as const, text: "Atur kelas dan guru" },
  { label: "Pantau tagihan", href: "/admin/tagihan", icon: "billing" as const, text: "Mayar, SPP, dan rekonsiliasi" },
  { label: "Lihat laporan", href: "/admin/laporan", icon: "audit" as const, text: "Presensi, progres, nilai, dan SPP" },
  { label: "Kelola pengguna", href: "/admin/users", icon: "users" as const, text: "Status akun dan sesi" },
  { label: "Berkas materi", href: "/admin/file-manager", icon: "materials" as const, text: "Cari file PDF dan gambar" },
  { label: "Lihat audit", href: "/admin/audit", icon: "audit" as const, text: "Aktivitas sensitif sistem" },
];

export default async function AdminDashboardPage() {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const [context, registrations, students, materialFiles] = await Promise.all([
    getActorDashboardContext(actor),
    listPendaftaran(actor),
    listSiswa(actor, { pageSize: 5, sort: "createdAt", direction: "desc" }),
    listAdminMaterialFiles(actor, { pageSize: 5 }),
  ]);

  if (context.role !== "ADMIN") return null;

  const latestRegistrations = registrations.items.slice(0, 5);
  const maxUserCount = Math.max(context.studentCount, context.teacherCount, context.guardianCount, 1);

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow="Ringkasan Operasional"
        title={`Selamat datang, ${actor.name}`}
        description="Pantau pendaftaran, siswa, kelas, pembayaran, dan operasional LIMO dari satu dashboard yang ringkas dan siap ditindaklanjuti."
        actions={<><Link href="/admin/pendaftaran" className="tailadmin-button-primary gap-2"><DashboardIcon name="registration" className="size-4" />Tinjau Pendaftaran</Link><Link href="/admin/siswa" className="tailadmin-button-outline gap-2"><DashboardIcon name="student" className="size-4" />Kelola Siswa</Link></>}
        aside={<div className="rounded-2xl bg-gray-900 px-5 py-4 text-left text-white shadow-theme-lg"><p className="text-theme-xs text-white/60">Tugas prioritas</p><p className="mt-1 text-3xl font-semibold">{context.pendingRegistrations}</p><p className="mt-1 text-theme-xs text-white/70">pendaftaran perlu ditinjau</p></div>}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Siswa" value={context.studentCount} description="Siswa aktif terdaftar" icon="student" />
        <MetricCard label="Total Guru" value={context.teacherCount} description="Pengajar tercatat" icon="teacher" tone="success" />
        <MetricCard label="Total Wali" value={context.guardianCount} description="Akun wali murid" icon="guardian" tone="warning" />
        <MetricCard label="Perlu Ditinjau" value={context.pendingRegistrations} description="Pendaftaran menunggu" icon="registration" tone={context.pendingRegistrations > 0 ? "error" : "gray"} />
      </section>

      <section>
        <SectionHeader title={`Operasional ${context.currentMonth.period}`} description="Ringkasan pembayaran, pembelajaran, dan aktivitas bulan berjalan." action={<Link href="/admin/laporan" className="text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800">Buka laporan lengkap</Link>} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Tagihan Terbuka" value={context.currentMonth.openInvoiceCount} description={`${formatRupiah(context.currentMonth.openInvoiceTotal)} belum lunas`} icon="billing" tone={context.currentMonth.openInvoiceCount > 0 ? "warning" : "success"} />
          <MetricCard label="Lewat Jatuh Tempo" value={context.currentMonth.overdueInvoiceCount} description="Perlu ditindaklanjuti Admin" icon="billing" tone={context.currentMonth.overdueInvoiceCount > 0 ? "error" : "success"} />
          <MetricCard label="Kehadiran Bulan Ini" value={context.currentMonth.attendanceRate === null ? "-" : `${context.currentMonth.attendanceRate}%`} description="Hadir atau terlambat dari seluruh presensi" icon="presensi" tone="success" />
          <MetricCard label="Aktivitas Akademik" value={`${context.currentMonth.examCount} ujian`} description={`${context.currentMonth.publishedMaterialCount} materi terbit; progres rata-rata ${context.currentMonth.progressAverage ?? "-"}/5`} icon="progress" tone="brand" />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 sm:px-6">
            <div><h2 className="font-semibold text-gray-900">Pendaftaran Terbaru</h2><p className="mt-1 text-theme-xs text-gray-500">Status calon siswa yang baru masuk</p></div>
             <Link href="/admin/pendaftaran" className="text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800">Lihat semua</Link>
          </div>
          <div className="hidden grid-cols-[1.2fr_1fr_140px] gap-4 bg-gray-50 px-6 py-3 text-theme-xs font-semibold uppercase tracking-wide text-gray-500 sm:grid">
            <span>Calon Siswa</span><span>Program</span><span>Status</span>
          </div>
          <div className="divide-y divide-gray-100">
            {latestRegistrations.length ? latestRegistrations.map((item) => (
              <div key={item.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1.2fr_1fr_140px] sm:items-center sm:gap-4 sm:px-6">
                <div><p className="text-theme-sm font-semibold text-gray-800">{item.studentName}</p><p className="text-theme-xs text-gray-500">{item.kode}</p></div>
                <p className="text-theme-sm text-gray-600">{item.program.name}</p>
                 <span className={`w-fit rounded-full px-3 py-1 text-theme-xs font-semibold ${getUiToneClass(item.status)}`}>{formatUiLabel(item.status)}</span>
              </div>
            )) : <p className="px-6 py-10 text-center text-theme-sm text-gray-500">Belum ada pendaftaran masuk.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6">
          <h2 className="font-semibold text-gray-900">Komposisi Pengguna</h2>
          <p className="mt-1 text-theme-xs text-gray-500">Data akun dan siswa saat ini</p>
          <div className="mt-6 space-y-5">
            {[
               ["Siswa", context.studentCount, "bg-limo-blue-500"],
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
                   <span className="grid size-9 place-items-center rounded-full bg-limo-blue-50 text-theme-xs font-bold text-limo-blue-700">{student.name.slice(0, 1)}</span>
                  <span className="min-w-0"><span className="block truncate text-theme-sm font-medium text-gray-800">{student.name}</span><span className="block text-theme-xs text-gray-500">{student.program.name}</span></span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 sm:px-6">
            <div><p className="text-theme-xs font-semibold uppercase tracking-[0.16em] text-limo-blue-600">Peserta didik</p><h2 className="mt-1 font-semibold text-gray-900">Siswa terbaru</h2><p className="mt-1 text-theme-xs text-gray-500">Ringkasan data peserta didik yang baru diperbarui.</p></div>
            <Link href="/admin/siswa" className="text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800">Kelola siswa</Link>
          </div>
           <ResponsiveDataView
             rows={students.items}
             getRowKey={(student) => student.id}
             tableLabel="Siswa terbaru"
             desktopBreakpoint="2xl"
             testId="admin-students"
             empty={<p className="px-6 py-10 text-center text-theme-sm text-gray-500">Belum ada data siswa.</p>}
             rowClassName="hover:bg-gray-25"
             columns={[
               {
                 id: "student",
                 label: "Siswa",
                 render: (student) => (
                   <div className="flex items-center gap-3">
                     <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-limo-blue-50 text-theme-xs font-bold text-limo-blue-700">{student.name.slice(0, 1)}</span>
                     <div className="min-w-0"><p className="font-semibold text-gray-800">{student.name}</p><p className="text-theme-xs text-gray-500">{student.nomorInduk}</p></div>
                   </div>
                 ),
               },
               { id: "program", label: "Program", render: (student) => <span className="text-gray-600">{student.program.name}</span> },
               { id: "class", label: "Kelas", render: (student) => <span className="text-gray-600">{student.enrollments.map((enrollment) => enrollment.kelas.name).join(", ") || "Belum ada kelas"}</span> },
               { id: "status", label: "Status", render: (student) => <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${getUiToneClass(student.status)}`}>{formatUiLabel(student.status)}</span> },
             ]}
           />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><p className="text-theme-xs font-semibold uppercase tracking-[0.16em] text-limo-blue-600">Berkas materi</p><h2 className="mt-1 font-semibold text-gray-900">Materi terbaru</h2><p className="mt-1 text-theme-xs text-gray-500">{materialFiles.stats.totalFiles} file privat tersimpan.</p></div><Link href="/admin/file-manager" aria-label="Buka berkas materi" className="grid size-9 place-items-center rounded-lg bg-limo-blue-50 text-limo-blue-700 hover:bg-limo-blue-100"><DashboardIcon name="materials" className="size-4" /></Link></div>
          <div className="mt-5 space-y-3">{materialFiles.items.length > 0 ? materialFiles.items.slice(0, 4).map((file) => <a key={file.id} href={`/api/v1/files/${file.id}`} className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition hover:bg-gray-25 hover:shadow-theme-xs"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-error-50 text-error-700"><DashboardIcon name="materials" className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-theme-sm font-semibold text-gray-800 group-hover:text-gray-900">{file.originalName}</span><span className="mt-0.5 block truncate text-theme-xs text-gray-500">{file.materi?.kelas.name || "Materi"} / {formatFileSize(Number(file.sizeBytes))}</span></span><span className="text-gray-300"><DashboardIcon name="dashboard" className="size-4" /></span></a>) : <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-theme-sm text-gray-500">Belum ada file materi.</p>}</div>
           <Link href="/admin/file-manager" className="mt-4 block text-center text-theme-xs font-semibold text-limo-blue-700 hover:text-limo-blue-800">Lihat semua file</Link>
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

function formatFileSize(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
