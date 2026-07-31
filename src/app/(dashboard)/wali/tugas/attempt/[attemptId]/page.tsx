import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { getWaliAttemptContext } from "@/server/services/online-exam-service";
import { OnlineExamPlayer } from "@/components/dashboard/online-exam-player";

export const metadata = { title: "Kerjakan Ujian" };

export default async function WaliAttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { attemptId } = await params;
  const { attempt } = await getWaliAttemptContext(actor, attemptId);

  if (attempt.status !== "IN_PROGRESS") {
    return (
      <main className="space-y-6">
        <section className="tailadmin-card p-6 text-center">
          <h1 className="text-xl font-semibold text-gray-900">Ujian sudah dikumpulkan</h1>
          <p className="mt-2 text-theme-sm text-gray-500">Status saat ini: {attempt.status}. Silakan kembali ke daftar tugas anak.</p>
          <Link href={`/wali/tugas/${attempt.siswa.id}`} className="mt-4 tailadmin-button-primary px-4 py-2">Kembali ke Tugas</Link>
        </section>
      </main>
    );
  }

  const normalizedAttempt = {
    ...attempt,
    ujian: {
      ...attempt.ujian,
      questions: attempt.ujian.questions.map((question) => ({ ...question, weight: question.weight.toString() })),
    },
  };

  return <main className="space-y-6"><OnlineExamPlayer attempt={normalizedAttempt} /></main>;
}
