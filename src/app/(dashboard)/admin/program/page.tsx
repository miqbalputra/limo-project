import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { listPrograms } from "@/server/services/master-data-service";
import { ProgramForm } from "@/components/dashboard/master-data-forms";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { MasterDataActions } from "@/components/dashboard/master-data-actions";
import { ProgramAvailabilityActions } from "@/components/dashboard/program-availability-actions";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { formatUiLabel } from "@/lib/ui-labels";

export const metadata = { title: "Program" };

export default async function AdminProgramPage({ searchParams }: { searchParams: Promise<{ search?: string; page?: string }> }) {
  const actor = await requireActor();
  await requirePermission(actor, "admin.masterdata.manage");
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search.trim() : "";
  const page = Number(params.page) || 1;
  const { items, pagination } = await listPrograms(actor, { search, page });

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Program</h1>
        <p className="mt-2 tailadmin-muted">Kelola program dan status pendaftaran setiap program.</p>
      </div>
      <ProgramForm />
      <form method="get" className="tailadmin-card grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input name="search" defaultValue={search} placeholder="Cari nama program" aria-label="Cari program" className="tailadmin-input" />
        <button type="submit" className="tailadmin-button-primary">Terapkan</button>
      </form>
      {items.length > 0 ? <section className="grid gap-4 md:grid-cols-2">
        {items.map((program) => (
          <article key={program.id} className="tailadmin-card p-5">
            <p className="text-theme-sm font-semibold text-limo-blue-700">{formatUiLabel(program.kind)}</p>
            <h2 className="mt-1 text-lg font-semibold text-gray-900">{program.name}</h2>
            <p className="mt-2 text-theme-sm text-gray-500">{program.description || "Belum ada deskripsi."}</p>
            <p className="mt-3 text-theme-sm text-gray-500">{program._count.levels} level, {program._count.kelas} kelas, {program._count.siswa} siswa</p>
            <ProgramAvailabilityActions id={program.id} current={program.registrationAvailability} note={program.registrationNote ?? ""} />
            <MasterDataActions resource="program" id={program.id} name={program.name} description={program.description || ""} archived={!program.isActive} />
          </article>
        ))}
      </section> : <EmptyState icon="program" title="Belum ada program" description="Buat program menggunakan formulir di atas." />}
      {pagination ? <PaginationControls basePath="/admin/program" page={pagination.page} totalPages={pagination.totalPages} params={{ search: search || undefined }} /> : null}
    </main>
  );
}
