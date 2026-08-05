import Link from "next/link";
import { notFound } from "next/navigation";
import { GradebookViewer } from "@/components/dashboard/gradebook-viewer";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { getStudentGradebook } from "@/server/services/gradebook-service";
import { prisma } from "@/server/db/prisma";

export const metadata = { title: "Nilai Kelas" };

export default async function StudentGradebookPage({ params }: { params: Promise<{ kelasId: string }> }) {
  if (!isFeatureEnabled("studentPortalEnabled") || !isFeatureEnabled("gradebookEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["SISWA"]);
  const { kelasId } = await params;
  const [kelas, data] = await Promise.all([prisma.kelas.findUnique({ where: { id: kelasId }, select: { id: true, name: true, program: { select: { name: true } }, level: { select: { name: true } } } }), getStudentGradebook(actor, kelasId)]);
  if (!kelas) notFound();
  const row = data.rows[0];
  return <main className="space-y-6"><DashboardHero eyebrow={`${kelas.program.name} / ${kelas.level.name}`} title={`Nilai ${kelas.name}`} description="Nilai yang tampil sudah dipublikasikan Guru. Draft gradebook tidak terlihat di portal Siswa." actions={<Link href={`/siswa/kelas/${kelasId}`} className="tailadmin-button-outline px-4 py-2">Kembali ke Kelas</Link>} />{row ? <GradebookViewer row={row} weightTotal={data.weightTotal} /> : <EmptyState icon="exam" title="Belum ada data nilai" description="Nilai akan muncul setelah Guru mempublikasikan komponen gradebook." />}</main>;
}
