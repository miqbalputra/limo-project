import { requireActor, requireRole } from "@/server/auth/session";
import { listWaliRpp } from "@/server/services/rpp-service";
import { resolveWaliChildId } from "@/server/dal/wali-selector-dal";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { formatUiLabel } from "@/lib/ui-labels";

export const metadata = { title: "RPP Kelas Anak" };

export default async function WaliRppPage({ searchParams }: { searchParams: Promise<{ anak?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { anak } = await searchParams;
  const { items } = await listWaliRpp(actor, await resolveWaliChildId(actor, anak));

  return <main className="space-y-6"><DashboardHero eyebrow="Perencanaan Pembelajaran" title="RPP Kelas Anak" description="Lihat rancangan pembelajaran yang sudah dibagikan Guru untuk kelas anak yang terhubung dengan akun Anda." />{items.length > 0 ? <section className="grid gap-4 xl:grid-cols-2">{items.map((item) => <RppCard key={item.id} item={item} />)}</section> : <EmptyState icon="materials" title="Belum ada RPP yang dibagikan" description="RPP akan tampil setelah Guru mempublikasikan rancangan pembelajaran untuk kelas anak Anda." />}</main>;
}

type RppItem = Awaited<ReturnType<typeof listWaliRpp>>["items"][number];

function RppCard({ item }: { item: RppItem }) {
  return <article className="tailadmin-card p-5"><p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-700">{item.kelas.program.name} / {item.kelas.level.name} / {item.kelas.name}</p><h2 className="mt-1 text-lg font-semibold text-gray-900">{item.title}</h2><p className="mt-1 text-theme-sm text-gray-500">{formatDate(item.planDate)}{item.meetingNumber ? ` / Pertemuan ${item.meetingNumber}` : ""} / {item.topic}</p>{item.mode === "FORM" ? <div className="mt-4 grid gap-3"><RppSection title="Tujuan Pembelajaran" value={item.learningObjectives} /><RppSection title="Materi & Media" value={item.materials} /><RppSection title="Kegiatan Pembelajaran" value={item.activities} /><RppSection title="Asesmen" value={item.assessment} /></div> : <p className="mt-4 rounded-xl bg-gray-50 p-3 text-theme-sm text-gray-600">Isi RPP tersedia dalam dokumen yang dibagikan Guru.</p>}<p className="mt-4 text-theme-xs text-gray-500">Mode: {formatUiLabel(item.mode)} / Tingkat kesulitan: {formatUiLabel(item.difficulty)}{item.durationMinutes ? ` / Durasi ${item.durationMinutes} menit` : ""}</p>{item.files.length > 0 ? <div className="mt-4 space-y-2">{item.files.map((file) => <a key={file.id} href={`/api/v1/files/${file.id}`} target="_blank" rel="noreferrer" className="block rounded-xl border border-gray-200 bg-white p-3 text-theme-sm font-semibold text-limo-blue-700 hover:bg-gray-25 hover:shadow-theme-xs">Unduh {file.originalName}</a>)}</div> : null}{item.notes ? <p className="mt-4 rounded-xl bg-gray-50 p-3 text-theme-sm text-gray-600"><span className="font-semibold">Catatan:</span> {item.notes}</p> : null}</article>;
}

function RppSection({ title, value }: { title: string; value: string }) {
  return <div className="rounded-xl bg-gray-50 p-3"><p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p><p className="mt-2 whitespace-pre-line text-theme-sm leading-6 text-gray-700">{value}</p></div>;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(value);
}
