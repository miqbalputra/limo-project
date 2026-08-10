import { LocalizedContent } from "@/components/localized-content";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { MateriFileUpload, MateriForm } from "@/components/dashboard/lms-forms";
import { MaterialStatusActions } from "@/components/dashboard/material-status-actions";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { formatUiLabel } from "@/lib/ui-labels";
import { requireActor, requireRole } from "@/server/auth/session";
import { listMateri, listMyKelas, listSesiKelas } from "@/server/services/lms-service";

export const metadata = { title: "Materi Pembelajaran" };

export default async function GuruMateriPage({ searchParams }: { searchParams: Promise<{ kelasId?: string; page?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const params = await searchParams;
  const { items: kelas } = await listMyKelas(actor);
  const selectedKelas = kelas.find((item) => item.id === params.kelasId) || kelas[0];
  const materiData = selectedKelas ? await listMateri(actor, selectedKelas.id, { page: Number(params.page) || 1, pageSize: 20 }) : null;
  const sesiData = selectedKelas ? await listSesiKelas(actor, selectedKelas.id) : null;

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Materi Pembelajaran</h1>
        <p className="mt-2 tailadmin-muted">Kelola materi PDF, gambar, teks, dan video tanpa bercampur dengan roster atau lifecycle sesi.</p>
      </div>
      <form method="get" className="tailadmin-card grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="grid gap-1"><span className="text-theme-xs font-medium text-gray-600">Kelas</span><select name="kelasId" defaultValue={selectedKelas?.id || ""} aria-label="Pilih kelas materi" className="tailadmin-input py-2.5"><option value="">Pilih kelas</option>{kelas.map((item) => <option key={item.id} value={item.id}>{item.program.name} / {item.level.name} / {item.name}</option>)}</select></label>
        <button type="submit" className="tailadmin-button-primary self-end px-4 py-2.5">Tampilkan materi</button>
      </form>

      {selectedKelas && materiData && sesiData ? <>
        <section className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <MateriForm kelasId={selectedKelas.id} sesiOptions={sesiData.items.map((item) => ({ id: item.id, label: `Pertemuan ${item.meetingNumber}: ${item.topic}` }))} />
          <section className="tailadmin-card overflow-hidden">
            <div className="border-b border-gray-100 px-5 py-4"><p className="text-theme-xs font-semibold uppercase tracking-[0.16em] text-limo-blue-700">{selectedKelas.program.name} / {selectedKelas.level.name}</p><h2 className="mt-1 font-semibold text-gray-900">Materi {selectedKelas.name}</h2><p className="mt-1 text-theme-xs text-gray-500">{materiData.pagination.totalItems} materi pada kelas terpilih.</p></div>
            {materiData.items.length > 0 ? <div className="divide-y divide-gray-100">{materiData.items.map((item) => <MaterialRow key={item.id} item={item} />)}</div> : <div className="p-5"><EmptyState icon="materials" title="Belum ada materi pada kelas ini" description="Gunakan formulir di samping untuk membuat materi pertama bagi kelas yang dipilih." /></div>}
          </section>
        </section>
        <PaginationControls basePath="/guru/materi" page={materiData.pagination.page} totalPages={materiData.pagination.totalPages} params={{ kelasId: selectedKelas.id }} />
      </> : <section className="tailadmin-card px-6 py-12 text-center"><h2 className="font-semibold text-gray-900">Belum ada kelas aktif</h2><p className="mt-2 text-theme-sm text-gray-500">Materi dapat dikelola setelah Admin menugaskan Anda ke kelas aktif.</p></section>}
    </main>
  );
}

type Material = Awaited<ReturnType<typeof listMateri>>["items"][number];

function MaterialRow({ item }: { item: Material }) {
  return <article className="p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <LocalizedContent as="p" text={item.title} language={item.language} direction="auto" className="font-semibold text-gray-900">{item.title}</LocalizedContent>
        <p className="mt-1 text-theme-sm text-gray-500">{formatUiLabel(item.type)} / {formatUiLabel(item.status)}{item.sesiKelas ? ` / Pertemuan ${item.sesiKelas.meetingNumber}: ${item.sesiKelas.topic}` : " / Materi umum"}</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-theme-xs font-semibold ${item.status === "PUBLISHED" ? "bg-success-50 text-success-700" : item.status === "ARCHIVED" ? "bg-gray-100 text-gray-600" : "bg-warning-50 text-warning-700"}`}>{formatUiLabel(item.status)}</span>
    </div>
    {item.content ? <LocalizedContent as="p" text={item.content} language={item.language} direction={item.direction} className="mt-3 whitespace-pre-line rounded-xl bg-gray-50 p-3 text-theme-sm leading-7 text-gray-700">{item.content}</LocalizedContent> : null}
    {item.videoUrl ? <a href={item.videoUrl} className="mt-3 block break-all text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800" target="_blank" rel="noreferrer">Buka video</a> : null}
    {item.files.length > 0 ? <div className="mt-3 space-y-1">{item.files.map((file) => <a key={file.id} href={`/api/v1/files/${file.id}`} className="block text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800"><LocalizedContent text={file.originalName} language={item.language} direction="auto">{file.originalName}</LocalizedContent></a>)}</div> : null}
    <MateriFileUpload materiId={item.id} />
    <MaterialStatusActions materiId={item.id} status={item.status} />
  </article>;
}
