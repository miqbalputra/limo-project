import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { listWaliRemedials } from "@/server/services/remedial-service";
import { getStudentSummary } from "@/server/services/report-service";
import { prisma } from "@/server/db/prisma";
import { formatUiLabel, getUiToneClass } from "@/lib/ui-labels";

export const metadata = { title: "Remedial Anak" };

export default async function WaliRemedialPage({ params }: { params: Promise<{ siswaId: string }> }) {
  if (!isFeatureEnabled("remedialEnabled") || !isFeatureEnabled("assignmentsEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { siswaId } = await params;
  const { siswa } = await getStudentSummary(actor, siswaId);
  const classes = await prisma.kelas.findMany({ where: { status: "ACTIVE", enrollments: { some: { siswaId, status: "ACTIVE" } } }, select: { id: true, name: true } });
  const remedials = await Promise.all(classes.map(async (kelas) => ({ kelas, result: await listWaliRemedials(actor, siswaId, kelas.id) })));
  const items = remedials.flatMap((item) => item.result.items.map((remedial) => ({ ...remedial, className: item.kelas.name })));
  return <main className="space-y-6"><DashboardHero eyebrow={`${siswa.nomorInduk} / ${siswa.program.name}`} title={`Remedial ${siswa.name}`} description="Pantau status remedial anak dalam mode hanya-baca. Wali tidak dapat mengerjakan atau mengubah nilai." actions={<Link href={`/wali/progres/${siswaId}`} className="tailadmin-button-outline px-4 py-2">Kembali ke Progres</Link>} />{items.length > 0 ? <div className="space-y-4">{items.map((item) => <article key={item.id} className="tailadmin-card p-5"><span className={`inline-flex rounded-full px-3 py-1 text-theme-xs font-semibold ${getUiToneClass(item.status)}`}>{formatUiLabel(item.status)}</span><p className="mt-2 text-theme-xs font-semibold text-gray-500">{item.className}</p><h2 className="mt-1 text-lg font-semibold text-gray-900">{item.remedial.title}</h2><p className="mt-2 text-theme-sm text-gray-600">{item.remedial.instructions}</p><div className="mt-3 flex flex-wrap gap-3 text-theme-xs text-gray-500"><span>Tenggat {formatDate(item.remedial.dueAt)}</span><span>Nilai awal {formatScore(item.originalScore)}</span><span>Remedial {formatScore(item.remedialScore)}</span><span>Efektif {formatScore(item.effectiveScore)}</span></div></article>)}</div> : <EmptyState icon="exam" title="Belum ada remedial" description="Penugasan remedial anak akan tampil setelah Guru membuatnya." />}</main>;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
}

function formatScore(value: number | null) {
  return value === null ? "-" : value.toFixed(2);
}
