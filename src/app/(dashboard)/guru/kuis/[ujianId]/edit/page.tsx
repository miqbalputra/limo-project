import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { getQuizForm } from "@/server/services/quiz-builder-service";
import { listMyKelas } from "@/server/services/lms-service";
import { QuizBuilder } from "@/components/dashboard/quiz-builder";
import type { QuizFormState } from "@/lib/quiz-builder";

export const metadata = { title: "Edit Formulir Kuis" };

const BUILDER_TYPES = new Set(["PILIHAN_GANDA", "MULTI_SELECT", "BENAR_SALAH", "ISIAN_SINGKAT", "ESAI"]);

export default async function GuruKuisEditPage({ params }: { params: Promise<{ ujianId: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { ujianId } = await params;
  const [{ item }, { items: kelas }] = await Promise.all([getQuizForm(actor, ujianId), listMyKelas(actor)]);

  const initial: QuizFormState = {
    kelasId: item.kelasId,
    title: item.title,
    description: item.description ?? "",
    mode: item.mode,
    deliveryMode: item.deliveryMode,
    durationMinutes: item.durationMinutes,
    maxAttempts: item.maxAttempts,
    shuffleQuestions: item.shuffleQuestions,
    shuffleOptions: item.shuffleOptions,
    passingScore: item.passingScore === null ? "" : String(item.passingScore),
    showScoreImmediately: item.showScoreImmediately,
    showAnswersAfterSubmit: item.showAnswersAfterSubmit,
    collectRespondentName: item.collectRespondentName,
    showResultToWali: item.showResultToWali,
    availableFrom: item.availableFrom ?? "",
    availableUntil: item.availableUntil ?? "",
    questions: item.questions.map((question) => ({
      key: `q-${question.id}`,
      type: BUILDER_TYPES.has(question.type) ? question.type : "ESAI",
      question: question.question,
      required: question.required,
      points: question.points,
      allowOther: question.allowOther,
      mediaUrl: question.mediaUrl ?? "",
      explanation: question.explanation ?? "",
      expectedAnswer: question.expectedAnswer ?? (question.type === "BENAR_SALAH" ? "benar" : ""),
      options: question.type === "PILIHAN_GANDA" || question.type === "MULTI_SELECT"
        ? question.options.map((option) => ({ content: option.content, isCorrect: question.correctLabels.includes(option.label) }))
        : [],
    })),
  };

  return (
    <main className="space-y-6">
      <div>
        <Link href="/guru/kuis" className="text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800">Kembali ke Formulir Kuis</Link>
        <h1 className="mt-3 tailadmin-page-title">Edit Formulir</h1>
        <p className="mt-2 tailadmin-muted">Perubahan tersimpan otomatis selama status masih draf. Kuis yang sudah dikerjakan tidak dapat diubah (duplikat dulu).</p>
      </div>
      <QuizBuilder
        ujianId={item.id}
        status={item.status}
        shareToken={item.shareToken}
        initial={initial}
        kelasOptions={kelas.map((entry) => ({ id: entry.id, name: `${entry.program.name} - ${entry.name}` }))}
      />
    </main>
  );
}
