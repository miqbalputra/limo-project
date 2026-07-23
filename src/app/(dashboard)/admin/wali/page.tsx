import { requireActor, requireRole } from "@/server/auth/session";
import { listWali } from "@/server/services/people-service";
import { WaliForm } from "@/components/dashboard/people-forms";

export const metadata = { title: "Wali" };

export default async function AdminWaliPage() {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const { items } = await listWali(actor);

  return (
    <main className="space-y-6">
      <div><h1 className="tailadmin-page-title">Wali</h1><p className="mt-2 tailadmin-muted">Kelola akun wali dan relasi awal ke siswa.</p></div>
      <WaliForm />
      <section className="grid gap-4 md:grid-cols-2">
        {items.map((item) => <article key={item.id} className="tailadmin-card p-5"><h2 className="font-semibold text-gray-900">{item.user.name}</h2><p className="mt-1 text-theme-sm text-gray-500">{item.user.email}</p><p className="mt-1 text-theme-sm text-gray-500">{item._count.siswaRelations} siswa terhubung</p></article>)}
      </section>
    </main>
  );
}
