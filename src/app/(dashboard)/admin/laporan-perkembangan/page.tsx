import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { getFeatureFlags } from "@/server/features/feature-flags";
import { listProgressReports } from "@/server/services/progress-report-service";
import { ProgressReportCard, type ProgressReportItem } from "@/components/dashboard/progress-report-card";

export const metadata = { title: "Laporan Perkembangan" };

export default async function AdminProgressReportsPage() {
  const actor = await requireActor();
  await requirePermission(actor, "admin.reports.view");
  if (!getFeatureFlags().periodicReportsEnabled) notFound();

  const { items, pagination } = await listProgressReports(actor, { pageSize: 50 });

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Laporan Perkembangan</h1>
        <p className="mt-2 tailadmin-muted">Pantau laporan perkembangan yang dibuat guru. Total {pagination.totalItems} laporan.</p>
      </div>
      {items.length === 0 ? <p className="tailadmin-card p-5 text-theme-sm text-gray-500">Belum ada laporan.</p> : null}
      <div className="space-y-4">
        {(items as unknown as ProgressReportItem[]).map((item) => (
          <ProgressReportCard key={item.id} item={item} />
        ))}
      </div>
    </main>
  );
}
