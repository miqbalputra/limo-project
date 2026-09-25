import { notFound } from "next/navigation";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { resolveWaliChildId } from "@/server/dal/wali-selector-dal";
import { listWaliPengumuman } from "@/server/services/pengumuman-service";
import { PengumumanCard } from "@/components/dashboard/pengumuman-card";
import { PengumumanReadButton } from "@/components/dashboard/pengumuman-read-button";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { PaginationControls } from "@/components/dashboard/pagination-controls";

export const metadata = { title: "Pengumuman" };

export default async function WaliPengumumanPage({ searchParams }: { searchParams: Promise<{ anak?: string; page?: string }> }) {
  if (!isFeatureEnabled("classDiscussionEnabled")) notFound();

  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { anak, page } = await searchParams;
  const childId = await resolveWaliChildId(actor, anak);
  const data = await listWaliPengumuman(actor, childId, { page: Number(page) || 1, pageSize: 20 });

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Belajar di Rumah"
        title="Pengumuman"
        description="Kabar resmi dari Guru untuk kelas anak terpilih. Pilihan anak dapat diubah dari pemilih anak di header."
        aside={<div className="rounded-2xl bg-limo-blue-500 px-5 py-4 text-white shadow-theme-lg"><p className="text-theme-xs text-white/70">Total pengumuman</p><p className="mt-1 text-lg font-semibold">{data.pagination.totalItems}</p></div>}
      />

      {data.items.length > 0 ? (
        <section className="space-y-4">
          {data.items.map((item) => <PengumumanCard key={item.id} item={item} actions={<PengumumanReadButton id={item.id} alreadyRead={item.isRead} />} />)}
        </section>
      ) : (
        <EmptyState icon="bell" title="Belum ada pengumuman" description="Pengumuman dari Guru untuk kelas anak akan tampil di sini." />
      )}

      <PaginationControls basePath="/wali/pengumuman" page={data.pagination.page} totalPages={data.pagination.totalPages} params={{ anak: childId ?? undefined }} />
    </main>
  );
}
