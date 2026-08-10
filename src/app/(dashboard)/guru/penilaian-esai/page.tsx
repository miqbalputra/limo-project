import Link from "next/link";
import {
  DashboardHero,
  EmptyState,
  MetricCard,
} from "@/components/dashboard/dashboard-widgets";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { LocalizedContent } from "@/components/localized-content";
import { requireActor, requireRole } from "@/server/auth/session";
import { listEssayReviewQueue } from "@/server/services/exam-service";
import { formatUiLabel, getUiToneClass } from "@/lib/ui-labels";

export const metadata = { title: "Penilaian Esai" };

export default async function GuruPenilaianEsaiPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { page } = await searchParams;
  const queue = await listEssayReviewQueue(actor, {
    page: Number(page) || 1,
    pageSize: 30,
  });

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Evaluasi / Penilaian Esai"
        title="Antrean penilaian esai"
        description="Tinjau jawaban manual lintas ujian untuk kelas Anda. Antrean ini hanya memuat hasil berstatus Perlu ditinjau."
        aside={
          <div className="rounded-2xl bg-warning-50 px-5 py-4 text-warning-800 shadow-theme-xs">
            <p className="text-theme-xs font-semibold uppercase tracking-wide">
              Pekerjaan tertunda
            </p>
            <p className="mt-1 text-3xl font-semibold">{queue.pendingCount}</p>
            <p className="mt-1 text-theme-xs">hasil perlu ditinjau</p>
          </div>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2">
        <MetricCard
          label="Perlu ditinjau"
          value={queue.pendingCount}
          description="Status NEEDS_REVIEW pada kelas Anda"
          icon="exam"
          tone={queue.pendingCount > 0 ? "warning" : "success"}
        />
        <article className="tailadmin-card p-5">
          <p className="text-theme-sm font-semibold text-gray-800">
            Filter aktif
          </p>
          <p className="mt-2 inline-flex rounded-full bg-warning-50 px-3 py-1 text-theme-xs font-semibold text-warning-800">
            {formatUiLabel("NEEDS_REVIEW")}
          </p>
          <p className="mt-2 text-theme-xs leading-5 text-gray-500">
            Selesaikan koreksi dari halaman ini agar nilai dapat difinalkan dan
            tampil sesuai kebijakan ujian.
          </p>
        </article>
      </section>
      <section className="tailadmin-card overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="text-theme-xs font-semibold uppercase tracking-[0.16em] text-limo-blue-700">
            Antrean lintas ujian
          </p>
          <h2 className="mt-1 font-semibold text-gray-900">
            Jawaban menunggu penilaian
          </h2>
        </div>
        {queue.items.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {queue.items.map((item) => (
              <article key={item.id} className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-700">
                      {item.ujian.kelas.program.name} / {item.ujian.kelas.name}
                    </p>
                    <h3 className="mt-1 font-semibold text-gray-900">
                      {item.siswa.name}
                    </h3>
                    <p className="mt-1 text-theme-sm text-gray-500">
                      {item.siswa.nomorInduk} / {item.ujian.title}
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-full px-3 py-1 text-theme-xs font-semibold ${getUiToneClass(item.status)}`}
                  >
                    {formatUiLabel(item.status)}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {item.answers.map((answer) => (
                    <div key={answer.id} className="rounded-xl bg-gray-50 p-3">
                      <p className="text-theme-xs font-semibold text-gray-700">
                        {formatUiLabel(answer.bankSoal.type)} /{" "}
                        <LocalizedContent
                          text={answer.bankSoal.question}
                          language={answer.bankSoal.language}
                          direction={answer.bankSoal.direction}
                        >
                          {answer.bankSoal.question}
                        </LocalizedContent>
                      </p>
                      <p className="mt-1 line-clamp-2 text-theme-sm text-gray-600">
                        {answer.essayAnswer || answer.shortAnswer ? (
                          <LocalizedContent
                            text={answer.essayAnswer || answer.shortAnswer}
                            language={answer.bankSoal.language}
                            direction={answer.bankSoal.direction}
                          >
                            {answer.essayAnswer || answer.shortAnswer}
                          </LocalizedContent>
                        ) : (
                          "Jawaban belum dicatat."
                        )}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-theme-xs text-gray-500">
                    Masuk antrean {formatDate(item.updatedAt)}
                  </p>
                  <Link
                    href={`/guru/ujian/${item.ujian.id}/hasil/${item.id}/koreksi`}
                    className="tailadmin-button-primary px-4 py-2"
                  >
                    Nilai jawaban
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="exam"
            title="Tidak ada esai menunggu"
            description="Semua jawaban manual pada kelas Anda sudah ditinjau."
          />
        )}
      </section>
      <PaginationControls
        basePath="/guru/penilaian-esai"
        page={queue.pagination.page}
        totalPages={queue.pagination.totalPages}
      />
    </main>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(value);
}
