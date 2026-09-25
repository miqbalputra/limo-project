import { notFound } from "next/navigation";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { resolveWaliChildId } from "@/server/dal/wali-selector-dal";
import { listWaliDiskusi } from "@/server/services/diskusi-service";
import { DiskusiThreadCard } from "@/components/dashboard/diskusi-thread-view";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { PaginationControls } from "@/components/dashboard/pagination-controls";

export const metadata = { title: "Diskusi" };

export default async function WaliDiskusiPage({ searchParams }: { searchParams: Promise<{ anak?: string; page?: string }> }) {
  if (!isFeatureEnabled("classDiscussionEnabled")) notFound();

  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { anak, page } = await searchParams;
  const childId = await resolveWaliChildId(actor, anak);
  const data = await listWaliDiskusi(actor, childId, { page: Number(page) || 1, pageSize: 20 });

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Belajar di Rumah"
        title="Diskusi"
        description="Percakapan kelas anak terpilih. Anda dapat membalas pertanyaan kelas tanpa perlu berpindah menu."
        aside={<div className="rounded-2xl bg-limo-blue-500 px-5 py-4 text-white shadow-theme-lg"><p className="text-theme-xs text-white/70">Total diskusi</p><p className="mt-1 text-lg font-semibold">{data.pagination.totalItems}</p></div>}
      />

      {data.items.length > 0 ? (
        <section className="space-y-4">
          {data.items.map((thread) => <DiskusiThreadCard key={thread.id} thread={thread} href={`/wali/diskusi/${thread.id}`} manage={false} />)}
        </section>
      ) : (
        <EmptyState icon="bell" title="Belum ada diskusi" description="Diskusi kelas anak akan tampil di sini." />
      )}

      <PaginationControls basePath="/wali/diskusi" page={data.pagination.page} totalPages={data.pagination.totalPages} params={{ anak: childId ?? undefined }} />
    </main>
  );
}
