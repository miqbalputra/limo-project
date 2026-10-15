import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { getFeatureFlags } from "@/server/features/feature-flags";
import { listProgressReports } from "@/server/services/progress-report-service";
import { currentAutopilotPeriod, getReportAutopilotStatus } from "@/server/services/report-autopilot-service";
import { ReportAutopilotPanel } from "@/components/dashboard/report-autopilot-panel";
import { ProgressReportCard, type ProgressReportItem } from "@/components/dashboard/progress-report-card";
import { PaginationControls } from "@/components/dashboard/pagination-controls";

export const metadata = { title: "Laporan Perkembangan" };

export default async function AdminProgressReportsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await requireActor();
  await requirePermission(actor, "admin.reports.view");
  const flags = getFeatureFlags();
  if (!flags.periodicReportsEnabled) notFound();
  const { page } = await searchParams;

  const { items, pagination } = await listProgressReports(actor, { page: Number(page) || 1, pageSize: 50 });
  const autopilotStatus = flags.reportAutopilotEnabled ? await getReportAutopilotStatus(actor, currentAutopilotPeriod()) : null;

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Laporan Perkembangan</h1>
        <p className="mt-2 tailadmin-muted">Pantau laporan perkembangan yang dibuat guru. Total {pagination.totalItems} laporan.</p>
      </div>
      {autopilotStatus ? <ReportAutopilotPanel status={autopilotStatus} /> : null}
      {items.length === 0 ? <p className="tailadmin-card p-5 text-theme-sm text-gray-500">Belum ada laporan.</p> : null}
      <div className="space-y-4">
        {(items as unknown as ProgressReportItem[]).map((item) => (
          <ProgressReportCard key={item.id} item={item} />
        ))}
      </div>
      <PaginationControls basePath="/admin/laporan-perkembangan" page={pagination.page} totalPages={pagination.totalPages} />
    </main>
  );
}
