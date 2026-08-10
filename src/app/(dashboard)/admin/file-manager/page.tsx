import Link from "next/link";
import { AdminFileManager } from "@/components/dashboard/admin-file-manager";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { requireActor, requireRole } from "@/server/auth/session";
import { listAdminMaterialFiles } from "@/server/services/admin-material-service";

export const metadata = { title: "Berkas Materi" };

const fileKinds = ["PDF", "IMAGE"] as const;

export default async function AdminFileManagerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const params = await searchParams;
  const search = getParam(params.search);
  const rawKind = getParam(params.kind);
  const kind = fileKinds.includes(rawKind as (typeof fileKinds)[number]) ? rawKind as (typeof fileKinds)[number] : "ALL";
  const page = Math.max(Number(getParam(params.page)) || 1, 1);
  const data = await listAdminMaterialFiles(actor, { search, kind, page, pageSize: 12 });

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Akademik / Berkas Materi"
        title="Berkas materi"
        description="Temukan PDF dan gambar materi yang diunggah Guru. Berkas tersimpan privat dan tetap mengikuti otorisasi LIMO."
        actions={<Link href="/admin/kelas" className="tailadmin-button-primary gap-2"><DashboardIcon name="classes" className="size-4" />Kelola materi</Link>}
        aside={<div className="rounded-2xl bg-gray-900 px-5 py-4 text-left text-white shadow-theme-lg"><p className="text-theme-xs text-white/60">Berkas tersimpan</p><p className="mt-1 text-3xl font-semibold">{data.stats.totalFiles}</p><p className="mt-1 text-theme-xs text-white/70">materi privat</p></div>}
      />

      <form method="get" className="tailadmin-card grid gap-3 p-4 md:grid-cols-[minmax(240px,1fr)_190px_auto]">
        <label><span className="sr-only">Cari berkas materi</span><input name="search" defaultValue={search} aria-label="Cari berkas materi" placeholder="Cari nama berkas, materi, atau kelas" className="tailadmin-input py-2.5" /></label>
        <label><span className="sr-only">Filter tipe berkas</span><select name="kind" defaultValue={kind === "ALL" ? "" : kind} aria-label="Filter tipe berkas" className="tailadmin-input py-2.5"><option value="">Semua tipe berkas</option><option value="PDF">PDF</option><option value="IMAGE">Gambar</option></select></label>
        <button type="submit" className="tailadmin-button-primary px-5">Terapkan</button>
      </form>

      <AdminFileManager files={data.items} folders={data.folders} stats={data.stats} />

      <PaginationControls basePath="/admin/file-manager" page={data.pagination.page} totalPages={data.pagination.totalPages} params={{ search: search || undefined, kind: kind === "ALL" ? undefined : kind }} />
    </main>
  );
}

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}
