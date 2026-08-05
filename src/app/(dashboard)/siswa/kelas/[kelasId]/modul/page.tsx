import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { LearningModuleList } from "@/components/dashboard/learning-module-list";
import type { LearningModuleView } from "@/components/dashboard/learning-module-builder";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { getStudentClass } from "@/server/services/student-service";
import { listStudentModules } from "@/server/services/learning-module-service";

export const metadata = { title: "Alur Modul" };

export default async function StudentLearningModulesPage({ params }: { params: Promise<{ kelasId: string }> }) {
  if (!isFeatureEnabled("studentPortalEnabled") || !isFeatureEnabled("learningModulesEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["SISWA"]);
  const { kelasId } = await params;
  const [{ kelas }, { items }] = await Promise.all([getStudentClass(actor, kelasId), listStudentModules(actor, kelasId)]);

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow={`${kelas.program.name} / ${kelas.level.name}`}
        title={`Alur Belajar ${kelas.name}`}
        description="Ikuti modul sesuai urutan. Aktivitas yang belum tersedia atau masih terkunci akan terbuka setelah waktunya atau prasyaratnya terpenuhi."
        actions={<Link href={`/siswa/kelas/${kelasId}`} className="tailadmin-button-outline px-4 py-2">Kembali ke Kelas</Link>}
      />
      <LearningModuleList modules={items.map(serializeModule)} emptyMessage="Guru belum mempublikasikan modul untuk kelas ini." />
    </main>
  );
}

function serializeModule(module: Awaited<ReturnType<typeof listStudentModules>>["items"][number]): LearningModuleView {
  return {
    id: module.id,
    kelasId: module.kelasId,
    title: module.title,
    description: module.description,
    order: module.order,
    status: module.status,
    releaseAt: module.releaseAt?.toISOString() || null,
    dueAt: module.dueAt?.toISOString() || null,
    publishedAt: module.publishedAt?.toISOString() || null,
    items: module.items.map((item) => ({
      ...item,
      availableFrom: item.availableFrom?.toISOString() || null,
      availableUntil: item.availableUntil?.toISOString() || null,
    })),
  };
}
