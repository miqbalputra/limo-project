import { requireActor, requireRole } from "@/server/auth/session";
import { getClassSummary } from "@/server/services/report-service";
import { listMateri, listSesiKelas } from "@/server/services/lms-service";
import { MateriFileUpload, MateriForm, SesiKelasForm } from "@/components/dashboard/lms-forms";
import { GuruRoster } from "@/components/dashboard/guru-roster";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { SessionDuplicateButton } from "@/components/dashboard/session-duplicate-button";

export const metadata = { title: "Kelola Kelas" };

export default async function GuruKelasDetailPage({ params, searchParams }: { params: Promise<{ kelasId: string }>; searchParams: Promise<{ sesiPage?: string; materiPage?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { kelasId } = await params;
  const { sesiPage, materiPage } = await searchParams;
  const [{ items: sesiOptions }, { items: sesi, pagination: sesiPagination }, { items: materi, pagination: materiPagination }, summary] = await Promise.all([
    listSesiKelas(actor, kelasId),
    listSesiKelas(actor, kelasId, { page: Number(sesiPage) || 1, pageSize: 20 }),
    listMateri(actor, kelasId, { page: Number(materiPage) || 1, pageSize: 20 }),
    getClassSummary(actor, kelasId),
  ]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Kelola Kelas</h1>
        <p className="mt-2 tailadmin-muted">Buat sesi kelas dan materi pembelajaran. Data hanya tersedia untuk kelas aktif yang ditugaskan kepada Anda.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SesiKelasForm kelasId={kelasId} />
        <MateriForm kelasId={kelasId} sesiOptions={sesiOptions.map((item) => ({ id: item.id, label: `${item.meetingNumber}. ${item.topic}` }))} />
      </div>
      <GuruRoster kelasId={kelasId} rows={summary.rows} />
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="tailadmin-card p-5">
          <h2 className="font-semibold text-gray-900">Sesi</h2>
          <div className="mt-4 space-y-3">
            {sesi.map((item) => <article key={item.id} className="rounded-xl bg-gray-50 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-gray-900">{item.meetingNumber}. {item.topic}</p><p className="text-theme-sm text-gray-500">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(item.sessionDate)} / {item.status}</p></div><SessionDuplicateButton sesiKelasId={item.id} /></div></article>)}
            <PaginationControls basePath={`/guru/kelas/${kelasId}`} pageParam="sesiPage" page={sesiPagination.page} totalPages={sesiPagination.totalPages} params={{ materiPage }} />
          </div>
        </div>
        <div className="tailadmin-card p-5">
          <h2 className="font-semibold text-gray-900">Materi</h2>
          <div className="mt-4 space-y-3">
            {materi.map((item) => (
              <article key={item.id} className="rounded-xl bg-gray-50 p-3" dir={item.direction === "rtl" ? "rtl" : "ltr"}>
                <p className="font-semibold text-gray-900">{item.title}</p>
                <p className="text-theme-sm text-gray-500">
                  {item.type} / {item.status}{item.sesiKelas ? ` / Pertemuan ${item.sesiKelas.meetingNumber}: ${item.sesiKelas.topic}` : " / Umum"}
                </p>
                {item.videoUrl ? <a href={item.videoUrl} className="mt-2 block text-theme-sm font-semibold text-brand-500 hover:text-brand-600" target="_blank" rel="noreferrer">Buka video</a> : null}
                {item.files.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {item.files.map((file) => (
                      <a key={file.id} href={`/api/v1/files/${file.id}`} className="block text-theme-sm font-semibold text-brand-500 hover:text-brand-600">
                        {file.originalName}
                      </a>
                    ))}
                  </div>
                ) : null}
                <MateriFileUpload materiId={item.id} />
              </article>
            ))}
            <PaginationControls basePath={`/guru/kelas/${kelasId}`} pageParam="materiPage" page={materiPagination.page} totalPages={materiPagination.totalPages} params={{ sesiPage }} />
          </div>
        </div>
      </section>
    </main>
  );
}
