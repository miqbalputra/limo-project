import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { listPengumuman } from "@/server/services/pengumuman-service";
import { formatJakartaDateTimeLocal } from "@/server/time/jakarta";
import { PengumumanCard } from "@/components/dashboard/pengumuman-card";
import { PengumumanActions } from "@/components/dashboard/pengumuman-actions";
import { PengumumanForm } from "@/components/dashboard/pengumuman-form";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { PaginationControls } from "@/components/dashboard/pagination-controls";

export const metadata = { title: "Pengumuman Kelas" };

export default async function GuruPengumumanPage({ params, searchParams }: { params: Promise<{ kelasId: string }>; searchParams: Promise<{ page?: string }> }) {
  if (!isFeatureEnabled("classDiscussionEnabled")) notFound();

  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { kelasId } = await params;
  const { page } = await searchParams;
  const data = await listPengumuman(actor, kelasId, { page: Number(page) || 1, pageSize: 20 });

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow={`${data.kelas.program.name} / ${data.kelas.level.name}`}
        title={`Pengumuman ${data.kelas.name}`}
        description="Kirim pemberitahuan ke siswa dan wali kelas ini. Pengumuman terjadwal baru tampil dan mengirim notifikasi setelah waktu terbitnya lewat."
        actions={<Link href={`/guru/kelas/${kelasId}`} className="tailadmin-button-outline px-4 py-2">Kembali ke kelas</Link>}
      />

      <section className="tailadmin-card p-5">
        <PengumumanForm kelasId={kelasId} />
      </section>

      {data.items.length > 0 ? (
        <section className="space-y-4">
          {data.items.map((item) => (
            <PengumumanCard
              key={item.id}
              item={item}
              actions={
                <PengumumanActions
                  id={item.id}
                  kelasId={kelasId}
                  status={item.status}
                  initial={{
                    title: item.title,
                    content: item.content,
                    priority: item.priority,
                    audience: item.audience,
                    publishAt: formatJakartaDateTimeLocal(item.publishAt),
                    expiresAt: formatJakartaDateTimeLocal(item.expiresAt),
                    status: item.status,
                  }}
                />
              }
            />
          ))}
        </section>
      ) : (
        <EmptyState icon="bell" title="Belum ada pengumuman" description="Buat pengumuman pertama untuk kelas ini agar siswa dan wali mendapat kabar." />
      )}

      <PaginationControls basePath={`/guru/kelas/${kelasId}/pengumuman`} page={data.pagination.page} totalPages={data.pagination.totalPages} />
    </main>
  );
}
