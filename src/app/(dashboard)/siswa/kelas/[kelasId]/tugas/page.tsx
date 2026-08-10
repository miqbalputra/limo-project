import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { getStudentClass } from "@/server/services/student-service";
import { listStudentAssignments } from "@/server/services/assignment-service";
import { formatUiLabel, getUiToneClass } from "@/lib/ui-labels";

export const metadata = { title: "Tugas Saya" };

export default async function StudentAssignmentsPage({ params }: { params: Promise<{ kelasId: string }> }) {
  if (!isFeatureEnabled("studentPortalEnabled") || !isFeatureEnabled("assignmentsEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["SISWA"]);
  const { kelasId } = await params;
  const [{ kelas }, { items }] = await Promise.all([getStudentClass(actor, kelasId), listStudentAssignments(actor, kelasId)]);
  return (
    <main className="space-y-6">
      <DashboardHero eyebrow={`${kelas.program.name} / ${kelas.level.name}`} title={`Tugas ${kelas.name}`} description="Simpan draft kapan saja, lalu kirim jawaban sebelum tenggat. Status terlambat dihitung berdasarkan waktu server." actions={<Link href={`/siswa/kelas/${kelasId}`} className="tailadmin-button-outline px-4 py-2">Kembali ke Kelas</Link>} />
      {items.length > 0 ? <section className="grid gap-4 lg:grid-cols-2">{items.map((item) => <article key={item.id} className="tailadmin-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-700">{formatUiLabel(item.submissionType)} / Nilai {item.maxScore}</p><h2 className="mt-1 break-words text-lg font-semibold text-gray-900">{item.title}</h2></div><span className={`rounded-full px-3 py-1 text-theme-xs font-semibold ${getUiToneClass(item.latestSubmission?.status)}`}>{formatUiLabel(item.latestSubmission?.status, "Belum dimulai")}</span></div><p className="mt-3 line-clamp-3 whitespace-pre-line text-theme-sm leading-6 text-gray-500">{item.instructions}</p><p className="mt-3 text-theme-xs text-gray-500">{item.dueAt ? `Tenggat ${formatDate(item.dueAt)}` : "Tanpa tenggat"} / maksimal {item.maxAttempts} percobaan</p><Link href={`/siswa/tugas/${item.id}`} className="tailadmin-button-primary mt-4 inline-flex px-4 py-2">{item.latestSubmission?.status === "DRAFT" ? "Lanjutkan draf" : "Buka Tugas"}</Link></article>)}</section> : <EmptyState icon="exam" title="Belum ada tugas" description="Guru belum menerbitkan tugas untuk kelas ini." />}
    </main>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(value);
}
