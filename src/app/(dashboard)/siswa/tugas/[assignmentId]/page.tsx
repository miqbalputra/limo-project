import Link from "next/link";
import { notFound } from "next/navigation";
import { AssignmentSubmissionForm, type StudentAssignmentView } from "@/components/dashboard/assignment-submission-form";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { getStudentAssignment } from "@/server/services/assignment-service";

export const metadata = { title: "Kerjakan Tugas" };

export default async function StudentAssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  if (!isFeatureEnabled("studentPortalEnabled") || !isFeatureEnabled("assignmentsEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["SISWA"]);
  const { assignmentId } = await params;
  const { assignment, submission } = await getStudentAssignment(actor, assignmentId);
  return (
    <main className="space-y-6">
      <DashboardHero eyebrow={`${assignment.kelas.program.name} / ${assignment.kelas.level.name}`} title={assignment.title} description="Baca instruksi, simpan draft dengan autosave, dan kirim jawaban saat sudah siap." actions={<Link href={`/siswa/kelas/${assignment.kelasId}/tugas`} className="tailadmin-button-outline px-4 py-2">Kembali ke Tugas</Link>} />
      <article className="tailadmin-card p-5"><p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">Instruksi / {assignment.submissionType}</p><div className="mt-3 whitespace-pre-line text-theme-sm leading-7 text-gray-700">{assignment.instructions}</div><div className="mt-5 flex flex-wrap gap-3 text-theme-xs text-gray-500"><span>Nilai maksimal {assignment.maxScore}</span><span>{assignment.dueAt ? `Tenggat ${formatDate(assignment.dueAt)}` : "Tanpa tenggat"}</span><span>Max {assignment.maxAttempts} attempt</span></div></article>
      <AssignmentSubmissionForm assignment={serializeAssignment(assignment)} initialSubmission={submission} />
    </main>
  );
}

function serializeAssignment(assignment: Awaited<ReturnType<typeof getStudentAssignment>>["assignment"]): StudentAssignmentView {
  return { ...assignment, availableFrom: assignment.availableFrom?.toISOString() || null, dueAt: assignment.dueAt?.toISOString() || null, cutoffAt: assignment.cutoffAt?.toISOString() || null };
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
}
