import { UserActions } from "@/components/dashboard/user-actions";
import { requireActor, requireRole } from "@/server/auth/session";
import { listUsers } from "@/server/services/auth-service";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { PaginationControls } from "@/components/dashboard/pagination-controls";

export const metadata = { title: "Pengguna" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const params = await searchParams;
  const filters = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const { items, pagination } = await listUsers(actor, filters);

  return (
    <main className="space-y-6">
      <div><p className="text-theme-sm font-medium text-gray-500">Administrasi Akun</p><h1 className="mt-1 text-2xl font-semibold text-gray-900">Pengguna</h1><p className="mt-2 tailadmin-muted">Kelola status akun dan cabut session aktif.</p></div>
       <form method="get" className="tailadmin-card grid gap-3 p-4 md:grid-cols-[1fr_180px_180px_auto]">
         <input name="search" defaultValue={filters.search || ""} aria-label="Cari pengguna" placeholder="Cari nama atau email" className="tailadmin-input" />
         <select name="role" defaultValue={filters.role || ""} aria-label="Filter role" className="tailadmin-input"><option value="">Semua role</option><option value="ADMIN">Admin</option><option value="GURU">Guru</option><option value="WALI">Wali</option></select>
         <select name="status" defaultValue={filters.status || ""} aria-label="Filter status" className="tailadmin-input"><option value="">Semua status</option><option value="ACTIVE">Aktif</option><option value="INACTIVE">Tidak aktif</option></select>
         <button className="tailadmin-button-primary">Terapkan</button>
       </form>
       <section className="tailadmin-card overflow-hidden">
        <div className="border-b border-gray-200 px-5 py-4"><h2 className="font-semibold text-gray-900">Daftar Pengguna</h2><p className="mt-1 text-theme-xs text-gray-500">{items.length} akun tercatat</p></div>
        <div className="hidden grid-cols-[1.2fr_120px_120px_1fr] gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-theme-xs font-semibold uppercase tracking-wide text-gray-500 md:grid"><span>Pengguna</span><span>Role</span><span>Status</span><span>Aksi</span></div>
         {items.length > 0 ? <div className="divide-y divide-gray-100">
        {items.map((item) => (
          <article key={item.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1.2fr_120px_120px_1fr] md:items-center md:gap-4">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-brand-50 text-theme-sm font-bold text-brand-600">{item.name.slice(0, 1)}</span><div><h2 className="text-theme-sm font-semibold text-gray-800">{item.name}</h2><p className="text-theme-xs text-gray-500">{item.email}</p></div></div>
            <span className="w-fit rounded-full bg-brand-50 px-3 py-1 text-theme-xs font-semibold text-brand-600">{item.role}</span>
            <div><span className={`inline-flex rounded-full px-3 py-1 text-theme-xs font-semibold ${item.status === "ACTIVE" ? "bg-success-50 text-success-700" : "bg-error-50 text-error-700"}`}>{item.status}</span><p className="mt-1 text-[10px] text-gray-400">{item._count.sessions} session</p></div>
            <UserActions userId={item.id} active={item.status === "ACTIVE"} isSelf={item.id === actor.id} />
          </article>
        ))}
         </div> : <EmptyState icon="users" title="Belum ada pengguna" description="Akun Guru dan Wali akan muncul setelah dibuat melalui modul masing-masing." />}
       </section>
       <PaginationControls basePath="/admin/users" page={pagination.page} totalPages={pagination.totalPages} params={filters} />
    </main>
  );
}
