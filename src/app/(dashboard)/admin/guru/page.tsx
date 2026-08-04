import { requireActor, requireRole } from "@/server/auth/session";
import { listGuru } from "@/server/services/people-service";
import { GuruForm } from "@/components/dashboard/people-forms";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { UserActions } from "@/components/dashboard/user-actions";

export const metadata = { title: "Guru" };

export default async function AdminGuruPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const params = await searchParams;
  const search = Array.isArray(params.search) ? params.search[0] : params.search;
  const page = Number(Array.isArray(params.page) ? params.page[0] : params.page) || 1;
  const { items, pagination } = await listGuru(actor, { search, page, pageSize: 20 });

  return (
    <main className="space-y-6">
      <div><h1 className="tailadmin-page-title">Guru</h1><p className="mt-2 tailadmin-muted">Kelola akun dan profil guru.</p></div>
      <GuruForm />
      <form method="get" className="tailadmin-card flex flex-col gap-3 p-4 sm:flex-row"><input name="search" defaultValue={search || ""} aria-label="Cari Guru" placeholder="Cari nama atau email Guru" className="tailadmin-input" /><button className="tailadmin-button-primary sm:w-auto">Cari</button></form>
      {items.length > 0 ? <section className="grid gap-4 md:grid-cols-2">
        {items.map((item) => <article key={item.id} className="tailadmin-card p-5"><h2 className="font-semibold text-gray-900">{item.user.name}</h2><p className="mt-1 text-theme-sm text-gray-500">{item.user.email}</p><p className="mt-1 text-theme-sm text-gray-500">{item._count.kelas} kelas</p><UserActions userId={item.user.id} active={item.user.status === "ACTIVE"} isSelf={item.user.id === actor.id} /></article>)}
      </section> : <EmptyState icon="teacher" title="Belum ada Guru" description="Tambahkan akun Guru pertama menggunakan formulir di atas." />}
      <PaginationControls basePath="/admin/guru" page={pagination.page} totalPages={pagination.totalPages} params={{ search }} />
    </main>
  );
}
