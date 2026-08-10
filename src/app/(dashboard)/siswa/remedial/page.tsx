import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { listStudentRemedials } from "@/server/services/remedial-service";
import { formatUiLabel, getUiToneClass } from "@/lib/ui-labels";

export const metadata = { title: "Remedial Saya" };

export default async function StudentRemedialPage() {
  if (!isFeatureEnabled("remedialEnabled") || !isFeatureEnabled("assignmentsEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["SISWA"]);
  const { items } = await listStudentRemedials(actor);
  return <main className="space-y-6"><DashboardHero eyebrow="Perbaikan belajar" title="Remedial Saya" description="Kerjakan remedial yang ditugaskan Guru melalui alur tugas yang sama. Nilai awal tetap tersimpan." actions={<Link href="/siswa/kelas" className="tailadmin-button-outline px-4 py-2">Kembali ke Kelas</Link>} />{items.length > 0 ? <div className="space-y-4">{items.map((item) => <article key={item.id} className="tailadmin-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className={`inline-flex rounded-full px-3 py-1 text-theme-xs font-semibold ${getUiToneClass(item.status)}`}>{formatUiLabel(item.status)}</span><p className="mt-2 text-theme-xs font-semibold text-gray-500">{item.remedial.kelas.name}</p><h2 className="mt-1 text-xl font-semibold text-gray-900">{item.remedial.title}</h2></div><span className="rounded-full bg-warning-50 px-3 py-1 text-theme-xs font-semibold text-warning-700">Tenggat {formatDate(item.remedial.dueAt)}</span></div><p className="mt-3 whitespace-pre-line text-theme-sm leading-6 text-gray-600">{item.remedial.instructions}</p><p className="mt-2 text-theme-xs text-gray-500">Alasan: {item.reason} / Kebijakan nilai: {formatUiLabel(item.remedial.scorePolicy)}</p><Link href={`/siswa/tugas/${item.remedial.sourceId}?remedialId=${item.id}`} className="tailadmin-button-primary mt-4 inline-flex px-4 py-2">Buka Remedial</Link></article>)}</div> : <EmptyState icon="exam" title="Tidak ada remedial aktif" description="Remedial yang ditugaskan Guru akan muncul di halaman ini." />}</main>;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
}
