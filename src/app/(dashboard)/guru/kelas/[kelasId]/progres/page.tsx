import Link from "next/link";
import { ActivityCompletionMatrix } from "@/components/dashboard/activity-completion-matrix";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { getGuruActivityMatrix } from "@/server/services/activity-completion-service";
import { prisma } from "@/server/db/prisma";

export const metadata = { title: "Progres Aktivitas Kelas" };

export default async function GuruActivityProgressPage({ params }: { params: Promise<{ kelasId: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { kelasId } = await params;
  const [kelas, matrix] = await Promise.all([prisma.kelas.findUnique({ where: { id: kelasId }, select: { name: true, program: { select: { name: true } }, level: { select: { name: true } } } }), getGuruActivityMatrix(actor, kelasId)]);
  if (!kelas) return null;
  return <main className="space-y-6"><DashboardHero eyebrow={`${kelas.program.name} / ${kelas.level.name}`} title={`Progres Aktivitas ${kelas.name}`} description="Pantau penyelesaian aktivitas wajib, siswa yang tertinggal, dan tandai aturan manual dengan audit." actions={<Link href={`/guru/kelas/${kelasId}`} className="tailadmin-button-outline px-4 py-2">Kembali ke Kelas</Link>} /><ActivityCompletionMatrix classId={kelasId} modules={matrix.modules.map((module) => ({ ...module, items: module.items.map((item) => ({ id: item.id, title: item.title, itemType: item.itemType, isRequired: item.isRequired, rules: item.rules.map((rule) => ({ ruleType: rule.ruleType, isRequired: rule.isRequired })) })) }))} rows={matrix.rows} /></main>;
}
