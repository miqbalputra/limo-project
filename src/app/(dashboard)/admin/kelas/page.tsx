import { requireActor, requireRole } from "@/server/auth/session";
import { listGuruOptions, listKelas, listLevels, listPrograms } from "@/server/services/master-data-service";
import { KelasForm } from "@/components/dashboard/master-data-forms";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { KelasReportCards } from "@/components/dashboard/admin-kelas-report";

export const metadata = { title: "Kelas" };

export default async function AdminKelasPage() {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const [{ items: kelas }, { items: programs }, { items: levels }, { items: gurus }] = await Promise.all([
    listKelas(actor),
    listPrograms(actor),
    listLevels(actor),
    listGuruOptions(actor),
  ]);

  return (
    <main className="space-y-6">
      <DashboardHero eyebrow="Master Data / Akademik" title="Kelas" description="Kelola struktur kelas, guru pengampu, kapasitas siswa, dan status operasional dalam satu laporan interaktif." actions={<a href="#kelas-report" className="tailadmin-button-outline px-4 py-2.5">Lihat laporan kelas</a>} />
      <KelasForm
        programs={programs.map((program) => ({ id: program.id, name: program.name }))}
        levels={levels.map((level) => ({ id: level.id, name: `${level.program.name} - ${level.name}`, programId: level.program.id }))}
        gurus={gurus}
      />
      <KelasReportCards classes={kelas} guruOptions={gurus} />
    </main>
  );
}
