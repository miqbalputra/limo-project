import { requireActor, requireRole } from "@/server/auth/session";
import { listMyKelas } from "@/server/services/lms-service";
import { listGuruRpp } from "@/server/services/rpp-service";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { RppForm } from "@/components/dashboard/rpp-form";
import { RppStatusActions } from "@/components/dashboard/rpp-status-actions";

export const metadata = { title: "RPP" };

export default async function GuruRppPage() {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const [{ items: classes }, { items }] = await Promise.all([listMyKelas(actor), listGuruRpp(actor)]);

  return (
    <main className="space-y-6">
      <DashboardHero eyebrow="Perencanaan Pembelajaran" title="RPP" description="Susun rancangan pembelajaran langsung atau bagikan dokumen RPP Word/PDF kepada Wali murid dari kelas yang Anda ampu." />
      <RppForm classes={classes.map((item) => ({ id: item.id, name: `${item.program.name} / ${item.level.name} / ${item.name}` }))} />
      <section className="space-y-4">
        <div><h2 className="text-lg font-semibold text-gray-900">RPP Saya</h2><p className="mt-1 text-theme-sm text-gray-500">RPP draft belum terlihat oleh Wali. Publish setelah rancangan siap dibagikan.</p></div>
        {items.length > 0 ? items.map((item) => <RppCard key={item.id} item={item} />) : <EmptyState icon="materials" title="Belum ada RPP" description="Buat RPP pertama untuk kelas yang Anda ampu." />}
      </section>
    </main>
  );
}

type RppItem = Awaited<ReturnType<typeof listGuruRpp>>["items"][number];

function RppCard({ item }: { item: RppItem }) {
  return <article className="tailadmin-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{item.kelas.program.name} / {item.kelas.level.name} / {item.kelas.name}</p><h3 className="mt-1 text-lg font-semibold text-gray-900">{item.title}</h3><p className="mt-1 text-theme-sm text-gray-500">{formatDate(item.planDate)}{item.meetingNumber ? ` / Pertemuan ${item.meetingNumber}` : ""} / {item.topic}</p></div><span className={`rounded-full px-3 py-1 text-theme-xs font-semibold ${item.status === "PUBLISHED" ? "bg-success-50 text-success-700" : item.status === "ARCHIVED" ? "bg-gray-100 text-gray-500" : "bg-warning-50 text-warning-700"}`}>{item.status}</span></div>{item.mode === "FORM" ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><RppSection title="Tujuan Pembelajaran" value={item.learningObjectives} /><RppSection title="Materi & Media" value={item.materials} /><RppSection title="Kegiatan" value={item.activities} /><RppSection title="Asesmen" value={item.assessment} /></div> : <p className="mt-4 rounded-xl bg-brand-50 p-3 text-theme-sm text-brand-800">Isi RPP tersedia dalam dokumen upload.</p>}<p className="mt-4 text-theme-xs text-gray-500">Mode {item.mode === "FORM" ? "Isi rancangan langsung" : "Upload berkas"} / Kesulitan {item.difficulty}{item.durationMinutes ? ` / ${item.durationMinutes} menit` : ""}</p>{item.files.length > 0 ? <div className="mt-3 space-y-2">{item.files.map((file) => <a key={file.id} href={`/api/v1/files/${file.id}`} className="block text-theme-sm font-semibold text-brand-600 hover:text-brand-700">{file.originalName}</a>)}</div> : null}<RppStatusActions rppId={item.id} status={item.status} /></article>;
}

function RppSection({ title, value }: { title: string; value: string }) {
  return <div className="rounded-xl bg-gray-50 p-3"><p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p><p className="mt-2 whitespace-pre-line text-theme-sm leading-6 text-gray-700">{value}</p></div>;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(value);
}
