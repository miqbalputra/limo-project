import { requireActor, requireRole } from "@/server/auth/session";
import { listLevels, listPrograms } from "@/server/services/master-data-service";
import { LevelForm } from "@/components/dashboard/master-data-forms";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { MasterDataActions } from "@/components/dashboard/master-data-actions";

export const metadata = { title: "Level" };

export default async function AdminLevelPage() {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const [{ items: levels }, { items: programs }] = await Promise.all([listLevels(actor), listPrograms(actor)]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Level</h1>
        <p className="mt-2 tailadmin-muted">Level digunakan untuk mengelompokkan kelas dalam program.</p>
      </div>
      <LevelForm programs={programs.map((program) => ({ id: program.id, name: program.name }))} />
      {levels.length > 0 ? <section className="tailadmin-card overflow-hidden">
        {levels.map((level) => (
          <article key={level.id} className="border-b border-gray-200 p-5 last:border-b-0">
            <p className="text-theme-sm font-semibold text-brand-500">{level.program.name}</p>
            <h2 className="mt-1 font-semibold text-gray-900">{level.order}. {level.name}</h2>
            <p className="mt-2 text-theme-sm text-gray-500">{level._count.kelas} kelas</p>
            <MasterDataActions resource="level" id={level.id} name={level.name} order={level.order} description={level.description || ""} archived={!level.isActive} />
          </article>
        ))}
      </section> : <EmptyState icon="levels" title="Belum ada level" description="Tambahkan level setelah program tersedia." />}
    </main>
  );
}
