import { requireActor, requireRole } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { createPaginationMeta, resolvePagination } from "@/server/pagination";
import { PaginationControls } from "@/components/dashboard/pagination-controls";

export const metadata = { title: "Audit Log" };

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const params = await searchParams;
  const filters = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const page = Number(filters.page) || 1;
  const pagination = resolvePagination({ page, pageSize: 25 }, 25);
  const exportParams = new URLSearchParams();
  for (const key of ["search", "action", "entityType"]) {
    if (filters[key]) exportParams.set(key, filters[key]);
  }
  const where = {
    ...(filters.action ? { action: { contains: filters.action } } : {}),
    ...(filters.entityType ? { entityType: { contains: filters.entityType } } : {}),
    ...(filters.search ? { OR: [{ action: { contains: filters.search } }, { entityType: { contains: filters.search } }, { entityId: { contains: filters.search } }] } : {}),
  };

  const [totalItems, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        reason: true,
        metadata: true,
        ipAddress: true,
        createdAt: true,
        actor: { select: { name: true, email: true, role: true } },
      },
    }),
  ]);
  const paginationMeta = createPaginationMeta(pagination.page, pagination.pageSize, totalItems);

  return (
    <main className="space-y-6">
      <div>
        <p className="text-theme-sm font-medium text-gray-500">Administrasi Sistem</p>
        <h1 className="mt-1 tailadmin-page-title">Audit Log</h1>
        <p className="mt-2 tailadmin-muted">Riwayat 100 aktivitas terbaru untuk approval, auth, data siswa, LMS, ujian, presensi, dan pembayaran.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Total Ditampilkan" value={String(items.length)} />
        <Metric label="Auth" value={String(items.filter((item) => item.action.includes("LOGIN") || item.action.includes("PASSWORD") || item.action.includes("USER")).length)} />
        <Metric label="Akademik" value={String(items.filter((item) => ["Materi", "BankSoal", "Ujian", "HasilUjian", "SesiKelas"].includes(item.entityType)).length)} />
        <Metric label="Operasional" value={String(items.filter((item) => ["Siswa", "Pendaftaran", "Tagihan", "Pembayaran"].includes(item.entityType)).length)} />
      </section>

      <form method="get" className="tailadmin-card grid gap-3 p-4 md:grid-cols-[1fr_180px_180px_auto]">
        <input name="search" defaultValue={filters.search || ""} aria-label="Cari audit log" placeholder="Cari aksi, entitas, atau ID" className="tailadmin-input" />
        <input name="action" defaultValue={filters.action || ""} aria-label="Filter aksi" placeholder="Filter aksi" className="tailadmin-input" />
        <input name="entityType" defaultValue={filters.entityType || ""} aria-label="Filter tipe entitas" placeholder="Tipe entitas" className="tailadmin-input" />
        <div className="flex flex-wrap items-center gap-2">
          <button className="tailadmin-button-primary">Terapkan</button>
          <a href={`/api/v1/admin/audit/export?${exportParams.toString()}`} className="tailadmin-button-secondary">Unduh CSV</a>
        </div>
      </form>

      <section className="tailadmin-card overflow-hidden">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Aktivitas Terbaru</h2>
          <p className="mt-1 text-theme-xs text-gray-500">Diurutkan dari aktivitas paling baru.</p>
        </div>
        <div className="hidden grid-cols-[170px_1fr_1fr_130px] gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-theme-xs font-semibold uppercase tracking-wide text-gray-500 lg:grid">
          <span>Waktu</span>
          <span>Aksi</span>
          <span>Actor</span>
          <span>Entitas</span>
        </div>
         {items.length > 0 ? <div className="divide-y divide-gray-100">
           {items.map((item) => (
             <article key={item.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[170px_1fr_1fr_130px] lg:items-start lg:gap-4">
               <div>
                 <p className="text-theme-sm font-semibold text-gray-900">{formatDate(item.createdAt)}</p>
                 <p className="text-theme-xs text-gray-500">{item.ipAddress || "IP tidak tercatat"}</p>
               </div>
               <div>
                 <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-theme-xs font-semibold text-brand-600">{item.action}</span>
                 {item.reason ? <p className="mt-2 text-theme-sm text-gray-600">{item.reason}</p> : null}
                 {formatMetadata(item.metadata) ? <p className="mt-2 break-all rounded-lg bg-gray-50 p-2 text-theme-xs text-gray-500">{formatMetadata(item.metadata)}</p> : null}
               </div>
               <div>
                 <p className="text-theme-sm font-semibold text-gray-900">{item.actor?.name ?? "System"}</p>
                 <p className="text-theme-xs text-gray-500">{item.actor?.email ?? "system"}{item.actor ? ` / ${item.actor.role}` : ""}</p>
               </div>
               <div>
                 <p className="text-theme-sm font-semibold text-gray-900">{item.entityType}</p>
                 <p className="break-all text-theme-xs text-gray-500">{item.entityId ?? "-"}</p>
               </div>
             </article>
           ))}
         </div> : <EmptyState icon="audit" title="Belum ada aktivitas audit" description="Aktivitas sensitif Admin, Guru, dan Wali akan muncul di sini." />}
       </section>
       <PaginationControls basePath="/admin/audit" page={paginationMeta.page} totalPages={paginationMeta.totalPages} params={{ search: filters.search, action: filters.action, entityType: filters.entityType }} />
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="tailadmin-card p-5">
      <p className="text-theme-sm text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
    </article>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function formatMetadata(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return JSON.stringify(value);
}
