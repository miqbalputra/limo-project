import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { getQuizResponses } from "@/server/services/quiz-builder-service";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { formatUiLabel } from "@/lib/ui-labels";

export const metadata = { title: "Respons Kuis" };

export default async function GuruKuisResponsesPage({ params }: { params: Promise<{ ujianId: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { ujianId } = await params;
  const data = await getQuizResponses(actor, ujianId);

  return (
    <main className="space-y-6">
      <div>
        <Link href="/guru/kuis" className="text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800">Kembali ke Formulir Kuis</Link>
        <h1 className="mt-3 tailadmin-page-title">Respons: {data.quiz.title}</h1>
        <p className="mt-2 tailadmin-muted">Ringkasan jawaban dari tautan publik dan pengerjaan online via wali.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Respons publik" value={String(data.stats.responses)} />
        <Metric label="Pengerjaan wali" value={String(data.stats.attempts)} />
        <Metric label="Rata-rata skor" value={data.stats.averageScore === null ? "-" : String(data.stats.averageScore)} />
        <Metric label="Lulus" value={String(data.stats.passed)} tone="text-success-700" />
        <Metric label="Perlu review" value={String(data.stats.needsReview)} tone="text-warning-700" />
      </section>

      <section className="tailadmin-card overflow-hidden">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Analisis per soal</h2>
          <p className="mt-1 text-theme-xs text-gray-500">Jumlah jawaban benar dari respons publik (soal yang dijawab).</p>
        </div>
        {data.questionStats.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {data.questionStats.map((question, index) => {
              const percent = question.answered > 0 ? Math.round((question.correct / question.answered) * 100) : 0;
              return (
                <div key={question.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-theme-sm font-semibold text-gray-800">Soal {index + 1} · {formatUiLabel(question.type)}</p>
                    <p className="text-theme-xs text-gray-500">{question.correct}/{question.answered} benar ({percent}%)</p>
                  </div>
                  <p className="mt-1 line-clamp-2 text-theme-sm text-gray-600">{question.question}</p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-limo-blue-500" style={{ width: `${percent}%` }} /></div>
                </div>
              );
            })}
          </div>
        ) : <div className="p-5"><EmptyState icon="exam" title="Belum ada soal" description="Tambahkan soal lewat builder terlebih dahulu." /></div>}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="tailadmin-card overflow-hidden">
          <div className="border-b border-gray-200 px-5 py-4"><h2 className="font-semibold text-gray-900">Respons tautan publik</h2></div>
          {data.responses.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {data.responses.map((response) => (
                <div key={response.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div>
                    <p className="text-theme-sm font-semibold text-gray-800">{response.respondentName}</p>
                    <p className="text-theme-xs text-gray-500">{response.submittedAt ? formatDate(response.submittedAt) : "Belum dikirim"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-theme-sm font-bold text-gray-900">{response.score === null ? "-" : response.score}</p>
                    <p className={`text-theme-xs font-semibold ${response.passed === true ? "text-success-700" : response.passed === false ? "text-error-700" : "text-warning-700"}`}>{response.passed === true ? "Lulus" : response.passed === false ? "Belum lulus" : "Menunggu review"}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="px-5 py-6 text-theme-sm text-gray-500">Belum ada respons dari tautan publik.</p>}
        </div>

        <div className="tailadmin-card overflow-hidden">
          <div className="border-b border-gray-200 px-5 py-4"><h2 className="font-semibold text-gray-900">Pengerjaan via wali</h2></div>
          {data.attempts.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {data.attempts.map((attempt) => (
                <div key={attempt.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div>
                    <p className="text-theme-sm font-semibold text-gray-800">{attempt.siswaName}</p>
                    <p className="text-theme-xs text-gray-500">{formatUiLabel(attempt.status)} · {attempt.submittedAt ? formatDate(attempt.submittedAt) : "belum dikumpulkan"}</p>
                  </div>
                  <p className="text-theme-sm font-bold text-gray-900">{attempt.score === null ? "-" : attempt.score}</p>
                </div>
              ))}
            </div>
          ) : <p className="px-5 py-6 text-theme-sm text-gray-500">Belum ada pengerjaan online via wali.</p>}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, tone = "text-gray-900" }: { label: string; value: string; tone?: string }) {
  return (
    <article className="tailadmin-card p-5">
      <p className="text-theme-sm text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</p>
    </article>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
}
