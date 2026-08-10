import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { SubmissionGradePanel } from "@/components/dashboard/submission-grade-panel";
import { RequestRevisionButton } from "@/components/dashboard/request-revision-button";
import { ResponsiveDataView } from "@/components/dashboard/responsive-data-view";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { getGuruAssignment, listAssignmentSubmissions } from "@/server/services/assignment-service";
import { formatUiLabel, getUiToneClass } from "@/lib/ui-labels";

export const metadata = { title: "Pengumpulan Tugas" };

export default async function GuruAssignmentSubmissionsPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  if (!isFeatureEnabled("assignmentsEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { assignmentId } = await params;
  const [{ item: assignment }, { items }] = await Promise.all([getGuruAssignment(actor, assignmentId), listAssignmentSubmissions(actor, assignmentId)]);
  return (
    <main className="space-y-6">
      <DashboardHero eyebrow="Monitoring Tugas" title={assignment.title} description="Buka jawaban, putar media, isi rubrik, simpan draf, lalu publikasikan umpan balik untuk Siswa dan Wali." actions={<Link href={`/guru/kelas/${assignment.kelasId}/tugas`} className="tailadmin-button-outline px-4 py-2">Kembali ke Tugas</Link>} />
      {items.length > 0 ? (
        <section className="tailadmin-card overflow-hidden">
          <ResponsiveDataView
            rows={items}
            getRowKey={(item) => item.id}
            tableLabel="Pengumpulan tugas siswa"
            desktopBreakpoint="2xl"
            testId="assignment-submissions"
            columns={[
              { id: "student", label: "Siswa", render: (item) => <><p className="font-semibold text-gray-900">{item.student.name}</p><p className="text-theme-xs text-gray-500">{item.student.nomorInduk}</p></> },
              { id: "attempt", label: "Percobaan", render: (item) => <span>{item.attemptNumber}</span> },
              { id: "status", label: "Status", render: (item) => <span className={`inline-flex rounded-full px-2.5 py-1 text-theme-xs font-semibold ${getUiToneClass(item.status)}`}>{formatUiLabel(item.status)}{item.isLate ? ` / ${formatUiLabel("LATE")}` : ""}{item.publishedGrade ? ` / ${item.publishedGrade.score ?? "-"}` : ""}</span> },
              { id: "submitted", label: "Dikirim", render: (item) => <span className="text-theme-xs text-gray-500">{item.submittedAt ? formatDate(item.submittedAt) : "Belum"}</span> },
              { id: "files", label: "Berkas", render: (item) => <span className="text-theme-xs text-gray-500">{item.files.length > 0 ? item.files.map((file) => file.originalName).join(", ") : "-"}</span> },
              { id: "actions", label: "Aksi", render: (item) => <div className="flex flex-wrap items-center gap-2">{assignment.rubricTemplateId ? <SubmissionGradePanel submissionId={item.id} /> : <span className="text-theme-xs text-gray-500">Pasang rubrik dahulu</span>}{isFeatureEnabled("remedialEnabled") && ["GRADED", "SUBMITTED", "LATE"].includes(item.status) && !item.remedialParticipantId && !item.revisionRequestId ? <RequestRevisionButton submissionId={item.id} /> : null}</div> },
            ]}
          />
        </section>
      ) : <EmptyState icon="exam" title="Belum ada pengumpulan tugas" description="Jawaban siswa akan tampil setelah tugas diterbitkan dan dikerjakan." />}
    </main>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
}
