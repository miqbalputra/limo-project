import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { listDiskusiThreads } from "@/server/services/diskusi-service";
import { DiskusiThreadCard } from "@/components/dashboard/diskusi-thread-view";
import { DiskusiThreadForm } from "@/components/dashboard/diskusi-thread-form";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { PaginationControls } from "@/components/dashboard/pagination-controls";

export const metadata = { title: "Diskusi Kelas" };

export default async function StudentDiskusiPage({ params, searchParams }: { params: Promise<{ kelasId: string }>; searchParams: Promise<{ page?: string; pageSize?: string }> }) {
  if (!isFeatureEnabled("studentPortalEnabled") || !isFeatureEnabled("classDiscussionEnabled")) notFound();

  const actor = await requireActor();
  requireRole(actor, ["SISWA"]);
  const { kelasId } = await params;
  const { page, pageSize } = await searchParams;
  const size = Number(pageSize) || 20;
  const data = await listDiskusiThreads(actor, kelasId, { page: Number(page) || 1, pageSize: size });

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow={`${data.kelas.program.name} / ${data.kelas.level.name}`}
        title={`Diskusi ${data.kelas.name}`}
        description="Tanyakan hal yang belum jelas di kelas ini. Guru akan menjawab dan menandai jawaban terbaik."
        actions={<Link href={`/siswa/kelas/${kelasId}`} className="tailadmin-button-outline px-4 py-2">Kembali ke kelas</Link>}
      />

      <section className="tailadmin-card p-5"><DiskusiThreadForm kelasId={kelasId} /></section>

      {data.items.length > 0 ? (
        <section className="space-y-4">
          {data.items.map((thread) => <DiskusiThreadCard key={thread.id} thread={thread} href={`/siswa/kelas/${kelasId}/diskusi/${thread.id}`} manage={data.manage} />)}
        </section>
      ) : (
        <EmptyState icon="bell" title="Belum ada diskusi" description="Ajukan pertanyaan pertama Anda untuk kelas ini." />
      )}

      <PaginationControls basePath={`/siswa/kelas/${kelasId}/diskusi`} page={data.pagination.page} totalPages={data.pagination.totalPages} params={{ pageSize: size }} />
    </main>
  );
}
