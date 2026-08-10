import Link from "next/link";
import { notFound } from "next/navigation";
import { RemedialManager } from "@/components/dashboard/remedial-manager";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { listGuruRemedials } from "@/server/services/remedial-service";
import { prisma } from "@/server/db/prisma";

export const metadata = { title: "Remedial dan Revisi" };

export default async function GuruRemedialPage({ params }: { params: Promise<{ kelasId: string }> }) {
  if (!isFeatureEnabled("remedialEnabled") || !isFeatureEnabled("assignmentsEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { kelasId } = await params;
  const [kelas, assignments, students, { items: remedials }] = await Promise.all([
    prisma.kelas.findUnique({ where: { id: kelasId }, select: { id: true, name: true, program: { select: { name: true } }, level: { select: { name: true } } } }),
    prisma.assignment.findMany({ where: { kelasId, status: "PUBLISHED" }, orderBy: { title: "asc" }, select: { id: true, title: true, maxScore: true } }),
    prisma.kelasSiswa.findMany({ where: { kelasId, status: "ACTIVE", siswa: { status: "ACTIVE", deletedAt: null } }, orderBy: { siswa: { name: "asc" } }, select: { siswa: { select: { id: true, name: true, nomorInduk: true } } } }),
    listGuruRemedials(actor, kelasId),
  ]);
  if (!kelas) notFound();
  return <main className="space-y-6"><DashboardHero eyebrow={`${kelas.program.name} / ${kelas.level.name}`} title={`Remedial ${kelas.name}`} description="Tugaskan perbaikan secara terarah, gunakan alur tugas yang sudah ada, dan pantau kebijakan nilai tanpa menghapus nilai awal." actions={<Link href={`/guru/kelas/${kelasId}`} className="tailadmin-button-outline px-4 py-2">Kembali ke Kelas</Link>} /><RemedialManager classId={kelasId} assignments={assignments.map((assignment) => ({ ...assignment, maxScore: Number(assignment.maxScore) }))} students={students.map((enrollment) => enrollment.siswa)} initialRemedials={remedials.map((item) => ({ ...item, availableFrom: item.availableFrom?.toISOString() || null, dueAt: item.dueAt.toISOString(), createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() }))} /></main>;
}
