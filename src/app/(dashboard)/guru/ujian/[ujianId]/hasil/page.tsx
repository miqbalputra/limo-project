import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { getUjianInputContext, listHasilUjian } from "@/server/services/exam-service";
import { HasilUjianForm } from "@/components/dashboard/hasil-ujian-form";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { formatUiLabel } from "@/lib/ui-labels";

export const metadata = { title: "Input Hasil Ujian" };

export default async function GuruInputHasilUjianPage({ params, searchParams }: { params: Promise<{ ujianId: string }>; searchParams: Promise<{ page?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { ujianId } = await params;
  const { page } = await searchParams;
  const [{ ujian, students }, { items: hasil, pagination }] = await Promise.all([
    getUjianInputContext(actor, ujianId),
    listHasilUjian(actor, { ujianId, page: Number(page) || 1, pageSize: 20 }),
  ]);
  const questions = ujian.questions.map((question) => ({
    ...question,
    weight: question.weight.toString(),
  }));

  return (
    <main className="space-y-6">
      <div>
        <p className="text-theme-sm font-semibold text-limo-blue-700">{ujian.kelas.program.name} / {ujian.kelas.name}</p>
        <h1 className="mt-1 tailadmin-page-title">{ujian.title}</h1>
        <p className="mt-2 tailadmin-muted">Input jawaban dari ujian luring. Soal objektif dihitung otomatis; berbicara, menulis, bermain peran, dan esai tanpa skor perlu ditinjau.</p>
      </div>
      <HasilUjianForm ujianId={ujian.id} students={students} questions={questions} durationMinutes={ujian.durationMinutes} />
      <section className="tailadmin-card p-5">
        <h2 className="font-semibold text-gray-900">Hasil Tersimpan</h2>
        <div className="mt-4 space-y-3">
          {hasil.length > 0 ? hasil.map((item) => (
            <article key={item.id} className="rounded-xl bg-gray-50 p-3">
              <p className="font-semibold text-gray-900">{item.siswa.name}</p>
              <p className="text-theme-sm text-gray-500">Status {formatUiLabel(item.status)} / Skor {item.totalScore?.toString() ?? "-"}</p>
              {["NEEDS_REVIEW", "FINAL", "CORRECTED"].includes(item.status) ? <Link href={`/guru/ujian/${ujianId}/hasil/${item.id}/koreksi`} className="mt-2 inline-block text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800">{item.status === "NEEDS_REVIEW" ? "Tinjau hasil" : "Buka koreksi"}</Link> : null}
            </article>
          )) : <EmptyState icon="exam" title="Belum ada hasil tersimpan" description="Hasil ujian akan muncul setelah Guru menginput jawaban siswa." />}
        </div>
        <div className="mt-4">
          <PaginationControls basePath={`/guru/ujian/${ujianId}/hasil`} page={pagination.page} totalPages={pagination.totalPages} />
        </div>
      </section>
    </main>
  );
}
