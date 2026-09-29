import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { listGuruOptions, listKelas, listLevels, listPrograms } from "@/server/services/master-data-service";
import { KelasForm } from "@/components/dashboard/master-data-forms";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { KelasReportCards } from "@/components/dashboard/admin-kelas-report";
import { PaginationControls } from "@/components/dashboard/pagination-controls";

export const metadata = { title: "Kelas" };

export default async function AdminKelasPage({ searchParams }: { searchParams: Promise<{ search?: string; page?: string }> }) {
  const actor = await requireActor();
  await requirePermission(actor, "admin.masterdata.manage");
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search.trim() : "";
  const page = Number(params.page) || 1;
  const [{ items: kelas, pagination }, { items: programs }, { items: levels }, { items: gurus }] = await Promise.all([
    listKelas(actor, { search, page }),
    listPrograms(actor),
    listLevels(actor, { pageSize: 100 }),
    listGuruOptions(actor),
  ]);

  return (
    <main className="space-y-6">
      <DashboardHero eyebrow="Master Data / Akademik" title="Kelas" description="Kelola struktur kelas, guru pengampu, kapasitas siswa, dan status operasional dalam satu laporan interaktif." actions={<a href="#kelas-report" className="tailadmin-button-outline px-4 py-2.5">Lihat laporan kelas</a>} />
      <form method="get" className="tailadmin-card grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input name="search" defaultValue={search} placeholder="Cari nama kelas" aria-label="Cari kelas" className="tailadmin-input" />
        <button type="submit" className="tailadmin-button-primary">Terapkan</button>
      </form>
      <KelasForm
        programs={programs.map((program) => ({ id: program.id, name: program.name }))}
        levels={levels.map((level) => ({ id: level.id, name: `${level.program.name} - ${level.name}`, programId: level.program.id }))}
        gurus={gurus}
      />
      <KelasReportCards classes={kelas} guruOptions={gurus} />
      {pagination ? <PaginationControls basePath="/admin/kelas" page={pagination.page} totalPages={pagination.totalPages} params={{ search: search || undefined }} /> : null}
    </main>
  );
}
