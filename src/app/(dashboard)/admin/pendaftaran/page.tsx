import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { getPendaftaranSummary, listPendaftaran, type PendaftaranListFilters } from "@/server/services/pendaftaran-service";
import { PendaftaranActions } from "@/components/dashboard/pendaftaran-actions";
import { DashboardHero, EmptyState, MetricCard } from "@/components/dashboard/dashboard-widgets";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { PaginationControls } from "@/components/dashboard/pagination-controls";

export const metadata = {
  title: "Pendaftaran Admin",
};

const statusOptions = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"] as const;
type StatusFilter = (typeof statusOptions)[number];

const statusLabels: Record<StatusFilter, string> = {
  DRAFT: "Draf",
  SUBMITTED: "Baru masuk",
  UNDER_REVIEW: "Sedang ditinjau",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
};

const statusStyles: Record<StatusFilter, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SUBMITTED: "bg-limo-blue-50 text-limo-blue-700",
  UNDER_REVIEW: "bg-warning-50 text-warning-700",
  APPROVED: "bg-success-50 text-success-700",
  REJECTED: "bg-error-50 text-error-700",
  CANCELLED: "bg-gray-100 text-gray-600",
};

export default async function AdminPendaftaranPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const params = await searchParams;
  const page = Number(Array.isArray(params.page) ? params.page[0] : params.page) || 1;
  const search = String(Array.isArray(params.search) ? params.search[0] || "" : params.search || "").trim();
  const rawStatus = String(Array.isArray(params.status) ? params.status[0] || "" : params.status || "");
  const status = statusOptions.includes(rawStatus as StatusFilter) ? rawStatus as StatusFilter : "ALL";
  const filters: PendaftaranListFilters = { search: search || undefined, status: status === "ALL" ? undefined : status };
  const exportParams = new URLSearchParams();
  if (search) exportParams.set("search", search);
  if (status !== "ALL") exportParams.set("status", status);
  const exportQuery = exportParams.toString();
  const exportSuffix = exportQuery ? `?${exportQuery}` : "";
  const [{ items, pagination }, summary] = await Promise.all([listPendaftaran(actor, { page, pageSize: 12 }, filters), getPendaftaranSummary(actor)]);

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Operasional / Pendaftaran"
        title="Tinjau Pendaftaran"
        description="Kelola antrean calon siswa, periksa dokumen, dan ambil keputusan penerimaan dengan alur yang jelas."
        actions={<div className="flex flex-wrap gap-2"><Link href="#registration-queue" className="tailadmin-button-primary gap-2"><DashboardIcon name="registration" className="size-4" />Buka antrean peninjauan</Link><a href={`/api/v1/admin/pendaftaran/export/pdf${exportSuffix}`} className="tailadmin-button-outline gap-2"><DashboardIcon name="audit" className="size-4" />Unduh PDF</a><a href={`/api/v1/admin/pendaftaran/export/excel${exportSuffix}`} className="tailadmin-button-outline gap-2"><DashboardIcon name="registration" className="size-4" />Unduh XLSX</a></div>}
        aside={<div className="min-w-52 rounded-2xl bg-gray-900 px-5 py-4 text-left text-white shadow-theme-lg"><p className="text-theme-xs text-white/60">Perlu perhatian</p><p className="mt-1 text-3xl font-semibold">{summary.pending}</p><p className="mt-1 text-theme-xs text-white/70">pendaftaran menunggu keputusan</p></div>}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Ringkasan pendaftaran">
        <MetricCard label="Perlu ditindaklanjuti" value={summary.pending} description={`${summary.submitted} baru masuk; ${summary.underReview} sedang ditinjau`} icon="registration" tone={summary.pending > 0 ? "warning" : "success"} />
        <MetricCard label="Disetujui" value={summary.approved} description="Calon siswa berhasil diterima" icon="student" tone="success" />
        <MetricCard label="Ditolak" value={summary.rejected} description="Pendaftaran yang tidak disetujui" icon="audit" tone="error" />
        <MetricCard label="Total pendaftaran" value={summary.total} description={`${summary.cancelled} dibatalkan; semua periode`} icon="dashboard" tone="brand" />
      </section>

      <section id="registration-queue" className="tailadmin-card overflow-hidden" aria-labelledby="registration-queue-title">
        <div className="border-b border-gray-100 p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
               <p className="text-theme-xs font-semibold uppercase tracking-[0.18em] text-limo-blue-700">Antrean peninjauan</p>
              <h2 id="registration-queue-title" className="mt-1 text-lg font-semibold text-gray-900">Antrian pendaftaran</h2>
              <p className="mt-1 text-theme-sm text-gray-500">Menampilkan {pagination.totalItems} data yang sesuai dengan filter.</p>
            </div>
            <form method="get" className="grid gap-2 sm:grid-cols-[minmax(200px,1fr)_170px_auto]">
              <label>
                <span className="sr-only">Cari pendaftaran</span>
                <input name="search" defaultValue={search} aria-label="Cari pendaftaran" placeholder="Cari calon siswa, wali, kode" className="tailadmin-input py-2.5" />
              </label>
              <label>
                <span className="sr-only">Filter status pendaftaran</span>
                <select name="status" defaultValue={status === "ALL" ? "" : status} aria-label="Filter status pendaftaran" className="tailadmin-input py-2.5">
                  <option value="">Semua status</option>
                  {statusOptions.map((option) => <option key={option} value={option}>{statusLabels[option]}</option>)}
                </select>
              </label>
              <button type="submit" className="tailadmin-button-primary px-4 py-2.5">Filter</button>
            </form>
          </div>

          <div className="mt-4 flex flex-wrap gap-2" aria-label="Filter cepat status pendaftaran">
            <FilterLink href={filterHref("ALL", search)} label="Semua" count={summary.total} active={status === "ALL"} />
            <FilterLink href={filterHref("SUBMITTED", search)} label={statusLabels.SUBMITTED} count={summary.submitted} active={status === "SUBMITTED"} />
            <FilterLink href={filterHref("UNDER_REVIEW", search)} label={statusLabels.UNDER_REVIEW} count={summary.underReview} active={status === "UNDER_REVIEW"} />
            <FilterLink href={filterHref("APPROVED", search)} label={statusLabels.APPROVED} count={summary.approved} active={status === "APPROVED"} />
            <FilterLink href={filterHref("REJECTED", search)} label={statusLabels.REJECTED} count={summary.rejected} active={status === "REJECTED"} />
          </div>
        </div>

        {items.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {items.map((item) => <RegistrationCard key={item.id} item={item} />)}
          </div>
        ) : (
          <div className="p-5">
            <EmptyState icon="registration" title="Pendaftaran tidak ditemukan" description="Belum ada data yang cocok dengan filter saat ini. Coba ubah pencarian atau tampilkan semua status." action={<Link href="/admin/pendaftaran" className="tailadmin-button-outline px-4 py-2">Reset filter</Link>} />
          </div>
        )}
      </section>

      <PaginationControls basePath="/admin/pendaftaran" page={pagination.page} totalPages={pagination.totalPages} params={{ search: search || undefined, status: status === "ALL" ? undefined : status }} />
    </main>
  );
}

function RegistrationCard({ item }: { item: Awaited<ReturnType<typeof listPendaftaran>>["items"][number] }) {
  const status = item.status as StatusFilter;
  const actionDisabled = !["SUBMITTED", "UNDER_REVIEW"].includes(item.status);
  const progress = registrationProgress(status);
  const initials = item.studentName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "S";

  return (
    <article className="group p-4 transition hover:bg-gray-25 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-limo-blue-50 text-sm font-bold text-limo-blue-700">{initials}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/admin/pendaftaran/${item.id}`} className="truncate text-base font-semibold text-gray-900 hover:text-limo-blue-700">{item.studentName}</Link>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusStyles[status]}`}>{statusLabels[status]}</span>
            </div>
            <p className="mt-1 text-theme-xs text-gray-500">{item.kode} / {item.program.name} / {item.program.kind === "ARABIC" ? "Bahasa Arab" : "Bahasa Inggris"}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Link href={`/admin/pendaftaran/${item.id}`} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Lihat detail</Link>
          <PendaftaranActions id={item.id} disabled={actionDisabled} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl bg-gray-50 p-3 sm:grid-cols-3 sm:p-4">
        <InfoItem label="Wali" value={item.waliName} helper={item.waliEmail} />
        <InfoItem label="Dikirim" value={formatDate(item.submittedAt)} helper={item.submittedAt ? "Waktu Asia/Jakarta" : "Belum dikirim"} />
        <InfoItem label="Dokumen" value={`${item.files.length} file privat`} helper={item.files.length ? item.files[0].originalName : "Belum ada dokumen"} />
      </div>

      {item.files.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">{item.files.slice(0, 2).map((file) => <a key={file.id} href={`/api/v1/files/${file.id}`} className="inline-flex max-w-full items-center gap-1.5 truncate rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-theme-xs font-semibold text-limo-blue-700 hover:border-limo-blue-200 hover:bg-limo-blue-50"><DashboardIcon name="materials" className="size-3.5 shrink-0" />{file.originalName}</a>)}</div> : null}

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3 text-theme-xs"><span className="font-semibold text-gray-700">Progres peninjauan</span><span className="font-medium text-gray-500">{progress.label}</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${progress.color}`} style={{ width: `${progress.width}%` }} /></div>
      </div>
    </article>
  );
}

function InfoItem({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p><p className="mt-1 truncate text-theme-sm font-semibold text-gray-800" title={value}>{value}</p><p className="mt-0.5 truncate text-theme-xs text-gray-500" title={helper}>{helper}</p></div>;
}

function FilterLink({ href, label, count, active }: { href: string; label: string; count: number; active: boolean }) {
  return <Link href={href} aria-current={active ? "page" : undefined} className={`rounded-full px-3 py-1.5 text-theme-xs font-semibold transition ${active ? "bg-limo-blue-500 text-white shadow-theme-xs" : "bg-gray-50 text-gray-600 hover:bg-limo-blue-50 hover:text-limo-blue-700"}`}>{label} <span className={active ? "text-white/75" : "text-gray-400"}>({count})</span></Link>;
}

function filterHref(status: "ALL" | StatusFilter, search: string) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status !== "ALL") params.set("status", status);
  const query = params.toString();
  return query ? `/admin/pendaftaran?${query}` : "/admin/pendaftaran";
}

function registrationProgress(status: StatusFilter) {
  if (status === "DRAFT") return { label: "Draf", width: 15, color: "bg-gray-400" };
  if (status === "SUBMITTED") return { label: "Menunggu peninjauan", width: 35, color: "bg-limo-blue-500" };
  if (status === "UNDER_REVIEW") return { label: "Sedang diperiksa", width: 65, color: "bg-warning-500" };
  if (status === "APPROVED") return { label: "Selesai disetujui", width: 100, color: "bg-success-500" };
  return { label: status === "REJECTED" ? "Peninjauan selesai" : "Dibatalkan", width: 100, color: status === "REJECTED" ? "bg-error-500" : "bg-gray-400" };
}

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value) : "-";
}
