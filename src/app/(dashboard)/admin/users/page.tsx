import { UserActions } from "@/components/dashboard/user-actions";
import { requireActor, requireRole } from "@/server/auth/session";
import { listUsers } from "@/server/services/auth-service";

export const metadata = { title: "Pengguna" };

export default async function UsersPage() {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const { items } = await listUsers(actor);

  return (
    <main className="space-y-6">
      <div><p className="text-theme-sm font-medium text-gray-500">Administrasi Akun</p><h1 className="mt-1 text-2xl font-semibold text-gray-900">Pengguna</h1><p className="mt-2 tailadmin-muted">Kelola status akun dan cabut session aktif.</p></div>
      <section className="tailadmin-card overflow-hidden">
        <div className="border-b border-gray-200 px-5 py-4"><h2 className="font-semibold text-gray-900">Daftar Pengguna</h2><p className="mt-1 text-theme-xs text-gray-500">{items.length} akun tercatat</p></div>
        <div className="hidden grid-cols-[1.2fr_120px_120px_1fr] gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-theme-xs font-semibold uppercase tracking-wide text-gray-500 md:grid"><span>Pengguna</span><span>Role</span><span>Status</span><span>Aksi</span></div>
        <div className="divide-y divide-gray-100">
        {items.map((item) => (
          <article key={item.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1.2fr_120px_120px_1fr] md:items-center md:gap-4">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-brand-50 text-theme-sm font-bold text-brand-600">{item.name.slice(0, 1)}</span><div><h2 className="text-theme-sm font-semibold text-gray-800">{item.name}</h2><p className="text-theme-xs text-gray-500">{item.email}</p></div></div>
            <span className="w-fit rounded-full bg-brand-50 px-3 py-1 text-theme-xs font-semibold text-brand-600">{item.role}</span>
            <div><span className={`inline-flex rounded-full px-3 py-1 text-theme-xs font-semibold ${item.status === "ACTIVE" ? "bg-success-50 text-success-700" : "bg-error-50 text-error-700"}`}>{item.status}</span><p className="mt-1 text-[10px] text-gray-400">{item._count.sessions} session</p></div>
            <UserActions userId={item.id} active={item.status === "ACTIVE"} isSelf={item.id === actor.id} />
          </article>
        ))}
        </div>
      </section>
    </main>
  );
}
