import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { listMyKelas } from "@/server/services/lms-service";
import { getBankSoal } from "@/server/services/exam-service";
import { BankSoalForm } from "@/components/dashboard/bank-soal-form";
import { NotFoundError } from "@/server/errors/application-error";
import type { BankSoalDraft } from "@/lib/bank-soal-draft";

export const metadata = { title: "Ubah Soal" };

export default async function GuruBankSoalEditPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  await requirePermission(actor, "guru.assessment.manage");
  const { id } = await params;

  let item;
  try {
    ({ item } = await getBankSoal(actor, id));
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const { items: kelas } = await listMyKelas(actor);
  const initial: BankSoalDraft = {
    kelasId: item.kelas?.id ?? "",
    type: item.type,
    question: item.question,
    stimulusText: item.stimulusText ?? "",
    mediaUrl: item.mediaUrl ?? "",
    expectedAnswer: item.expectedAnswer ?? "",
    structuredPayload: item.structuredPayload,
    rubric: item.rubric,
    language: item.language ?? "",
    direction: item.direction ?? "",
    cognitiveLevel: item.cognitiveLevel,
    skill: item.skill,
    difficulty: item.difficulty,
    standard: item.standard ?? "",
    assessmentType: item.assessmentType,
    explanation: item.explanation ?? "",
    options: item.options.map((option) => ({ label: option.label, content: option.content, isCorrect: option.isCorrect })),
  };

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-theme-sm font-medium text-gray-500">Bank Soal</p>
          <h1 className="mt-1 tailadmin-page-title">Ubah soal</h1>
          <p className="mt-2 tailadmin-muted">Perbarui soal yang belum dipakai ujian. Soal yang sudah dipakai tidak dapat diubah; duplikat sebagai soal baru.</p>
        </div>
        <Link href="/guru/bank-soal" className="tailadmin-button-outline px-4 py-2">Kembali ke daftar soal</Link>
      </div>
      <BankSoalForm bankSoalId={item.id} initial={initial} kelasOptions={kelas.map((entry) => ({ id: entry.id, name: `${entry.program.name} - ${entry.name}` }))} />
    </main>
  );
}
