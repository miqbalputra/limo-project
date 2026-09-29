import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { listLevels, listPrograms } from "@/server/services/master-data-service";
import { LevelForm } from "@/components/dashboard/master-data-forms";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { MasterDataActions } from "@/components/dashboard/master-data-actions";
import { PaginationControls } from "@/components/dashboard/pagination-controls";

export const metadata = { title: "Level" };

export default async function AdminLevelPage({ searchParams }: { searchParams: Promise<{ search?: string; programId?: string; page?: string }> }) {
  const actor = await requireActor();
  await requirePermission(actor, "admin.masterdata.manage");
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search.trim() : "";
  const programId = typeof params.programId === "string" ? params.programId : "";
  const page = Number(params.page) || 1;
  const [{ items: levels, pagination }, { items: programs }] = await Promise.all([
    listLevels(actor, { search, programId, page, pageSize: 20 }),
    listPrograms(actor),
  ]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Level</h1>
        <p className="mt-2 tailadmin-muted">Level digunakan untuk mengelompokkan kelas dalam program.</p>
      </div>
      <LevelForm programs={programs.map((program) => ({ id: program.id, name: program.name }))} />
      <form method="get" className="tailadmin-card grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_240px_auto]">
        <input name="search" defaultValue={search} placeholder="Cari nama level" aria-label="Cari level" className="tailadmin-input" />
        <select name="programId" defaultValue={programId} aria-label="Filter program level" className="tailadmin-input">
          <option value="">Semua program</option>
          {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
        </select>
        <button type="submit" className="tailadmin-button-primary">Terapkan</button>
      </form>
      {levels.length > 0 ? <section className="tailadmin-card overflow-hidden">
        {levels.map((level) => (
          <article key={level.id} className="border-b border-gray-200 p-5 last:border-b-0">
            <p className="text-theme-sm font-semibold text-limo-blue-700">{level.program.name}</p>
            <h2 className="mt-1 font-semibold text-gray-900">{level.order}. {level.name}</h2>
            <p className="mt-2 text-theme-sm text-gray-500">{level._count.kelas} kelas</p>
            <MasterDataActions resource="level" id={level.id} name={level.name} order={level.order} description={level.description || ""} archived={!level.isActive} />
          </article>
        ))}
      </section> : <EmptyState icon="levels" title={search || programId ? "Level tidak ditemukan" : "Belum ada level"} description={search || programId ? "Tidak ada level yang cocok dengan filter saat ini." : "Tambahkan level setelah program tersedia."} />}
      <PaginationControls basePath="/admin/level" page={pagination.page} totalPages={pagination.totalPages} params={{ search: search || undefined, programId: programId || undefined }} />
    </main>
  );
}
