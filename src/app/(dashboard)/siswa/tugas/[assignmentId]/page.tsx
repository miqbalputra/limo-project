import Link from "next/link";
import { notFound } from "next/navigation";
import { AssignmentSubmissionForm, type StudentAssignmentView } from "@/components/dashboard/assignment-submission-form";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { getStudentAssignment } from "@/server/services/assignment-service";
import { formatUiLabel } from "@/lib/ui-labels";

export const metadata = { title: "Kerjakan Tugas" };

export default async function StudentAssignmentPage({ params, searchParams }: { params: Promise<{ assignmentId: string }>; searchParams: Promise<{ remedialId?: string; revisionRequestId?: string }> }) {
  if (!isFeatureEnabled("studentPortalEnabled") || !isFeatureEnabled("assignmentsEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["SISWA"]);
  const { assignmentId } = await params;
  const query = await searchParams;
  const { assignment, submission, remedial, revisionRequest } = await getStudentAssignment(actor, assignmentId, { remedialId: query.remedialId, revisionRequestId: query.revisionRequestId });
  return (
    <main className="space-y-6">
      <DashboardHero eyebrow={`${assignment.kelas.program.name} / ${assignment.kelas.level.name}`} title={assignment.title} description="Baca instruksi, simpan draft dengan autosave, dan kirim jawaban saat sudah siap." actions={<Link href={`/siswa/kelas/${assignment.kelasId}/tugas`} className="tailadmin-button-outline px-4 py-2">Kembali ke Tugas</Link>} />
      <article className="tailadmin-card p-5"><p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-700">Instruksi / {formatUiLabel(assignment.submissionType)}</p><div className="mt-3 whitespace-pre-line text-theme-sm leading-7 text-gray-700">{assignment.instructions}</div><div className="mt-5 flex flex-wrap gap-3 text-theme-xs text-gray-500"><span>Nilai maksimal {assignment.maxScore}</span><span>{assignment.dueAt ? `Tenggat ${formatDate(assignment.dueAt)}` : "Tanpa tenggat"}</span><span>Maksimal {assignment.maxAttempts} percobaan</span></div></article>
      {remedial ? <article className="tailadmin-card border-warning-200 bg-warning-50/40 p-5"><p className="text-theme-xs font-semibold uppercase tracking-wide text-warning-800">Remedial / {formatUiLabel(remedial.status)}</p><h2 className="mt-1 text-lg font-semibold text-gray-900">{remedial.title}</h2><p className="mt-2 whitespace-pre-line text-theme-sm text-gray-700">{remedial.instructions}</p><p className="mt-2 text-theme-xs text-warning-800">Alasan: {remedial.reason} / tenggat {formatDate(remedial.dueAt)}</p></article> : null}
      {revisionRequest ? <article className="tailadmin-card border-error-200 bg-error-50/40 p-5"><p className="text-theme-xs font-semibold uppercase tracking-wide text-error-700">Permintaan revisi / {formatUiLabel(revisionRequest.status)}</p><h2 className="mt-1 text-lg font-semibold text-gray-900">Tugas perlu diperbaiki</h2><p className="mt-2 whitespace-pre-line text-theme-sm text-gray-700">{revisionRequest.instructions || revisionRequest.reason}</p>{revisionRequest.dueAt ? <p className="mt-2 text-theme-xs text-error-800">Tenggat revisi {formatDate(revisionRequest.dueAt)}</p> : null}</article> : null}
      <AssignmentSubmissionForm assignment={serializeAssignment(assignment)} initialSubmission={submission} remedialId={remedial?.participantId} revisionRequestId={revisionRequest?.id} />
    </main>
  );
}

function serializeAssignment(assignment: Awaited<ReturnType<typeof getStudentAssignment>>["assignment"]): StudentAssignmentView {
  return { ...assignment, availableFrom: assignment.availableFrom?.toISOString() || null, dueAt: assignment.dueAt?.toISOString() || null, cutoffAt: assignment.cutoffAt?.toISOString() || null };
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
}
