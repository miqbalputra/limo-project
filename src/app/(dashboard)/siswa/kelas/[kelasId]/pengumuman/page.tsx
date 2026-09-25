import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { listPengumuman } from "@/server/services/pengumuman-service";
import { PengumumanCard } from "@/components/dashboard/pengumuman-card";
import { PengumumanReadButton } from "@/components/dashboard/pengumuman-read-button";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { PaginationControls } from "@/components/dashboard/pagination-controls";

export const metadata = { title: "Pengumuman Kelas" };

export default async function StudentPengumumanPage({ params, searchParams }: { params: Promise<{ kelasId: string }>; searchParams: Promise<{ page?: string }> }) {
  if (!isFeatureEnabled("studentPortalEnabled") || !isFeatureEnabled("classDiscussionEnabled")) notFound();

  const actor = await requireActor();
  requireRole(actor, ["SISWA"]);
  const { kelasId } = await params;
  const { page } = await searchParams;
  const data = await listPengumuman(actor, kelasId, { page: Number(page) || 1, pageSize: 20 });

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow={`${data.kelas.program.name} / ${data.kelas.level.name}`}
        title={`Pengumuman ${data.kelas.name}`}
        description="Informasi resmi dari Guru untuk kelas ini. Tandai pengumuman sebagai sudah dibaca agar statusnya tercatat."
        actions={<Link href={`/siswa/kelas/${kelasId}`} className="tailadmin-button-outline px-4 py-2">Kembali ke kelas</Link>}
      />

      {data.items.length > 0 ? (
        <section className="space-y-4">
          {data.items.map((item) => <PengumumanCard key={item.id} item={item} actions={<PengumumanReadButton id={item.id} alreadyRead={item.isRead} />} />)}
        </section>
      ) : (
        <EmptyState icon="bell" title="Belum ada pengumuman" description="Pengumuman dari Guru akan tampil di sini." />
      )}

      <PaginationControls basePath={`/siswa/kelas/${kelasId}/pengumuman`} page={data.pagination.page} totalPages={data.pagination.totalPages} />
    </main>
  );
}
