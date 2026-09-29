import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { getBankSoal } from "@/server/services/exam-service";
import { BankSoalPreview } from "@/components/dashboard/bank-soal-preview";

export const metadata = { title: "Pratinjau Soal" };

export default async function GuruBankSoalPratinjauDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  await requirePermission(actor, "guru.assessment.manage");
  const { id } = await params;
  const { item } = await getBankSoal(actor, id);

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-theme-sm font-medium text-gray-500">Bank Soal</p>
          <h1 className="mt-1 tailadmin-page-title">Pratinjau soal tersimpan</h1>
          <p className="mt-2 tailadmin-muted">Periksa tampilan siswa, kunci, dan pembahasan sebelum soal dipakai di ujian.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/guru/bank-soal/${item.id}/pratinjau`} className="tailadmin-button-outline px-4 py-2">Muat ulang</Link>
          <Link href="/guru/bank-soal" className="tailadmin-button-outline px-4 py-2">Kembali ke daftar soal</Link>
        </div>
      </div>
      <BankSoalPreview
        data={{
          type: item.type,
          question: item.question,
          stimulusText: item.stimulusText,
          mediaUrl: item.mediaUrl,
          expectedAnswer: item.expectedAnswer,
          structuredPayload: item.structuredPayload,
          rubric: item.rubric,
          explanation: item.explanation,
          language: item.language,
          direction: item.direction,
          cognitiveLevel: item.cognitiveLevel,
          skill: item.skill,
          difficulty: item.difficulty,
          standard: item.standard,
          assessmentType: item.assessmentType,
          options: item.options,
          kelasLabel: item.kelas ? `${item.kelas.program.name} / ${item.kelas.name}` : "Umum / lintas kelas",
        }}
      />
    </main>
  );
}
