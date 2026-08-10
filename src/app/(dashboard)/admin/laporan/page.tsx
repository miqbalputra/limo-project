import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { getAdminReport } from "@/server/services/report-service";
import { DashboardHero, EmptyState, MetricCard, ProgressBar, SectionHeader } from "@/components/dashboard/dashboard-widgets";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { AdminReportFilters } from "@/components/dashboard/admin-report-filters";
import { MetricStat } from "@/components/dashboard/metric-card";
import { Money } from "@/components/dashboard/money";
import { ResponsiveDataView } from "@/components/dashboard/responsive-data-view";
import { formatRupiah } from "@/lib/money";
import { formatUiLabel } from "@/lib/ui-labels";

export const metadata = { title: "Laporan Operasional" };

export default async function AdminLaporanPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const params = await searchParams;
  const report = await getAdminReport(actor, { fromValue: params.from, toValue: params.to });
  const csvHref = `/api/v1/admin/laporan/export?from=${report.period.fromValue}&to=${report.period.toValue}`;
  const excelHref = `/api/v1/admin/laporan/export/excel?from=${report.period.fromValue}&to=${report.period.toValue}`;
  const pdfHref = `/api/v1/admin/laporan/export/pdf?from=${report.period.fromValue}&to=${report.period.toValue}`;
  const attentionRows = report.studentRows.filter((row) => (row.attendanceRate !== null && row.attendanceRate < 75) || row.openInvoiceAmount > 0);

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Ringkasan Administrasi"
        title="Laporan Operasional"
        description="Ringkasan periode untuk membantu Admin mengambil keputusan tentang siswa, kelas, kehadiran, progres, nilai, dan tagihan."
        actions={<><a href={pdfHref} className="tailadmin-button-primary gap-2"><DashboardIcon name="audit" className="size-4" />Unduh PDF</a><a href={excelHref} className="tailadmin-button-outline gap-2"><DashboardIcon name="registration" className="size-4" />Unduh Excel</a><a href={csvHref} className="tailadmin-button-outline gap-2"><DashboardIcon name="billing" className="size-4" />Unduh CSV</a></>}
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
        <ReportCard title="Tagihan Periode" value={formatRupiah(report.summary.invoiceTotal)} helper={`${report.summary.invoiceCount} tagihan tercatat`} />
        <ReportCard title="Sudah Dibayar" value={formatRupiah(report.summary.invoicePaid)} helper={`Status ${formatUiLabel("PAID")}`} />
        <ReportCard title="Perlu Ditindaklanjuti" value={formatRupiah(report.summary.invoiceOpen)} helper={["UNPAID", "PENDING", "OVERDUE"].map((status) => formatUiLabel(status)).join(", ")} warning={report.summary.invoiceOpen > 0} />
      </section>

      <section>
        <SectionHeader title="Ringkasan Kelas" description="Kelas aktif dengan metrik sesuai periode yang dipilih." />
        {report.classRows.length > 0 ? <div className="grid gap-4 xl:grid-cols-2">{report.classRows.map((row) => <ClassReportCard key={row.id} row={row} />)}</div> : <EmptyState icon="classes" title="Belum ada kelas aktif" description="Data kelas akan muncul setelah master kelas dibuat." />}
      </section>

      <section>
        <SectionHeader title="Siswa yang Perlu Perhatian" description="Siswa dengan kehadiran rendah atau tagihan terbuka pada periode ini." />
        {attentionRows.length > 0 ? (
          <div className="tailadmin-card overflow-hidden">
            <ResponsiveDataView
              rows={attentionRows}
              getRowKey={(row) => row.id}
              tableLabel="Siswa yang perlu perhatian"
              desktopBreakpoint="xl"
              testId="admin-attention-students"
              columns={[
                { id: "student", label: "Siswa", render: (row) => <><p className="font-semibold text-gray-900">{row.name}</p><p className="text-theme-xs text-gray-500">{row.nomorInduk}</p></> },
                { id: "program", label: "Program", render: (row) => <span className="text-gray-600">{row.program}</span> },
                { id: "attendance", label: "Kehadiran", render: (row) => <span className="font-semibold text-warning-700">{row.attendanceRate === null ? "-" : `${row.attendanceRate}%`}</span> },
                { id: "progress", label: "Progres", render: (row) => <span className="text-gray-700">{row.averageProgress ?? "-"}</span> },
                { id: "openInvoice", label: "Tagihan terbuka", render: (row) => row.openInvoiceAmount > 0 ? <Money value={row.openInvoiceAmount} className="font-semibold text-error-700" /> : "-" },
                { id: "action", label: "Aksi", render: (row) => <Link href={`/admin/siswa/${row.id}`} className="inline-flex min-h-11 items-center font-semibold text-limo-blue-700 hover:text-limo-blue-800">Buka detail</Link> },
              ]}
            />
          </div>
        ) : <EmptyState icon="student" title="Tidak ada perhatian khusus" description="Tidak ditemukan siswa dengan kehadiran rendah atau tagihan terbuka pada periode ini." />}
      </section>
    </main>
  );
}

function ReportCard({ title, value, helper, warning = false }: { title: string; value: string; helper: string; warning?: boolean }) {
  return <article className="tailadmin-card p-5"><span className={`grid size-11 place-items-center rounded-xl ${warning ? "bg-warning-50 text-warning-700" : "bg-limo-blue-50 text-limo-blue-700"}`}><DashboardIcon name="billing" className="size-5" /></span><p className="mt-4 text-xl font-semibold text-gray-900">{value}</p><p className="mt-1 text-theme-sm font-semibold text-gray-700">{title}</p><p className="mt-1 text-theme-xs text-gray-500">{helper}</p></article>;
}

function ClassReportCard({ row }: { row: { name: string; program: string; level: string; guru: string; students: number; attendanceRate: number | null; averageProgress: number | null; averageScore: number | null } }) {
  return <article className="tailadmin-card min-w-0 p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-700">{row.program} / {row.level}</p><h3 className="mt-1 truncate font-semibold text-gray-900" title={row.name}>{row.name}</h3><p className="mt-1 text-theme-xs text-gray-500">Guru: {row.guru} / {row.students} siswa aktif</p></div><span className="rounded-full bg-gray-50 px-3 py-1 text-theme-xs font-semibold text-gray-500">Kelas aktif</span></div><div className="mt-5 grid grid-cols-3 gap-2"><MetricStat align="center" rounded="2xl" truncateLabel valueClassName="text-lg" label="Hadir" value={row.attendanceRate === null ? "-" : `${row.attendanceRate}%`} /><MetricStat align="center" rounded="2xl" truncateLabel valueClassName="text-lg" label="Progres" value={row.averageProgress ?? "-"} /><MetricStat align="center" rounded="2xl" truncateLabel valueClassName="text-lg" label="Nilai" value={row.averageScore ?? "-"} /></div><div className="mt-4"><ProgressBar value={row.attendanceRate ?? 0} tone={(row.attendanceRate ?? 0) >= 80 ? "success" : "warning"} /></div></article>;
}
