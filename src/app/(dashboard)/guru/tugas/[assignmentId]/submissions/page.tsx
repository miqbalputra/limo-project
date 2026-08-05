import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { SubmissionGradePanel } from "@/components/dashboard/submission-grade-panel";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { getGuruAssignment, listAssignmentSubmissions } from "@/server/services/assignment-service";

export const metadata = { title: "Submission Tugas" };

export default async function GuruAssignmentSubmissionsPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  if (!isFeatureEnabled("assignmentsEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { assignmentId } = await params;
  const [{ item: assignment }, { items }] = await Promise.all([getGuruAssignment(actor, assignmentId), listAssignmentSubmissions(actor, assignmentId)]);
  return (
    <main className="space-y-6">
      <DashboardHero eyebrow="Monitoring Tugas" title={assignment.title} description="Buka jawaban, putar media, isi rubric, simpan draft, lalu publikasikan feedback ke Siswa dan Wali." actions={<Link href={`/guru/kelas/${assignment.kelasId}/tugas`} className="tailadmin-button-outline px-4 py-2">Kembali ke Tugas</Link>} />
      {items.length > 0 ? <section className="tailadmin-card overflow-x-auto"><table className="min-w-full text-left text-theme-sm"><thead className="border-b border-gray-100 text-theme-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">Siswa</th><th className="px-5 py-3">Attempt</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Dikirim</th><th className="px-5 py-3">File</th><th className="px-5 py-3">Aksi</th></tr></thead><tbody className="divide-y divide-gray-100">{items.map((item) => <tr key={item.id}><td className="px-5 py-4"><p className="font-semibold text-gray-900">{item.student.name}</p><p className="text-theme-xs text-gray-500">{item.student.nomorInduk}</p></td><td className="px-5 py-4">{item.attemptNumber}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-theme-xs font-semibold ${submissionStatusClass(item.status)}`}>{item.status}{item.isLate ? " / LATE" : ""}{item.publishedGrade ? ` / ${item.publishedGrade.score ?? "-"}` : ""}</span></td><td className="px-5 py-4 text-theme-xs text-gray-500">{item.submittedAt ? formatDate(item.submittedAt) : "Belum"}</td><td className="px-5 py-4 text-theme-xs text-gray-500">{item.files.length > 0 ? item.files.map((file) => file.originalName).join(", ") : "-"}</td><td className="px-5 py-4">{assignment.rubricTemplateId ? <SubmissionGradePanel submissionId={item.id} /> : <span className="text-theme-xs text-gray-500">Pasang rubrik dahulu</span>}</td></tr>)}</tbody></table></section> : <EmptyState icon="exam" title="Belum ada submission" description="Submission Siswa akan tampil setelah tugas dipublikasikan dan dikerjakan." />}
    </main>
  );
}

function submissionStatusClass(status: string) {
  return { DRAFT: "bg-gray-100 text-gray-700", SUBMITTED: "bg-brand-50 text-brand-700", LATE: "bg-warning-50 text-warning-700", NEEDS_REVISION: "bg-error-50 text-error-700", GRADED: "bg-success-50 text-success-700" }[status] || "bg-gray-100 text-gray-700";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
}
