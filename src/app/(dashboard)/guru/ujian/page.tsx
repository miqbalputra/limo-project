import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { listBankSoal, listUjian } from "@/server/services/exam-service";
import { listMyKelas } from "@/server/services/lms-service";
import { UjianForm } from "@/components/dashboard/ujian-form";
import { ExamDuplicateButton } from "@/components/dashboard/exam-duplicate-button";
import { ExamStatusActions } from "@/components/dashboard/exam-status-actions";
import { ShareExamButton } from "@/components/dashboard/share-exam-button";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { LocalizedContent } from "@/components/localized-content";
import { formatUiLabel } from "@/lib/ui-labels";

export const metadata = { title: "Ujian" };

export default async function GuruUjianPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string }> }) {
  const actor = await requireActor();
  await requirePermission(actor, "guru.assessment.manage");
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search.trim() : "";
  const [{ items: ujian, pagination }, { items: kelas }, { items: soal }] = await Promise.all([
    listUjian(actor, { page: Number(params.page) || 1, pageSize: 20, search }),
    listMyKelas(actor),
    listBankSoal(actor),
  ]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Ujian</h1>
        <p className="mt-2 tailadmin-muted">Susun evaluasi untuk input oleh Guru atau pengerjaan melalui akun Wali.</p>
      </div>
      <UjianForm
        kelasOptions={kelas.map((item) => ({ id: item.id, name: `${item.program.name} - ${item.name}` }))}
        soalOptions={soal.map((item) => ({ id: item.id, label: `${formatUiLabel(item.type)} / ${formatUiLabel(item.skill)} / ${formatUiLabel(item.difficulty)}`, question: item.question, language: item.language, direction: item.direction }))}
      />
      <section className="space-y-4">
        <form method="get" className="tailadmin-card grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input name="search" defaultValue={search} placeholder="Cari judul ujian" aria-label="Cari ujian" className="tailadmin-input" />
          <button type="submit" className="tailadmin-button-primary">Terapkan</button>
        </form>
        {ujian.length > 0 ? ujian.map((item) => (
          <article key={item.id} className="tailadmin-card p-5">
            <p className="text-theme-sm font-semibold text-limo-blue-700">{item.kelas.program.name} / {item.kelas.name}</p>
            <h2 className="mt-1 text-lg font-semibold text-gray-900">{item.title}</h2>
            <p className="mt-1 text-theme-sm text-gray-500">{formatUiLabel(item.mode)} / {formatUiLabel(item.status)} / {formatUiLabel(item.deliveryMode)} / {item.durationMinutes} menit / {item.questions.length} soal / {item._count.results} hasil / {item._count.attempts} percobaan online</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/guru/ujian/${item.id}/hasil`} className="tailadmin-button-primary px-4 py-2">Input Hasil</Link>
               <ExamDuplicateButton ujianId={item.id} />
               <ExamStatusActions ujianId={item.id} status={item.status} />
            </div>
            <div className="mt-3">
              <ShareExamButton ujianId={item.id} hasToken={Boolean(item.shareToken)} />
            </div>
            <ol className="mt-3 list-decimal space-y-1 ps-5 text-theme-sm text-gray-700">
              {item.questions.map((question) => (
                <li key={question.id}>
                  {formatUiLabel(question.bankSoal.type)} - {" "}
                  <LocalizedContent text={question.bankSoal.question} language={question.bankSoal.language} direction={question.bankSoal.direction}>
                    {question.bankSoal.question}
                  </LocalizedContent>
                  {" "}({question.weight.toString()} poin)
                </li>
              ))}
            </ol>
          </article>
        )) : <EmptyState icon="exam" title="Belum ada ujian" description="Pilih kelas dan soal dari bank soal untuk membuat evaluasi pertama." />}
      </section>
      <PaginationControls basePath="/guru/ujian" page={pagination.page} totalPages={pagination.totalPages} params={{ search: search || undefined }} />
    </main>
  );
}
