import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { getQuizForm } from "@/server/services/quiz-builder-service";
import { listMyKelas } from "@/server/services/lms-service";
import { QuizBuilder } from "@/components/dashboard/quiz-builder";
import type { QuizFormState } from "@/lib/quiz-builder";

export const metadata = { title: "Edit Formulir Kuis" };

const BUILDER_TYPES = new Set(["PILIHAN_GANDA", "MULTI_SELECT", "BENAR_SALAH", "ISIAN_SINGKAT", "DROPDOWN", "SKALA", "RATING", "TANGGAL", "WAKTU", "GRID", "ESAI"]);

export default async function GuruKuisEditPage({ params }: { params: Promise<{ ujianId: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { ujianId } = await params;
  const [{ item }, { items: kelas }] = await Promise.all([getQuizForm(actor, ujianId), listMyKelas(actor)]);

  const sectionKeys = item.sections.map((_, index) => `s-${item.id}-${index}`);
  if (sectionKeys.length === 0) sectionKeys.push(`s-${item.id}-0`);

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
    themeColor: item.themeColor ?? "blue",
    headerImageUrl: item.headerImageUrl ?? "",
    confirmationMessage: item.confirmationMessage ?? "",
    availableFrom: item.availableFrom ?? "",
    availableUntil: item.availableUntil ?? "",
    sections: item.sections.length > 0
      ? item.sections.map((section, index) => ({ key: sectionKeys[index], title: section.title, description: section.description ?? "" }))
      : [{ key: sectionKeys[0], title: "Bagian 1", description: "" }],
    questions: item.questions.map((question) => ({
      key: `q-${question.id}`,
      type: BUILDER_TYPES.has(question.type) ? question.type : "ESAI",
      question: question.question,
      helpText: question.helpText ?? "",
      required: question.required,
      points: question.points,
      allowOther: question.allowOther,
      mediaUrl: question.mediaUrl ?? "",
      explanation: question.explanation ?? "",
      expectedAnswer: question.expectedAnswer ?? (question.type === "BENAR_SALAH" ? "benar" : ""),
      scaleMin: question.scaleMin,
      scaleMax: question.scaleMax,
      scaleMinLabel: question.scaleMinLabel,
      scaleMaxLabel: question.scaleMaxLabel,
      gridRows: question.gridRows,
      gridMultiple: question.gridMultiple,
      gridCorrect: question.gridCorrect,
      validationType: question.validationType ?? "NONE",
      validationMin: question.validationMin === null || question.validationMin === undefined ? "" : String(question.validationMin),
      validationMax: question.validationMax === null || question.validationMax === undefined ? "" : String(question.validationMax),
      validationPattern: question.validationPattern ?? "",
      validationMessage: question.validationMessage ?? "",
      sectionKey: sectionKeys[question.sectionIndex] ?? sectionKeys[0],
      branchRules: (Array.isArray(question.branchRules) ? (question.branchRules as Array<{ label: string; goToSectionIndex: number | null }>) : []).map((rule) => ({
        label: rule.label,
        goToSectionKey: rule.goToSectionIndex !== null ? (sectionKeys[rule.goToSectionIndex] ?? null) : null,
      })),
      options: question.type === "PILIHAN_GANDA" || question.type === "MULTI_SELECT" || question.type === "DROPDOWN" || question.type === "SKALA" || question.type === "RATING" || question.type === "GRID"
        ? question.options.map((option) => ({ content: option.content, isCorrect: question.correctLabels.includes(option.label), mediaUrl: option.mediaUrl ?? "" }))
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
