import Link from "next/link";
import { notFound } from "next/navigation";
import { GradebookViewer } from "@/components/dashboard/gradebook-viewer";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { getWaliGradebook } from "@/server/services/gradebook-service";
import { getStudentSummary } from "@/server/services/report-service";
import { prisma } from "@/server/db/prisma";

export const metadata = { title: "Gradebook Anak" };

export default async function WaliGradebookPage({ params }: { params: Promise<{ siswaId: string }> }) {
  if (!isFeatureEnabled("gradebookEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { siswaId } = await params;
  const [{ siswa }, enrollment] = await Promise.all([getStudentSummary(actor, siswaId), prisma.kelasSiswa.findFirst({ where: { siswaId, status: "ACTIVE", kelas: { status: "ACTIVE" } }, orderBy: { startDate: "desc" }, select: { kelasId: true, kelas: { select: { id: true, name: true, program: { select: { name: true } }, level: { select: { name: true } } } } } })]);
  if (!enrollment) notFound();
  const data = await getWaliGradebook(actor, siswaId, enrollment.kelasId);
  const row = data.rows[0];
  return <main className="space-y-6"><DashboardHero eyebrow={`${siswa.nomorInduk} / ${enrollment.kelas.program.name}`} title={`Nilai ${siswa.name}`} description="Ringkasan gradebook anak secara read-only. Draft dan perubahan internal Guru tidak ditampilkan." actions={<Link href={`/wali/progres/${siswaId}`} className="tailadmin-button-outline px-4 py-2">Kembali ke Progres</Link>} />{row ? <GradebookViewer row={row} weightTotal={data.weightTotal} showSubmissionLinks={false} /> : <EmptyState icon="exam" title="Belum ada nilai published" description="Nilai akan tampil setelah Guru menerbitkan gradebook kelas." />}</main>;
}
