import { notFound } from "next/navigation";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { listSchoolPengumuman } from "@/server/services/pengumuman-service";
import { formatJakartaDateTimeLocal } from "@/server/time/jakarta";
import { PengumumanCard } from "@/components/dashboard/pengumuman-card";
import { PengumumanActions } from "@/components/dashboard/pengumuman-actions";
import { PengumumanForm } from "@/components/dashboard/pengumuman-form";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { PaginationControls } from "@/components/dashboard/pagination-controls";

export const metadata = { title: "Pengumuman Sekolah" };

export default async function AdminPengumumanPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  if (!isFeatureEnabled("classDiscussionEnabled")) notFound();

  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const { page } = await searchParams;
  const data = await listSchoolPengumuman(actor, { page: Number(page) || 1, pageSize: 20 });

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Administrasi / Komunikasi"
        title="Pengumuman Sekolah"
        description="Sebar pengumuman ke seluruh siswa dan wali tanpa terikat kelas. Pengumuman terjadwal baru tampil setelah waktu terbitnya lewat."
      />

      <section className="tailadmin-card p-5">
        <PengumumanForm kelasId="" />
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
                  kelasId=""
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
        <EmptyState icon="bell" title="Belum ada pengumuman sekolah" description="Buat pengumuman pertama untuk seluruh siswa dan wali." />
      )}

      <PaginationControls basePath="/admin/pengumuman" page={data.pagination.page} totalPages={data.pagination.totalPages} />
    </main>
  );
}
