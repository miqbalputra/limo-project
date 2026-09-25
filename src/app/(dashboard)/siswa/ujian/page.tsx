import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { listStudentExams } from "@/server/services/online-exam-service";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { formatUiLabel, getUiToneClass } from "@/lib/ui-labels";

export const metadata = { title: "Ujian Saya" };

export default async function StudentExamsPage() {
  if (!isFeatureEnabled("studentSelfExamEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["SISWA"]);
  const { siswa, exams } = await listStudentExams(actor);

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow={`${siswa.nomorInduk} / ${siswa.program.name}`}
        title="Ujian Saya"
        description="Kerjakan ujian daring dari kelas yang Anda ikuti. Baca instruksi dan pastikan jawaban sudah benar sebelum dikumpulkan."
      />

      {exams.length > 0 ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {exams.map((exam) => {
            const canResume = exam.latestAttempt?.status === "IN_PROGRESS" && (!exam.latestAttempt.expiresAt || exam.latestAttempt.expiresAt > new Date());
            const finished = ["FINAL", "NEEDS_REVIEW", "SUBMITTED"].includes(exam.status);
            const actionHref = canResume ? `/siswa/ujian/attempt/${exam.latestAttempt.id}` : `/siswa/ujian/${exam.id}`;

            return (
              <article key={exam.id} className="tailadmin-card min-w-0 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-700">{exam.kelas.program.name} / {exam.kelas.name}</p>
                    <h2 className="mt-1 truncate text-lg font-semibold text-gray-900" title={exam.title}>{exam.title}</h2>
                    <p className="mt-2 text-theme-sm text-gray-500">{exam._count.questions} soal / {exam.durationMinutes} menit{exam.availableUntil ? ` / sampai ${exam.availableUntil.toISOString().slice(0, 10)}` : ""}</p>
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1 text-theme-xs font-semibold ${getUiToneClass(exam.status)}`}>{formatUiLabel(exam.status, "Belum dimulai")}</span>
                </div>
                <p className="mt-4 line-clamp-2 rounded-2xl bg-gray-50 p-3 text-theme-sm leading-6 text-gray-500">{exam.description || "Tidak ada deskripsi tambahan."}</p>
                {exam.result && (exam.result.status === "FINAL" || exam.result.status === "CORRECTED") ? (
                  <p className="mt-3 text-theme-sm text-gray-700">Nilai: <span className="font-semibold text-success-700">{exam.result.totalScore == null ? "-" : Number(exam.result.totalScore).toFixed(0)}</span></p>
                ) : exam.status === "SUBMITTED" ? (
                  <p className="mt-3 text-theme-sm text-gray-500">Jawaban sudah dikirim. Nilai belum dirilis oleh Guru.</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {canResume || !finished
                    ? <Link href={actionHref} className="tailadmin-button-primary px-4 py-2">{canResume ? "Lanjutkan" : "Buka instruksi"}</Link>
                    : <span className="rounded-xl bg-gray-50 px-4 py-2 text-theme-sm font-semibold text-gray-500">Sudah dikerjakan</span>}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState icon="exam" title="Belum ada ujian daring" description="Ujian akan tampil setelah Guru menerbitkan ujian dalam mode daring melalui akun Siswa." />
      )}
    </main>
  );
}
