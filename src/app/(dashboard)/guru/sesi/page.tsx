import Link from "next/link";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { SessionWorkspace } from "@/components/dashboard/session-workspace";
import { requireActor, requireRole } from "@/server/auth/session";
import { listMyKelas, listSessionWorkspace } from "@/server/services/lms-service";

export const metadata = { title: "Sesi Kelas" };

const sessionStatuses = ["DRAFT", "FINAL", "CANCELLED"] as const;

export default async function GuruSesiPage({ searchParams }: { searchParams: Promise<{ kelasId?: string; status?: string; page?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const params = await searchParams;
  const status = sessionStatuses.includes(params.status as (typeof sessionStatuses)[number]) ? params.status as (typeof sessionStatuses)[number] : undefined;
  const [{ items: classes }, { items: sessions, pagination }] = await Promise.all([
    listMyKelas(actor),
    listSessionWorkspace(actor, { kelasId: params.kelasId || undefined, status, page: Number(params.page) || 1, pageSize: 30 }),
  ]);

  return <main className="space-y-6"><DashboardHero eyebrow="Pembelajaran / Sesi" title="Sesi kelas" description="Kelola lifecycle sesi untuk kelas yang ditugaskan kepada Anda. Gunakan Jadwal untuk agenda dan Presensi/Progres untuk pelaksanaan sesi." actions={<Link href="/guru/jadwal" className="tailadmin-button-outline px-4 py-2.5">Buka agenda jadwal</Link>} /><SessionWorkspace scope="guru" classes={classes.map((item) => ({ id: item.id, name: item.name, programName: item.program.name, levelName: item.level.name }))} sessions={sessions.map((item) => ({ ...item, sessionDate: item.sessionDate.toISOString(), kelas: { id: item.kelas.id, name: item.kelas.name, programName: item.kelas.program.name, levelName: item.kelas.level.name } }))} selectedClassId={params.kelasId} selectedStatus={status} /><PaginationControls basePath="/guru/sesi" page={pagination.page} totalPages={pagination.totalPages} params={{ kelasId: params.kelasId, status }} /></main>;
}
