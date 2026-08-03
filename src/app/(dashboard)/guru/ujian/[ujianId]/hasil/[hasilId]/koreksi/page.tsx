import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { getHasilUjianCorrectionContext } from "@/server/services/exam-service";
import { HasilUjianForm, type InitialExamAnswer } from "@/components/dashboard/hasil-ujian-form";

export const metadata = { title: "Koreksi Hasil Ujian" };

export default async function GuruKoreksiHasilUjianPage({ params }: { params: Promise<{ ujianId: string; hasilId: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { ujianId, hasilId } = await params;
  const hasil = await getHasilUjianCorrectionContext(actor, hasilId);

  if (hasil.ujian.id !== ujianId) {
    return null;
  }

  const initialAnswers = Object.fromEntries(hasil.answers.map((answer) => [
    answer.ujianSoalId,
    {
      selectedOption: answer.selectedOption,
      selectedOptions: Array.isArray(answer.selectedOptions) ? answer.selectedOptions.map(String) : [],
      shortAnswer: answer.shortAnswer,
      essayAnswer: answer.essayAnswer,
      essayScore: answer.score?.toString() || "",
    } satisfies InitialExamAnswer,
  ]));
  const questions = hasil.ujian.questions.map((question) => ({ ...question, weight: question.weight.toString() }));

  return (
    <main className="space-y-6">
      <div>
        <Link href={`/guru/ujian/${ujianId}/hasil`} className="text-theme-sm font-semibold text-brand-500 hover:text-brand-600">Kembali ke hasil ujian</Link>
        <p className="mt-4 text-theme-sm font-semibold text-brand-500">{hasil.ujian.kelas.program.name} / {hasil.ujian.kelas.name}</p>
        <h1 className="mt-1 tailadmin-page-title">Koreksi: {hasil.siswa.name}</h1>
        <p className="mt-2 tailadmin-muted">{hasil.ujian.title}. Nilai sebelumnya {hasil.totalScore?.toString() ?? "-"}; perubahan akan disimpan sebagai `CORRECTED` dan dicatat di audit log.</p>
      </div>
      <HasilUjianForm
        ujianId={hasil.ujian.id}
        students={[hasil.siswa]}
        questions={questions}
        durationMinutes={hasil.ujian.durationMinutes}
        mode="correction"
        submitPath={`/api/v1/hasil-ujian/${hasilId}/correction`}
        initialStudentId={hasil.siswa.id}
        initialAnswers={initialAnswers}
      />
    </main>
  );
}
