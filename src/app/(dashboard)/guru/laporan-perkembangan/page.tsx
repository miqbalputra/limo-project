import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { getFeatureFlags } from "@/server/features/feature-flags";
import { prisma } from "@/server/db/prisma";
import { listMyKelas } from "@/server/services/lms-service";
import { listProgressReports } from "@/server/services/progress-report-service";
import { ProgressReportWorkspace } from "@/components/dashboard/progress-report-workspace";
import type { ProgressReportItem } from "@/components/dashboard/progress-report-card";

export const metadata = { title: "Laporan Perkembangan" };

export default async function GuruProgressReportsPage() {
  const actor = await requireActor();
  await requirePermission(actor, "guru.report.manage");
  if (!getFeatureFlags().periodicReportsEnabled) notFound();

  const [{ items: kelas }, { items: reports }] = await Promise.all([
    listMyKelas(actor),
    listProgressReports(actor, {}),
  ]);

  const kelasIds = kelas.map((item) => item.id);
  const enrollments = kelasIds.length
    ? await prisma.kelasSiswa.findMany({
        where: { kelasId: { in: kelasIds }, status: "ACTIVE", siswa: { status: "ACTIVE", deletedAt: null } },
        orderBy: { siswa: { name: "asc" } },
        select: { kelasId: true, siswa: { select: { id: true, name: true, nomorInduk: true } } },
      })
    : [];

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Laporan Perkembangan</h1>
        <p className="mt-2 tailadmin-muted">
          Buat draf laporan dari data periode, lengkapi narasi, lalu terbitkan ke wali dan siswa. Snapshot data dikunci saat draf dibuat sehingga koreksi data setelah terbit tidak mengubah laporan lama.
        </p>
      </div>
      <ProgressReportWorkspace
        kelasOptions={kelas.map((item) => ({ id: item.id, name: `${item.program.name} - ${item.name}` }))}
        students={enrollments.map((entry) => ({ kelasId: entry.kelasId, id: entry.siswa.id, name: entry.siswa.name, nomorInduk: entry.siswa.nomorInduk }))}
        initialItems={reports as unknown as ProgressReportItem[]}
      />
    </main>
  );
}
