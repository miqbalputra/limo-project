import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { listKelas, listPrograms } from "@/server/services/master-data-service";
import { listSiswa, listWaliOptions } from "@/server/services/people-service";
import { SiswaForm } from "@/components/dashboard/people-forms";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";

export const metadata = { title: "Siswa" };

export default async function AdminSiswaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const params = await searchParams;
  const filters = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const [{ items: siswa, pagination }, { items: programs }, { items: kelas }, { items: walis }] = await Promise.all([listSiswa(actor, filters), listPrograms(actor), listKelas(actor), listWaliOptions(actor)]);
  const pageHref = (page: number) => {
    const query = new URLSearchParams(filters);
    query.set("page", String(page));
    return `?${query.toString()}`;
  };

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-theme-sm font-medium text-gray-500">Data Peserta Didik</p><h1 className="mt-1 text-2xl font-semibold text-gray-900">Siswa</h1><p className="mt-2 tailadmin-muted">Kelola profil, wali, dan histori enrollment kelas.</p></div><Link href="/api/v1/admin/siswa/export" className="tailadmin-button-outline">Export CSV</Link></div>
      <form method="get" className="tailadmin-card grid gap-3 p-4 md:grid-cols-[1fr_220px_180px_auto]">
        <input name="search" defaultValue={typeof params.search === "string" ? params.search : ""} placeholder="Cari nama atau nomor induk" className="tailadmin-input" />
        <select name="programId" defaultValue={typeof params.programId === "string" ? params.programId : ""} className="tailadmin-input"><option value="">Semua program</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select>
        <select name="status" defaultValue={typeof params.status === "string" ? params.status : ""} className="tailadmin-input"><option value="">Semua status aktif</option><option value="ACTIVE">Aktif</option><option value="INACTIVE">Tidak aktif</option><option value="GRADUATED">Lulus</option><option value="ARCHIVED">Arsip</option></select>
        <button className="tailadmin-button-primary">Terapkan</button>
      </form>
      <SiswaForm programs={programs.map((program) => ({ id: program.id, name: program.name }))} kelas={kelas.map((item) => ({ id: item.id, name: `${item.program.name} - ${item.name}`, programId: item.program.id }))} walis={walis} />
      <section className="tailadmin-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4"><div><h2 className="font-semibold text-gray-900">Daftar Siswa</h2><p className="mt-1 text-theme-xs text-gray-500">{pagination.total} siswa ditemukan</p></div></div>
        <div className="hidden grid-cols-[1.1fr_0.8fr_1fr_1fr_100px] gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-theme-xs font-semibold uppercase tracking-wide text-gray-500 lg:grid"><span>Siswa</span><span>Program</span><span>Wali</span><span>Kelas</span><span>Aksi</span></div>
         {siswa.length > 0 ? <div className="divide-y divide-gray-100">
          {siswa.map((item) => (
            <article key={item.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[1.1fr_0.8fr_1fr_1fr_100px] lg:items-center lg:gap-4">
              <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-theme-sm font-bold text-brand-600">{item.name.slice(0, 1)}</span><div><h3 className="text-theme-sm font-semibold text-gray-800">{item.name}</h3><p className="text-theme-xs text-gray-500">{item.nomorInduk}</p></div></div>
              <div><span className="rounded-full bg-gray-100 px-2.5 py-1 text-theme-xs font-medium text-gray-600">{item.program.name}</span><p className="mt-2 text-[10px] font-semibold text-success-700">{item.status}</p></div>
              <p className="text-theme-sm text-gray-600">{item.waliRelations.map((relation) => relation.waliProfile.user.name).join(", ") || "Belum ada"}</p>
              <p className="text-theme-sm text-gray-600">{item.enrollments.map((enrollment) => enrollment.kelas.name).join(", ") || "Belum ada"}</p>
              <Link href={`/admin/siswa/${item.id}`} className="text-theme-sm font-semibold text-brand-500 hover:text-brand-600">Kelola</Link>
            </article>
          ))}
         </div> : <EmptyState icon="student" title="Siswa tidak ditemukan" description="Belum ada siswa yang cocok dengan filter saat ini. Coba ubah pencarian atau status." />}
      </section>
      <div className="flex items-center justify-between text-theme-sm text-gray-500"><span>Halaman {pagination.page} dari {Math.max(pagination.totalPages, 1)}</span><div className="flex gap-2">{pagination.page > 1 ? <Link href={pageHref(pagination.page - 1)} className="tailadmin-button-outline px-3 py-2">Sebelumnya</Link> : null}{pagination.page < pagination.totalPages ? <Link href={pageHref(pagination.page + 1)} className="tailadmin-button-outline px-3 py-2">Berikutnya</Link> : null}</div></div>
    </main>
  );
}
