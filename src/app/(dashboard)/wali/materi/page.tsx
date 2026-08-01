import { requireActor, requireRole } from "@/server/auth/session";
import { listWaliMateri } from "@/server/services/wali-materi-service";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";

export const metadata = { title: "Materi Pembelajaran" };

export default async function WaliMateriPage() {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { items } = await listWaliMateri(actor);
  const textCount = items.filter((item) => item.type === "TEXT").length;
  const videoCount = items.filter((item) => item.type === "VIDEO_LINK").length;
  const fileCount = items.reduce((sum, item) => sum + item.files.length, 0);

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Belajar di Rumah"
        title="Materi Pembelajaran"
        description="Baca materi yang sudah dipublikasikan guru untuk anak terpilih. Pilihan anak dapat diubah dari selector di header."
        aside={<div className="grid min-w-72 grid-cols-3 gap-2 rounded-2xl border border-gray-100 bg-white/80 p-3 shadow-theme-xs"><MiniStat label="Materi" value={items.length} /><MiniStat label="Teks" value={textCount} /><MiniStat label="Video/File" value={videoCount + fileCount} /></div>}
      />

      {items.length > 0 ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {items.map((item) => <MaterialCard key={item.id} item={item} />)}
        </section>
      ) : (
        <EmptyState icon="materials" title="Belum ada materi publik" description="Materi akan tampil setelah guru mempublikasikan bahan belajar untuk kelas anak yang terhubung." />
      )}
    </main>
  );
}

type Material = Awaited<ReturnType<typeof listWaliMateri>>["items"][number];

function MaterialCard({ item }: { item: Material }) {
  return (
    <article className="tailadmin-card min-w-0 overflow-hidden p-5" dir={item.direction === "rtl" ? "rtl" : "ltr"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{item.kelas.program.name} / {item.kelas.name}</p>
          <h2 className="mt-1 break-words text-lg font-semibold text-gray-900">{item.title}</h2>
          <p className="mt-1 text-theme-xs text-gray-500">{formatType(item.type)}{item.sesiKelas ? ` / Sesi ${item.sesiKelas.meetingNumber}: ${item.sesiKelas.topic}` : ""}</p>
        </div>
        <span className="shrink-0 rounded-full bg-success-50 px-3 py-1 text-theme-xs font-semibold text-success-700">Published</span>
      </div>

      {item.content ? <p className="mt-5 whitespace-pre-line rounded-2xl bg-gray-50 p-4 text-theme-sm leading-6 text-gray-600">{item.content}</p> : null}

      {item.videoUrl ? <a href={item.videoUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-theme-sm font-semibold text-brand-600 hover:bg-brand-100"><DashboardIcon name="materials" className="size-5" />Buka video pembelajaran</a> : null}

      {item.files.length > 0 ? <div className="mt-5 space-y-2">{item.files.map((file) => <a key={file.id} href={`/api/v1/wali/materi/${item.id}/files/${file.id}`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-3 rounded-xl border border-gray-100 p-3 text-theme-sm font-semibold text-gray-700 hover:border-brand-200 hover:bg-brand-50/40"><DashboardIcon name="materials" className="size-5 shrink-0 text-brand-500" /><span className="min-w-0 truncate">{file.originalName}</span><span className="ml-auto shrink-0 text-theme-xs font-medium text-gray-400">{formatBytes(file.sizeBytes)}</span></a>)}</div> : null}
    </article>
  );
}

function formatType(type: string) {
  return { TEXT: "Materi teks", PDF: "Dokumen PDF", IMAGE: "Gambar", VIDEO_LINK: "Video" }[type] || type;
}

function formatBytes(value: string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 1024) return `${value} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="min-w-0 rounded-2xl bg-gray-50 p-3 text-center"><p className="truncate text-xl font-semibold text-gray-900">{value}</p><p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p></div>;
}
