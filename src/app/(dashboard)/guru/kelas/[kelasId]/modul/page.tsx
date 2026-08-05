import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { LearningModuleBuilder, type LearningModuleOptions, type LearningModuleView } from "@/components/dashboard/learning-module-builder";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { listModuleItemOptions, listGuruModules } from "@/server/services/learning-module-service";

export const metadata = { title: "Modul Pembelajaran" };

export default async function GuruLearningModulesPage({ params }: { params: Promise<{ kelasId: string }> }) {
  if (!isFeatureEnabled("learningModulesEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { kelasId } = await params;
  const [{ items }, options] = await Promise.all([listGuruModules(actor, kelasId), listModuleItemOptions(actor, kelasId)]);
  const kelas = items[0]?.kelas;

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow={kelas ? `${kelas.program.name} / ${kelas.level.name}` : "Pembelajaran terstruktur"}
        title={kelas ? `Modul ${kelas.name}` : "Modul Pembelajaran"}
        description="Susun materi, sesi, dan ujian menjadi alur belajar yang dapat dijadwalkan dan dipantau tanpa menghapus materi existing."
        actions={<Link href={`/guru/kelas/${kelasId}`} className="tailadmin-button-outline px-4 py-2">Kembali ke Kelas</Link>}
      />
      <LearningModuleBuilder kelasId={kelasId} initialModules={items.map(serializeModule)} options={serializeOptions(options)} />
    </main>
  );
}

function serializeModule(module: Awaited<ReturnType<typeof listGuruModules>>["items"][number]): LearningModuleView {
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

function serializeOptions(options: Awaited<ReturnType<typeof listModuleItemOptions>>): LearningModuleOptions {
  return options;
}
