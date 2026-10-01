import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { getFeatureFlags } from "@/server/features/feature-flags";
import { listProgressReports } from "@/server/services/progress-report-service";
import { ProgressReportCard, type ProgressReportItem } from "@/components/dashboard/progress-report-card";

export const metadata = { title: "Laporan Perkembangan" };

export default async function SiswaProgressReportsPage() {
  const actor = await requireActor();
  await requirePermission(actor, "siswa.report.view");
  if (!getFeatureFlags().periodicReportsEnabled) notFound();

  const { items } = await listProgressReports(actor, {});

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Laporan Perkembangan</h1>
        <p className="mt-2 tailadmin-muted">Laporan perkembangan belajarmu yang sudah diterbitkan guru.</p>
      </div>
      {items.length === 0 ? <p className="tailadmin-card p-5 text-theme-sm text-gray-500">Belum ada laporan yang diterbitkan.</p> : null}
      <div className="space-y-4">
        {(items as unknown as ProgressReportItem[]).map((item) => (
          <ProgressReportCard key={item.id} item={item} read={{ endpoint: `/api/v1/siswa/reports/${item.id}/read` }} />
        ))}
      </div>
    </main>
  );
}
