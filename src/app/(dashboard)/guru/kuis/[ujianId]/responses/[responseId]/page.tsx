import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { getQuizResponseDetail } from "@/server/services/quiz-builder-service";
import { formatUiLabel } from "@/lib/ui-labels";

export const metadata = { title: "Detail Respons Kuis" };

export default async function GuruKuisResponseDetailPage({ params }: { params: Promise<{ ujianId: string; responseId: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { ujianId, responseId } = await params;
  const data = await getQuizResponseDetail(actor, ujianId, responseId);

  return (
    <main className="space-y-6">
      <div>
        <Link href={`/guru/kuis/${ujianId}/responses`} className="text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800">Kembali ke Respons</Link>
        <h1 className="mt-3 tailadmin-page-title">Respons: {data.response.respondentName}</h1>
        <p className="mt-2 tailadmin-muted">{data.quiz.title}</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="tailadmin-card p-5">
          <p className="text-theme-sm text-gray-500">Skor</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{data.response.score === null ? "-" : data.response.score}</p>
        </article>
        <article className="tailadmin-card p-5">
          <p className="text-theme-sm text-gray-500">Status</p>
          <p className="mt-2 text-lg font-semibold text-gray-900">{formatUiLabel(data.response.status)}</p>
        </article>
        <article className="tailadmin-card p-5">
          <p className="text-theme-sm text-gray-500">Dikirim</p>
          <p className="mt-2 text-lg font-semibold text-gray-900">{data.response.submittedAt ? formatDate(data.response.submittedAt) : "Belum dikirim"}</p>
        </article>
      </section>

      <section className="tailadmin-card overflow-hidden">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Jawaban per soal</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {data.items.map((item, index) => (
            <div key={item.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-theme-sm font-semibold text-gray-800">Soal {index + 1} · {formatUiLabel(item.type)}</p>
                <span className={`rounded-full px-2 py-0.5 text-theme-xs font-semibold ${item.correct === true ? "bg-success-50 text-success-700" : item.correct === false ? "bg-error-50 text-error-700" : "bg-warning-50 text-warning-700"}`}>
                  {item.correct === true ? "Benar" : item.correct === false ? "Salah" : "Menunggu review"}
                </span>
              </div>
              <p className="mt-1 text-theme-sm text-gray-600" dir="auto">{item.question}</p>
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-50 px-3 py-2 text-theme-sm text-gray-800" dir="auto">
                <span className="font-semibold text-gray-500">Jawaban: </span>{item.answerText}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
}
