import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { listBankSoal } from "@/server/services/exam-service";
import { BankSoalActions } from "@/components/dashboard/bank-soal-actions";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { LocalizedContent } from "@/components/localized-content";
import { formatUiLabel } from "@/lib/ui-labels";

export const metadata = { title: "Bank Soal" };

export default async function GuruBankSoalPage({ searchParams }: { searchParams: Promise<{ page?: string; arsip?: string }> }) {
  const actor = await requireActor();
  await requirePermission(actor, "guru.assessment.manage");
  const params = await searchParams;
  const includeArchived = params.arsip === "1";
  const { items: soal, pagination } = await listBankSoal(actor, { page: Number(params.page) || 1, pageSize: 20, includeArchived });

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="tailadmin-page-title">Bank Soal</h1>
          <p className="mt-2 tailadmin-muted">Kelola soal Bahasa Inggris dan Arab untuk gambar, pilihan ganda, benar/salah, mencocokkan, cloze, listening, speaking, writing, reading, dan roleplay.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={includeArchived ? "/guru/bank-soal" : "/guru/bank-soal?arsip=1"} className="tailadmin-button-outline px-4 py-2">{includeArchived ? "Sembunyikan arsip" : "Tampilkan arsip"}</Link>
          <Link href="/guru/bank-soal/baru" target="_blank" rel="noopener noreferrer" className="tailadmin-button-primary px-4 py-2">Buat soal (tab baru)</Link>
        </div>
      </div>
      <section className="space-y-4">
        {soal.length > 0 ? soal.map((item) => (
          <article key={item.id} data-testid="bank-soal-card" className="tailadmin-card p-5">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-limo-blue-50 px-3 py-1 text-theme-xs font-semibold text-limo-blue-700">{formatUiLabel(item.type)}</span>
              <span className="rounded-full bg-success-50 px-3 py-1 text-theme-xs font-semibold text-success-700">{formatUiLabel(item.cognitiveLevel)}</span>
              <span className="rounded-full bg-warning-50 px-3 py-1 text-theme-xs font-semibold text-warning-800">{formatUiLabel(item.skill)}</span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-theme-xs font-semibold text-gray-600">{formatUiLabel(item.difficulty)}</span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-theme-xs font-semibold text-gray-600">{formatUiLabel(item.assessmentType)}</span>
              {item.standard ? <span className="rounded-full bg-limo-blue-50 px-3 py-1 text-theme-xs font-semibold text-limo-blue-700">{item.standard}</span> : null}
            </div>
            <p className="mt-3 text-theme-sm font-semibold text-limo-blue-700">{item.kelas ? `${item.kelas.program.name} / ${item.kelas.name}` : "Umum / lintas kelas"}</p>
            {item.stimulusText ? <LocalizedContent as="p" text={item.stimulusText} language={item.language} direction={item.direction} className="mt-3 rounded-xl bg-gray-50 p-3 text-theme-sm text-gray-700">{item.stimulusText}</LocalizedContent> : null}
            {item.mediaUrl ? <p className="mt-2 text-theme-xs font-semibold text-limo-blue-700">Media: {item.mediaUrl}</p> : null}
            <LocalizedContent as="p" data-testid="bank-soal-question" text={item.question} language={item.language} direction={item.direction} className="mt-2 font-semibold text-gray-900">{item.question}</LocalizedContent>
            {item.expectedAnswer ? <p className="mt-2 text-theme-xs font-semibold text-success-700">Kunci: <LocalizedContent text={item.expectedAnswer} language={item.language} direction="auto">{item.expectedAnswer}</LocalizedContent></p> : null}
            {item.options.length > 0 ? (
              <ul className="mt-3 grid gap-2 text-theme-sm text-gray-700 sm:grid-cols-2">
                {item.options.map((option) => (
                  <li key={option.id} className={option.isCorrect ? "font-semibold text-success-700" : ""}><span>{option.label}. </span><LocalizedContent text={option.content} language={item.language} direction="auto">{option.content}</LocalizedContent></li>
                ))}
              </ul>
            ) : null}
            <Link href={`/guru/bank-soal/${item.id}/pratinjau`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex text-theme-sm font-semibold text-limo-blue-700 underline hover:text-limo-blue-800">Pratinjau (tab baru)</Link>
            <BankSoalActions id={item.id} archived={Boolean(item.archivedAt)} />
          </article>
        )) : <EmptyState icon="exam" title="Bank soal masih kosong" description="Klik “Buat soal (tab baru)” untuk menyusun soal pertama pada kelas yang Anda ampu." />}
      </section>
      <PaginationControls basePath="/guru/bank-soal" page={pagination.page} totalPages={pagination.totalPages} params={{ arsip: includeArchived ? "1" : undefined }} />
    </main>
  );
}
