import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { LearningModuleList } from "@/components/dashboard/learning-module-list";
import type { LearningModuleView } from "@/components/dashboard/learning-module-builder";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { listWaliStudentModules } from "@/server/services/learning-module-service";
import { getStudentSummary } from "@/server/services/report-service";
import { getWaliModuleProgress } from "@/server/services/activity-completion-service";

export const metadata = { title: "Modul Anak" };

export default async function WaliStudentLearningModulesPage({ params }: { params: Promise<{ siswaId: string }> }) {
  if (!isFeatureEnabled("learningModulesEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { siswaId } = await params;
  const [{ siswa }, { classes }] = await Promise.all([getStudentSummary(actor, siswaId), listWaliStudentModules(actor, siswaId)]);
  const progressByClass = new Map(await Promise.all(classes.map(async (kelas) => [kelas.id, await getWaliModuleProgress(actor, siswaId, kelas.id)] as const)));

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow={`${siswa.nomorInduk} / ${siswa.program.name}`}
        title={`Modul Belajar ${siswa.name}`}
        description="Struktur modul ditampilkan untuk pemantauan saja. Aktivitas siswa tidak dapat dikerjakan atau diubah dari akun Wali."
        actions={<Link href={`/wali/progres/${siswaId}`} className="tailadmin-button-outline px-4 py-2">Kembali ke Progres</Link>}
      />
      {classes.length > 0 ? classes.map((kelas) => (
        <section key={kelas.id} className="space-y-3">
          <div><h2 className="text-lg font-semibold text-gray-900">{kelas.name}</h2><p className="text-theme-sm text-gray-500">{kelas.program.name} / {kelas.level.name}</p></div>
            <LearningModuleList modules={kelas.modules.items.map((module) => serializeModule(module, progressByClass.get(kelas.id)?.modules.find((progress) => progress.moduleId === module.id)))} emptyMessage="Belum ada modul yang diterbitkan untuk kelas ini." />
        </section>
      )) : <div className="tailadmin-card p-8 text-center text-theme-sm text-gray-500">Anak belum memiliki kelas aktif.</div>}
    </main>
  );
}

function serializeModule(module: Awaited<ReturnType<typeof listWaliStudentModules>>["classes"][number]["modules"]["items"][number], progress?: Awaited<ReturnType<typeof getWaliModuleProgress>>["modules"][number]): LearningModuleView {
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
    progress: progress ? { requiredItemCount: progress.requiredItemCount, completedRequiredItemCount: progress.completedRequiredItemCount, progressPercentage: progress.progressPercentage, completedAt: progress.completedAt?.toISOString() || null } : null,
    items: module.items.map((item) => ({
      ...item,
      availableFrom: item.availableFrom?.toISOString() || null,
      availableUntil: item.availableUntil?.toISOString() || null,
      completionRules: item.completionRules?.map((rule) => ({ ...rule, minimumScore: rule.minimumScore === null ? null : Number(rule.minimumScore) })) || [],
      completion: progress?.items.find((entry) => entry.moduleItemId === item.id) ? { status: progress.items.find((entry) => entry.moduleItemId === item.id)?.status || "NOT_STARTED", completedAt: progress.items.find((entry) => entry.moduleItemId === item.id)?.completedAt?.toISOString() || null, completionSource: progress.items.find((entry) => entry.moduleItemId === item.id)?.completionSource || null } : null,
    })),
  };
}
