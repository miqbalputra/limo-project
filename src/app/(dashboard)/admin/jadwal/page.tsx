import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { SessionWorkspace } from "@/components/dashboard/session-workspace";
import { requireActor, requireRole } from "@/server/auth/session";
import { listKelas } from "@/server/services/master-data-service";
import { listSessionWorkspace } from "@/server/services/lms-service";

export const metadata = { title: "Jadwal dan Sesi" };

const sessionStatuses = ["DRAFT", "FINAL", "CANCELLED"] as const;

export default async function AdminJadwalPage({ searchParams }: { searchParams: Promise<{ kelasId?: string; status?: string; page?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const params = await searchParams;
  const status = sessionStatuses.includes(params.status as (typeof sessionStatuses)[number]) ? params.status as (typeof sessionStatuses)[number] : undefined;
  const [{ items: classes }, { items: sessions, pagination }] = await Promise.all([
    listKelas(actor),
    listSessionWorkspace(actor, { kelasId: params.kelasId || undefined, status, page: Number(params.page) || 1, pageSize: 30 }),
  ]);

  return <main className="space-y-6"><DashboardHero eyebrow="Akademik / Jadwal" title="Jadwal dan sesi" description="Pantau dan kelola sesi kelas di seluruh program. Guru tetap menjadi pemilik operasional; perubahan Admin dicatat sebagai override administratif." /><section className="tailadmin-alert-warning"><strong>Ownership sesi:</strong> Guru mengelola sesi pada kelasnya. Admin dapat membuat, mengubah, atau membatalkan sesi lintas kelas sebagai override yang tercatat di audit.</section><SessionWorkspace scope="admin" classes={classes.map((item) => ({ id: item.id, name: item.name, programName: item.program.name, levelName: item.level.name, guruName: item.guruProfile?.user.name || null }))} sessions={sessions.map((item) => ({ ...item, sessionDate: item.sessionDate.toISOString(), kelas: { id: item.kelas.id, name: item.kelas.name, programName: item.kelas.program.name, levelName: item.kelas.level.name, guruName: item.kelas.guruProfile?.user.name || null } }))} selectedClassId={params.kelasId} selectedStatus={status} /><PaginationControls basePath="/admin/jadwal" page={pagination.page} totalPages={pagination.totalPages} params={{ kelasId: params.kelasId, status }} /></main>;
}
