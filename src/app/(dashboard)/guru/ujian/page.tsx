import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { listUjian } from "@/server/services/exam-service";
import { ExamDuplicateButton } from "@/components/dashboard/exam-duplicate-button";
import { ExamStatusActions } from "@/components/dashboard/exam-status-actions";
import { ShareExamButton } from "@/components/dashboard/share-exam-button";
import { AssessmentTabs } from "@/components/dashboard/assessment-tabs";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { LocalizedContent } from "@/components/localized-content";
import { formatUiLabel, assessmentClassLabel } from "@/lib/ui-labels";

export const metadata = { title: "Ujian & Kuis" };

export default async function GuruUjianPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string }> }) {
  const actor = await requireActor();
  await requirePermission(actor, "guru.assessment.manage");
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search.trim() : "";
  const { items: ujian, pagination } = await listUjian(actor, { page: Number(params.page) || 1, pageSize: 20, search });

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="tailadmin-page-title">Ujian &amp; Kuis</h1>
          <p className="mt-2 tailadmin-muted">Satu daftar untuk semua asesmen. Semua dibuat dengan builder yang sama, semudah membuat Google Form.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/guru/kuis/baru" className="tailadmin-button-primary px-4 py-2">Buat formulir baru</Link>
          <Link href="/guru/bank-soal" className="tailadmin-button-outline px-4 py-2">Pustaka Soal</Link>
        </div>
      </div>
      <AssessmentTabs />
      <section className="space-y-4">
        <form method="get" className="tailadmin-card grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input name="search" defaultValue={search} placeholder="Cari judul ujian" aria-label="Cari ujian" className="tailadmin-input" />
          <button type="submit" className="tailadmin-button-primary">Terapkan</button>
        </form>
        {ujian.length > 0 ? ujian.map((item) => (
          <article key={item.id} className="tailadmin-card p-5">
            <p className="text-theme-sm font-semibold text-limo-blue-700">{assessmentClassLabel(item.kelas)}</p>
            <h2 className="mt-1 text-lg font-semibold text-gray-900">{item.title}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-theme-sm text-gray-500">
              <span>{formatUiLabel(item.mode)}</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-theme-xs font-semibold ${item.status === "PUBLISHED" ? "bg-success-50 text-success-700" : item.status === "DRAFT" ? "bg-gray-100 text-gray-500" : "bg-warning-50 text-warning-700"}`}>{item.status === "PUBLISHED" ? "Sudah publish" : item.status === "DRAFT" ? "Draft" : "Diarsipkan"}</span>
              <span>{formatUiLabel(item.deliveryMode)}</span>
              <span>{item.durationMinutes} menit</span>
              <span>{item.questions.length} soal</span>
              <span>{item._count.results} hasil</span>
              <span>{item._count.attempts} percobaan online</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/guru/ujian/${item.id}/hasil`} className="tailadmin-button-primary px-4 py-2">Input Hasil</Link>
              <Link href={`/guru/kuis/${item.id}/responses`} className="tailadmin-button-outline px-4 py-2">Respons</Link>
              <Link href={`/guru/kuis/${item.id}/edit`} className="tailadmin-button-outline px-4 py-2">Edit formulir</Link>
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
        )) : <EmptyState icon="exam" title="Belum ada asesmen" description="Klik “Buat formulir baru” untuk menyusun soal pertama dengan builder ala Google Forms." />}
      </section>
      <PaginationControls basePath="/guru/ujian" page={pagination.page} totalPages={pagination.totalPages} params={{ search: search || undefined }} />
    </main>
  );
}
