import Link from "next/link";
import { notFound } from "next/navigation";
import { GradebookManager, type GradebookData, type Source } from "@/components/dashboard/gradebook-manager";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { prisma } from "@/server/db/prisma";
import { getGuruGradebook } from "@/server/services/gradebook-service";

export const metadata = { title: "Gradebook Kelas" };

export default async function GuruGradebookPage({ params }: { params: Promise<{ kelasId: string }> }) {
  if (!isFeatureEnabled("gradebookEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { kelasId } = await params;
  const [kelas, data, assignments, exams] = await Promise.all([
    prisma.kelas.findUnique({ where: { id: kelasId }, select: { id: true, name: true, program: { select: { name: true } }, level: { select: { name: true } } } }),
    getGuruGradebook(actor, kelasId),
    prisma.assignment.findMany({ where: { kelasId }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, maxScore: true, dueAt: true, status: true } }),
    prisma.ujian.findMany({ where: { kelasId }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, examDate: true, status: true } }),
  ]);
  if (!kelas) notFound();
  const sourceAssignments: Source[] = assignments.map((item) => ({ id: item.id, title: item.title, maxScore: item.maxScore, dueAt: item.dueAt, status: item.status }));
  const sourceExams: Source[] = exams.map((item) => ({ id: item.id, title: item.title, maxScore: 100, dueAt: item.examDate, status: item.status }));
  return <main className="space-y-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-theme-sm font-semibold text-brand-500">{kelas.program.name} / {kelas.level.name}</p><h1 className="mt-1 tailadmin-page-title">Gradebook {kelas.name}</h1><p className="mt-2 tailadmin-muted">Gabungkan nilai Assignment, Ujian, dan komponen manual dengan perhitungan server-side.</p></div><div className="flex flex-wrap gap-2"><Link href={`/guru/kelas/${kelasId}`} className="tailadmin-button-outline px-4 py-2">Kembali ke Kelas</Link><Link href={`/guru/kelas/${kelasId}/tugas`} className="tailadmin-button-outline px-4 py-2">Kelola Tugas</Link></div></div><GradebookManager classId={kelasId} initialData={serializeData(data)} assignments={sourceAssignments.map(serializeSource)} exams={sourceExams.map(serializeSource)} /></main>;
}

function serializeData(data: Awaited<ReturnType<typeof getGuruGradebook>>): GradebookData {
  return { ...data, items: data.items.map((item) => ({ ...item, dueAt: item.dueAt?.toISOString() || null })), rows: data.rows.map((row) => ({ ...row, finalGrade: row.finalGrade ? { status: row.finalGrade.status, publishedScore: row.finalGrade.publishedScore === null ? null : Number(row.finalGrade.publishedScore) } : null })) };
}

function serializeSource(source: Source): Source {
  return { ...source, dueAt: source.dueAt instanceof Date ? source.dueAt.toISOString() : source.dueAt };
}
