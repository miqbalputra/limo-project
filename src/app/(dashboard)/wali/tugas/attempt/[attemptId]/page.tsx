import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActor, requireRole } from "@/server/auth/session";
import { getWaliAttemptContext } from "@/server/services/online-exam-service";
import { OnlineExamPlayer } from "@/components/dashboard/online-exam-player";
import { withWaliChildContext } from "@/lib/wali-selector";
import { readQuizUploadConfig } from "@/lib/quiz-upload";
import { formatUiLabel } from "@/lib/ui-labels";

export const metadata = { title: "Kerjakan Ujian" };

type StructuredPayload = {
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
  kind?: string;
  rows?: string[];
  multiple?: boolean;
  validation?: { type?: string; min?: number | null; max?: number | null; pattern?: string | null; message?: string | null };
} | null;

export default async function WaliAttemptPage({ params, searchParams }: { params: Promise<{ attemptId: string }>; searchParams: Promise<{ anak?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { attemptId } = await params;
  const { anak } = await searchParams;
  const { attempt } = await getWaliAttemptContext(actor, attemptId);

  if (anak !== attempt.siswa.id) {
    redirect(withWaliChildContext(`/wali/tugas/attempt/${attemptId}`, attempt.siswa.id));
  }

  if (attempt.status !== "IN_PROGRESS") {
    return (
      <main className="space-y-6">
        <section className="tailadmin-card p-6 text-center">
          <h1 className="text-xl font-semibold text-gray-900">Ujian sudah dikumpulkan</h1>
          <p className="mt-2 text-theme-sm text-gray-500">Status saat ini: {formatUiLabel(attempt.status)}. Silakan kembali ke daftar tugas anak.</p>
          <Link href={withWaliChildContext("/wali/tugas", attempt.siswa.id)} className="mt-4 tailadmin-button-primary px-4 py-2">Kembali ke Tugas</Link>
        </section>
      </main>
    );
  }

  const sectionIndexById = new Map(attempt.ujian.sections.map((section, index) => [section.id, index]));

  const normalizedAttempt = {
    ...attempt,
    ujian: {
      ...attempt.ujian,
      questions: attempt.ujian.questions.map((question) => {
        const payload = (question.bankSoal.structuredPayload ?? null) as StructuredPayload;
        const upload = readQuizUploadConfig(question.bankSoal.fileUploadConfig);
        return {
          id: question.id,
          weight: question.weight.toString(),
          required: question.required,
          sectionIndex: question.sectionId ? (sectionIndexById.get(question.sectionId) ?? 0) : 0,
          branchRules: Array.isArray(question.branchRules) ? (question.branchRules as Array<{ label: string; goToSectionIndex: number | null }>) : [],
          bankSoal: {
            type: question.bankSoal.type,
            question: question.bankSoal.question,
            helpText: question.bankSoal.helpText,
            stimulusText: question.bankSoal.stimulusText,
            mediaUrl: question.bankSoal.mediaUrl,
            language: question.bankSoal.language,
            direction: question.bankSoal.direction,
            allowOther: question.bankSoal.allowOther,
            options: question.bankSoal.options,
            uploadAllowedTypes: upload.allowedTypes,
            uploadMaxSizeMb: upload.maxSizeMb,
            scale: { min: payload?.min ?? null, max: payload?.max ?? null, minLabel: payload?.minLabel ?? null, maxLabel: payload?.maxLabel ?? null, kind: payload?.kind ?? null },
            grid: { rows: Array.isArray(payload?.rows) ? payload!.rows : [], multiple: Boolean(payload?.multiple) },
            validation: payload?.validation ?? null,
          },
        };
      }),
    },
  };

  return <main className="space-y-6"><OnlineExamPlayer attempt={normalizedAttempt} /></main>;
}
