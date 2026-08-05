import Link from "next/link";
import { notFound } from "next/navigation";
import { AssignmentBuilder, type AssignmentView } from "@/components/dashboard/assignment-builder";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { RubricManager, type RubricOption } from "@/components/dashboard/rubric-manager";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { listGuruAssignments } from "@/server/services/assignment-service";
import { listRubrics } from "@/server/services/rubric-service";
import { prisma } from "@/server/db/prisma";

export const metadata = { title: "Tugas Online" };

export default async function GuruAssignmentsPage({ params }: { params: Promise<{ kelasId: string }> }) {
  if (!isFeatureEnabled("assignmentsEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { kelasId } = await params;
  const [kelas, { items }, rubrics] = await Promise.all([
    prisma.kelas.findUnique({ where: { id: kelasId }, select: { id: true, name: true, program: { select: { name: true } }, level: { select: { name: true } } } }),
    listGuruAssignments(actor, kelasId),
    listRubrics(actor),
  ]);
  if (!kelas) notFound();

  return (
    <main className="space-y-6">
      <DashboardHero eyebrow={`${kelas.program.name} / ${kelas.level.name}`} title={`Tugas ${kelas.name}`} description="Buat tugas harian terpisah dari ujian, atur waktu dan attempt, lalu pantau status submission Siswa." actions={<><Link href={`/guru/kelas/${kelasId}`} className="tailadmin-button-outline px-4 py-2">Kembali ke Kelas</Link><Link href={`/guru/kelas/${kelasId}/modul`} className="tailadmin-button-outline px-4 py-2">Buka Modul</Link></>} />
      <RubricManager initialRubrics={rubrics.items.map(serializeRubric)} />
      <AssignmentBuilder kelasId={kelasId} initialAssignments={items.map(serializeAssignment)} rubrics={rubrics.items.map(serializeRubric)} />
    </main>
  );
}

function serializeAssignment(assignment: Awaited<ReturnType<typeof listGuruAssignments>>["items"][number]): AssignmentView {
  return { ...assignment, availableFrom: assignment.availableFrom?.toISOString() || null, dueAt: assignment.dueAt?.toISOString() || null, cutoffAt: assignment.cutoffAt?.toISOString() || null, publishedAt: assignment.publishedAt?.toISOString() || null, createdAt: assignment.createdAt.toISOString(), updatedAt: assignment.updatedAt.toISOString() };
}

function serializeRubric(rubric: Awaited<ReturnType<typeof listRubrics>>["items"][number]): RubricOption {
  return { ...rubric, updatedAt: rubric.updatedAt.toISOString() };
}
