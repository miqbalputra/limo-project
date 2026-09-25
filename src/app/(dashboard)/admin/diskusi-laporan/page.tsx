import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { listDiskusiLaporan } from "@/server/services/diskusi-service";
import { DiskusiLaporanActions } from "@/components/dashboard/diskusi-laporan-actions";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { formatUiLabel, getUiToneClass } from "@/lib/ui-labels";

export const metadata = { title: "Laporan Diskusi" };

export default async function AdminDiskusiLaporanPage({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  if (!isFeatureEnabled("classDiscussionEnabled")) notFound();

  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const { page, status } = await searchParams;
  const filters: { status?: "OPEN" | "RESOLVED" | "DISMISSED" } = status === "OPEN" || status === "RESOLVED" || status === "DISMISSED" ? { status } : {};
  const data = await listDiskusiLaporan(actor, { page: Number(page) || 1, pageSize: 25 }, filters);

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Administrasi"
        title="Laporan Diskusi"
        description="Tinjau konten kelas yang dilaporkan, tentukan tindak lanjut, dan rapikan bila sudah selesai."
        aside={<div className="rounded-2xl bg-limo-blue-500 px-5 py-4 text-white shadow-theme-lg"><p className="text-theme-xs text-white/70">Total laporan</p><p className="mt-1 text-lg font-semibold">{data.pagination.totalItems}</p></div>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/diskusi-laporan" className={`px-3 py-1.5 text-theme-xs font-semibold ${!filters.status ? "rounded-full bg-limo-blue-50 text-limo-blue-700" : "rounded-xl text-gray-500 hover:text-gray-700"}`}>Semua</Link>
        <Link href="/admin/diskusi-laporan?status=OPEN" className={`px-3 py-1.5 text-theme-xs font-semibold ${filters.status === "OPEN" ? "rounded-full bg-limo-blue-50 text-limo-blue-700" : "rounded-xl text-gray-500 hover:text-gray-700"}`}>Belum ditangani</Link>
        <Link href="/admin/diskusi-laporan?status=RESOLVED" className={`px-3 py-1.5 text-theme-xs font-semibold ${filters.status === "RESOLVED" ? "rounded-full bg-limo-blue-50 text-limo-blue-700" : "rounded-xl text-gray-500 hover:text-gray-700"}`}>Selesai</Link>
        <Link href="/admin/diskusi-laporan?status=DISMISSED" className={`px-3 py-1.5 text-theme-xs font-semibold ${filters.status === "DISMISSED" ? "rounded-full bg-limo-blue-50 text-limo-blue-700" : "rounded-xl text-gray-500 hover:text-gray-700"}`}>Diabaikan</Link>
      </div>

      {data.items.length > 0 ? (
        <section className="space-y-4">
          {data.items.map((laporan) => (
            <article key={laporan.id} className="tailadmin-card min-w-0 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-700">{laporan.thread.kelas.program.name} / {laporan.thread.kelas.name}</p>
                  <h2 className="mt-1 break-words text-lg font-semibold text-gray-900">
                    <Link href={`/admin/diskusi-laporan/thread/${laporan.thread.id}`} className="hover:text-limo-blue-700">{laporan.thread.title}</Link>
                  </h2>
                  <p className="mt-1 text-theme-xs text-gray-500">Dilaporkan {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(laporan.createdAt))}oleh {laporan.reporter?.name ?? "Pengguna dihapus"}{laporan.replyId ? " (balasan)" : " (thread)"}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-theme-xs font-semibold ${getUiToneClass(laporan.status)}`}>{formatUiLabel(laporan.status)}</span>
              </div>
              <p className="mt-4 whitespace-pre-line rounded-2xl bg-gray-50 p-4 text-theme-sm leading-7 text-gray-700">Alasan: {laporan.alasan}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <Link href={`/admin/diskusi-laporan/thread/${laporan.thread.id}`} className="tailadmin-button-outline px-4 py-2">Buka konten</Link>
                <DiskusiLaporanActions id={laporan.id} status={laporan.status} />
              </div>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState icon="bell" title="Belum ada laporan" description="Laporan dari siswa atau wali akan tampil di sini." />
      )}

      <PaginationControls basePath="/admin/diskusi-laporan" page={data.pagination.page} totalPages={data.pagination.totalPages} params={{ status: filters.status }} />
    </main>
  );
}
