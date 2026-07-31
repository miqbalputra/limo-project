import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { getAdminReport } from "@/server/services/report-service";
import { DashboardHero, EmptyState, MetricCard, ProgressBar, SectionHeader } from "@/components/dashboard/dashboard-widgets";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { AdminReportFilters } from "@/components/dashboard/admin-report-filters";

export const metadata = { title: "Laporan Operasional" };

export default async function AdminLaporanPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const params = await searchParams;
  const report = await getAdminReport(actor, { fromValue: params.from, toValue: params.to });
  const csvHref = `/api/v1/admin/laporan/export?from=${report.period.fromValue}&to=${report.period.toValue}`;
  const attentionRows = report.studentRows.filter((row) => (row.attendanceRate !== null && row.attendanceRate < 75) || row.openInvoiceAmount > 0);

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Command Center"
        title="Laporan Operasional"
        description="Ringkasan periode untuk membantu Admin mengambil keputusan tentang siswa, kelas, kehadiran, progres, nilai, dan tagihan."
        actions={<a href={csvHref} className="tailadmin-button-primary gap-2"><DashboardIcon name="billing" className="size-4" />Unduh CSV</a>}
        aside={<div className="rounded-2xl bg-gray-900 px-5 py-4 text-left text-white shadow-theme-lg"><p className="text-theme-xs text-white/60">Periode laporan</p><p className="mt-1 text-lg font-semibold">{report.period.fromValue}</p><p className="text-theme-xs text-white/70">sampai {report.period.toValue}</p></div>}
      />
      <AdminReportFilters from={report.period.fromValue} to={report.period.toValue} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Siswa Aktif" value={report.summary.students} description="Total data siswa aktif" icon="student" />
        <MetricCard label="Kehadiran" value={report.summary.attendanceRate === null ? "-" : `${report.summary.attendanceRate}%`} description={`${report.summary.attendancePresent}/${report.summary.attendanceTotal} hadir/terlambat`} icon="presensi" tone="success" />
        <MetricCard label="Rata-rata Progres" value={report.summary.averageProgress ?? "-"} description={`${report.summary.progressCount} catatan progres`} icon="progress" tone="warning" />
        <MetricCard label="Rata-rata Nilai" value={report.summary.averageScore ?? "-"} description={`${report.summary.examCount} hasil final`} icon="exam" tone="brand" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ReportCard title="Tagihan Periode" value={`Rp ${report.summary.invoiceTotal.toLocaleString("id-ID")}`} helper={`${report.summary.invoiceCount} invoice tercatat`} />
        <ReportCard title="Sudah Dibayar" value={`Rp ${report.summary.invoicePaid.toLocaleString("id-ID")}`} helper="Status PAID" />
        <ReportCard title="Perlu Ditindaklanjuti" value={`Rp ${report.summary.invoiceOpen.toLocaleString("id-ID")}`} helper="UNPAID, PENDING, atau OVERDUE" warning={report.summary.invoiceOpen > 0} />
      </section>

      <section>
        <SectionHeader title="Ringkasan Kelas" description="Kelas aktif dengan metrik sesuai periode yang dipilih." />
        {report.classRows.length > 0 ? <div className="grid gap-4 xl:grid-cols-2">{report.classRows.map((row) => <ClassReportCard key={row.id} row={row} />)}</div> : <EmptyState icon="classes" title="Belum ada kelas aktif" description="Data kelas akan muncul setelah master kelas dibuat." />}
      </section>

      <section>
        <SectionHeader title="Siswa yang Perlu Perhatian" description="Siswa dengan kehadiran rendah atau tagihan terbuka pada periode ini." />
        {attentionRows.length > 0 ? <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-theme-xs"><table className="w-full min-w-[760px] text-left text-theme-sm"><thead className="bg-gray-50 text-theme-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">Siswa</th><th className="px-5 py-3">Program</th><th className="px-5 py-3">Kehadiran</th><th className="px-5 py-3">Progres</th><th className="px-5 py-3">Tagihan Terbuka</th><th className="px-5 py-3">Aksi</th></tr></thead><tbody className="divide-y divide-gray-100">{attentionRows.map((row) => <tr key={row.id}><td className="px-5 py-3"><p className="font-semibold text-gray-900">{row.name}</p><p className="text-theme-xs text-gray-500">{row.nomorInduk}</p></td><td className="px-5 py-3 text-gray-600">{row.program}</td><td className="px-5 py-3 font-semibold text-warning-700">{row.attendanceRate === null ? "-" : `${row.attendanceRate}%`}</td><td className="px-5 py-3 text-gray-700">{row.averageProgress ?? "-"}</td><td className="px-5 py-3 font-semibold text-error-700">{row.openInvoiceAmount > 0 ? `Rp ${row.openInvoiceAmount.toLocaleString("id-ID")}` : "-"}</td><td className="px-5 py-3"><Link href={`/admin/siswa/${row.id}`} className="font-semibold text-brand-500 hover:text-brand-600">Buka detail</Link></td></tr>)}</tbody></table></div> : <EmptyState icon="student" title="Tidak ada perhatian khusus" description="Tidak ditemukan siswa dengan kehadiran rendah atau tagihan terbuka pada periode ini." />}
      </section>
    </main>
  );
}

function ReportCard({ title, value, helper, warning = false }: { title: string; value: string; helper: string; warning?: boolean }) {
  return <article className="tailadmin-card p-5"><span className={`grid size-11 place-items-center rounded-xl ${warning ? "bg-warning-50 text-warning-700" : "bg-brand-50 text-brand-600"}`}><DashboardIcon name="billing" className="size-5" /></span><p className="mt-4 text-xl font-semibold text-gray-900">{value}</p><p className="mt-1 text-theme-sm font-semibold text-gray-700">{title}</p><p className="mt-1 text-theme-xs text-gray-500">{helper}</p></article>;
}

function ClassReportCard({ row }: { row: { name: string; program: string; level: string; guru: string; students: number; attendanceRate: number | null; averageProgress: number | null; averageScore: number | null } }) {
  return <article className="tailadmin-card min-w-0 p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{row.program} / {row.level}</p><h3 className="mt-1 truncate font-semibold text-gray-900" title={row.name}>{row.name}</h3><p className="mt-1 text-theme-xs text-gray-500">Guru: {row.guru} / {row.students} siswa aktif</p></div><span className="rounded-full bg-gray-50 px-3 py-1 text-theme-xs font-semibold text-gray-500">Kelas aktif</span></div><div className="mt-5 grid grid-cols-3 gap-2"><MiniStat label="Hadir" value={row.attendanceRate === null ? "-" : `${row.attendanceRate}%`} /><MiniStat label="Progres" value={row.averageProgress ?? "-"} /><MiniStat label="Nilai" value={row.averageScore ?? "-"} /></div><div className="mt-4"><ProgressBar value={row.attendanceRate ?? 0} tone={(row.attendanceRate ?? 0) >= 80 ? "success" : "warning"} /></div></article>;
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return <div className="min-w-0 rounded-2xl bg-gray-50 p-3 text-center"><p className="truncate text-lg font-semibold text-gray-900">{value}</p><p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p></div>;
}
