import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { listUjian } from "@/server/services/exam-service";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { ShareExamButton } from "@/components/dashboard/share-exam-button";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { formatUiLabel } from "@/lib/ui-labels";

export const metadata = { title: "Formulir Kuis" };

export default async function GuruKuisPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string }> }) {
  const actor = await requireActor();
  await requirePermission(actor, "guru.assessment.manage");
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search.trim() : "";
  const { items, pagination } = await listUjian(actor, { page: Number(params.page) || 1, pageSize: 20, search });

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-theme-sm font-medium text-gray-500">Evaluasi</p>
          <h1 className="mt-1 tailadmin-page-title">Formulir Kuis</h1>
          <p className="mt-2 tailadmin-muted">Buat soal seperti Google Forms: tambah kartu soal, atur kunci dan poin, publikasikan, lalu bagikan tautannya.</p>
        </div>
        <Link href="/guru/kuis/baru" className="tailadmin-button-primary px-5 py-3">+ Buat Formulir</Link>
      </div>

      <form method="get" className="tailadmin-card grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input name="search" defaultValue={search} placeholder="Cari judul formulir" aria-label="Cari formulir kuis" className="tailadmin-input" />
        <button type="submit" className="tailadmin-button-primary">Terapkan</button>
      </form>

      <section className="space-y-4">
        {items.length > 0 ? items.map((item) => (
          <article key={item.id} className="tailadmin-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.status === "PUBLISHED" ? "bg-success-50 text-success-700" : "bg-gray-100 text-gray-600"}`}>{item.status === "PUBLISHED" ? "Terbit" : item.status === "ARCHIVED" ? "Arsip" : "Draf"}</span>
                  <span className="rounded-full bg-limo-blue-50 px-2.5 py-1 text-[10px] font-bold text-limo-blue-700">{formatUiLabel(item.mode)}</span>
                  <span className="text-theme-xs text-gray-500">{item.kelas.program.name} / {item.kelas.name}</span>
                </div>
                <h2 className="mt-2 text-lg font-semibold text-gray-900">{item.title}</h2>
                <p className="mt-1 text-theme-sm text-gray-500">{item.questions.length} soal / {item.durationMinutes} menit / maks {item.maxAttempts}x / {item._count.results} hasil / {item._count.attempts} percobaan online</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/guru/kuis/${item.id}/edit`} className="tailadmin-button-outline px-4 py-2">Edit formulir</Link>
                <Link href={`/guru/kuis/${item.id}/responses`} className="tailadmin-button-outline px-4 py-2">Respons</Link>
                <Link href={`/guru/ujian/${item.id}/hasil`} className="tailadmin-button-outline px-4 py-2">Input hasil</Link>
              </div>
            </div>
            <div className="mt-3">
              <ShareExamButton ujianId={item.id} hasToken={Boolean(item.shareToken)} />
            </div>
          </article>
        )) : <EmptyState icon="exam" title="Belum ada formulir kuis" description="Klik Buat Formulir untuk menyusun soal pertama seperti di Google Forms." />}
      </section>

      <PaginationControls basePath="/guru/kuis" page={pagination.page} totalPages={pagination.totalPages} params={{ search: search || undefined }} />
    </main>
  );
}
