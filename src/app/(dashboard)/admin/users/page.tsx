import Link from "next/link";
import { UserActions } from "@/components/dashboard/user-actions";
import { AdminUserForm } from "@/components/dashboard/user-forms";
import { requireActor, requireRole } from "@/server/auth/session";
import { listUsers } from "@/server/services/auth-service";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { formatUiLabel, getUiToneClass } from "@/lib/ui-labels";

export const metadata = { title: "Pengguna" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const params = await searchParams;
  const filters = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const { items, pagination } = await listUsers(actor, filters);
  const showArchived = filters.includeArchived === "1" || filters.archived === "1" || filters.arsip === "1";

  return (
    <main className="space-y-6">
      <div><p className="text-theme-sm font-medium text-gray-500">Administrasi Akun</p><h1 className="mt-1 text-2xl font-semibold text-gray-900">Pengguna</h1><p className="mt-2 tailadmin-muted">Buat, ubah, dan arsipkan akun, atur role, serta kelola status dan sesi.</p></div>
      <AdminUserForm />
       <form method="get" className="tailadmin-card grid gap-3 p-4 md:grid-cols-[1fr_160px_160px_auto_auto]">
         <input name="search" defaultValue={filters.search || ""} aria-label="Cari pengguna" placeholder="Cari nama atau email" className="tailadmin-input" />
         <select name="role" defaultValue={filters.role || ""} aria-label="Filter role" className="tailadmin-input"><option value="">Semua role</option><option value="ADMIN">Admin</option><option value="GURU">Guru</option><option value="WALI">Wali</option><option value="SISWA">Siswa</option></select>
         <select name="status" defaultValue={filters.status || ""} aria-label="Filter status" className="tailadmin-input"><option value="">Semua status</option><option value="ACTIVE">Aktif</option><option value="INACTIVE">Tidak aktif</option></select>
         <label className="flex items-center gap-2 text-theme-sm text-gray-600"><input type="checkbox" name="includeArchived" value="1" defaultChecked={showArchived} className="size-4 rounded border-gray-300" />Tampilkan arsip</label>
         <button className="tailadmin-button-primary">Terapkan</button>
       </form>
       <section className="tailadmin-card overflow-hidden">
        <div className="border-b border-gray-200 px-5 py-4"><h2 className="font-semibold text-gray-900">Daftar Pengguna</h2><p className="mt-1 text-theme-xs text-gray-500">{items.length} akun tercatat</p></div>
        <div className="hidden grid-cols-[1.2fr_120px_160px_1fr] gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-theme-xs font-semibold uppercase tracking-wide text-gray-500 md:grid"><span>Pengguna</span><span>Role</span><span>Status</span><span>Aksi</span></div>
         {items.length > 0 ? <div className="divide-y divide-gray-100">
        {items.map((item) => (
          <article key={item.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1.2fr_120px_160px_1fr] md:items-center md:gap-4">
             <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-limo-blue-50 text-theme-sm font-bold text-limo-blue-700">{item.name.slice(0, 1)}</span><div><h2 className="text-theme-sm font-semibold text-gray-800">{item.name}</h2><p className="text-theme-xs text-gray-500">{item.email}</p></div></div>
             <span className="w-fit rounded-full bg-limo-blue-50 px-3 py-1 text-theme-xs font-semibold text-limo-blue-700">{formatUiLabel(item.role)}</span>
             <div><span className={`inline-flex rounded-full px-3 py-1 text-theme-xs font-semibold ${getUiToneClass(item.status)}`}>{formatUiLabel(item.status)}</span>{item.deletedAt ? <span className={`ml-2 inline-flex rounded-full px-3 py-1 text-theme-xs font-semibold ${getUiToneClass("ARCHIVED")}`}>Arsip</span> : null}<p className="mt-1 text-[10px] text-gray-400">{item._count.sessions} sesi</p></div>
            <div>
              <Link href={`/admin/users/${item.id}`} className="tailadmin-button-secondary px-3 py-2">Detail &amp; edit</Link>
              {item.deletedAt ? null : <UserActions userId={item.id} active={item.status === "ACTIVE"} isSelf={item.id === actor.id} />}
            </div>
          </article>
        ))}
         </div> : <EmptyState icon="users" title="Belum ada pengguna" description="Buat akun Admin, Guru, atau Wali dari form di atas. Akun Siswa dikelola melalui modul Siswa." />}
       </section>
       <PaginationControls basePath="/admin/users" page={pagination.page} totalPages={pagination.totalPages} params={filters} />
    </main>
  );
}
