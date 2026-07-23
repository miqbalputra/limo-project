import { requireActor, requireRole } from "@/server/auth/session";
import { listGuru } from "@/server/services/people-service";
import { GuruForm } from "@/components/dashboard/people-forms";

export const metadata = { title: "Guru" };

export default async function AdminGuruPage() {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const { items } = await listGuru(actor);

  return (
    <main className="space-y-6">
      <div><h1 className="tailadmin-page-title">Guru</h1><p className="mt-2 tailadmin-muted">Kelola akun dan profil guru.</p></div>
      <GuruForm />
      <section className="grid gap-4 md:grid-cols-2">
        {items.map((item) => <article key={item.id} className="tailadmin-card p-5"><h2 className="font-semibold text-gray-900">{item.user.name}</h2><p className="mt-1 text-theme-sm text-gray-500">{item.user.email}</p><p className="mt-1 text-theme-sm text-gray-500">{item._count.kelas} kelas</p></article>)}
      </section>
    </main>
  );
}
