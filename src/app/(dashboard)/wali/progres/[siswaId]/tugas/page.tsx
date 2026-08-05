import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { listWaliStudentAssignments } from "@/server/services/assignment-service";
import { getStudentSummary } from "@/server/services/report-service";

export const metadata = { title: "Tugas Anak" };

export default async function WaliStudentAssignmentsPage({ params }: { params: Promise<{ siswaId: string }> }) {
  if (!isFeatureEnabled("assignmentsEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { siswaId } = await params;
  const [{ siswa }, { classes }] = await Promise.all([getStudentSummary(actor, siswaId), listWaliStudentAssignments(actor, siswaId)]);

  return (
    <main className="space-y-6">
      <DashboardHero eyebrow={`${siswa.nomorInduk} / ${siswa.program.name}`} title={`Tugas ${siswa.name}`} description="Pantau instruksi, status, jawaban, dan feedback anak secara read-only." actions={<Link href={`/wali/progres/${siswaId}`} className="tailadmin-button-outline px-4 py-2">Kembali ke Progres</Link>} />
      {classes.length > 0 ? classes.map((kelas) => <section key={kelas.id} className="space-y-3"><div><h2 className="text-lg font-semibold text-gray-900">{kelas.name}</h2><p className="text-theme-sm text-gray-500">{kelas.program.name} / {kelas.level.name}</p></div>{kelas.assignments.items.length > 0 ? <div className="space-y-3">{kelas.assignments.items.map((assignment) => <AssignmentReadOnly key={assignment.id} assignment={assignment} />)}</div> : <EmptyState icon="exam" title="Belum ada tugas published" description="Tugas kelas ini akan muncul setelah Guru mempublikasikannya." />}</section>) : <div className="tailadmin-card p-8 text-center text-theme-sm text-gray-500">Anak belum memiliki kelas aktif.</div>}
    </main>
  );
}

function AssignmentReadOnly({ assignment }: { assignment: Awaited<ReturnType<typeof listWaliStudentAssignments>>["classes"][number]["assignments"]["items"][number] }) {
  const submission = assignment.latestSubmission;
  return (
    <article className="tailadmin-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{assignment.submissionType} / Nilai {assignment.maxScore}</p><h3 className="mt-1 text-lg font-semibold text-gray-900">{assignment.title}</h3></div><span className={`rounded-full px-3 py-1 text-theme-xs font-semibold ${statusClass(submission?.status)}`}>{submission?.status || "BELUM DIMULAI"}</span></div>
      <p className="mt-3 whitespace-pre-line text-theme-sm leading-6 text-gray-500">{assignment.instructions}</p>
      {submission ? <details className="mt-4 rounded-xl bg-gray-50 p-4"><summary className="cursor-pointer text-theme-sm font-semibold text-gray-700">Lihat jawaban / detail submission</summary>{submission.onlineText ? <p className="mt-3 whitespace-pre-line text-theme-sm leading-6 text-gray-700">{submission.onlineText}</p> : null}{submission.externalLink ? <a href={submission.externalLink} target="_blank" rel="noreferrer" className="mt-3 block break-all text-theme-sm font-semibold text-brand-600">{submission.externalLink}</a> : null}{submission.files.length > 0 ? <div className="mt-3 space-y-1">{submission.files.map((file) => <a key={file.id} href={`/api/v1/assignment-submissions/files/${file.id}`} className="block text-theme-sm font-semibold text-brand-600">{file.originalName}</a>)}</div> : null}{submission.publishedGrade ? <div className="mt-4 rounded-xl border border-success-100 bg-success-50 p-3"><div className="flex items-center justify-between gap-2"><p className="text-theme-sm font-semibold text-success-800">Feedback Guru</p><p className="text-lg font-bold text-success-800">{submission.publishedGrade.score ?? "-"} / {assignment.maxScore}</p></div>{submission.publishedGrade.feedbackText ? <p className="mt-2 whitespace-pre-line text-theme-sm leading-6 text-success-900">{submission.publishedGrade.feedbackText}</p> : null}</div> : null}<p className="mt-3 text-theme-xs text-gray-500">Attempt {submission.attemptNumber}{submission.submittedAt ? ` / ${formatDate(submission.submittedAt)}` : " / Draft"}{submission.isLate ? " / Terlambat" : ""}</p></details> : <p className="mt-4 text-theme-sm text-gray-500">Belum ada submission.</p>}
    </article>
  );
}

function statusClass(status?: string) {
  return { DRAFT: "bg-gray-100 text-gray-700", SUBMITTED: "bg-brand-50 text-brand-700", LATE: "bg-warning-50 text-warning-700", NEEDS_REVISION: "bg-error-50 text-error-700", GRADED: "bg-success-50 text-success-700" }[status || ""] || "bg-gray-100 text-gray-600";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
}
