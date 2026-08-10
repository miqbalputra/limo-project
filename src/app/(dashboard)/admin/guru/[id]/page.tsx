import Link from "next/link";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { PersonProfileForm } from "@/components/dashboard/people-forms";
import { UserActions } from "@/components/dashboard/user-actions";
import { requireActor, requireRole } from "@/server/auth/session";
import { getGuru } from "@/server/services/people-service";
import { formatUiLabel } from "@/lib/ui-labels";

export const metadata = { title: "Profil Guru" };

export default async function AdminGuruDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const { id } = await params;
  const { item } = await getGuru(actor, id);

  return <main className="space-y-6"><Link href="/admin/guru" className="inline-flex text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800">Kembali ke daftar Guru</Link><DashboardHero eyebrow="Operasional / Guru" title={item.user.name} description="Lihat dan perbarui data kontak Guru serta kelas yang ditugaskan. Perubahan profil tersimpan dalam audit." aside={<span className={`inline-flex rounded-full px-3 py-1 text-theme-xs font-semibold ${item.user.status === "ACTIVE" ? "bg-success-50 text-success-700" : "bg-gray-100 text-gray-600"}`}>{formatUiLabel(item.user.status)}</span>} /><section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"><PersonProfileForm type="guru" profile={{ id: item.id, name: item.user.name, email: item.user.email, phone: item.phone, address: item.address }} /><aside className="tailadmin-card p-5"><p className="text-theme-xs font-semibold uppercase tracking-[0.16em] text-limo-blue-700">Akun</p><h2 className="mt-1 font-semibold text-gray-900">Status akses</h2><p className="mt-2 text-theme-sm text-gray-500">Email: {item.user.email}</p><p className="mt-1 text-theme-sm text-gray-500">Terdaftar {formatDate(item.createdAt)}</p><UserActions userId={item.user.id} active={item.user.status === "ACTIVE"} isSelf={item.user.id === actor.id} /></aside></section><section className="tailadmin-card overflow-hidden"><div className="border-b border-gray-100 px-5 py-4"><p className="text-theme-xs font-semibold uppercase tracking-[0.16em] text-limo-blue-700">Penugasan</p><h2 className="mt-1 font-semibold text-gray-900">Kelas yang diampu</h2></div>{item.kelas.length > 0 ? <div className="divide-y divide-gray-100">{item.kelas.map((kelas) => <div key={kelas.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-gray-900">{kelas.name}</p><p className="mt-1 text-theme-sm text-gray-500">{kelas.program.name} / {kelas.level.name} / {kelas._count.enrollments} siswa aktif</p></div><span className="w-fit rounded-full bg-gray-100 px-3 py-1 text-theme-xs font-semibold text-gray-600">{formatUiLabel(kelas.status)}</span></div>)}</div> : <p className="px-5 py-10 text-center text-theme-sm text-gray-500">Guru ini belum ditugaskan ke kelas.</p>}</section></main>;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(value);
}
