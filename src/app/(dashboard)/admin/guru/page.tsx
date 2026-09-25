import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { listGuru } from "@/server/services/people-service";
import { GuruForm } from "@/components/dashboard/people-forms";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { PersonAccountActions } from "@/components/dashboard/person-account-actions";

export const metadata = { title: "Guru" };

export default async function AdminGuruPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const params = await searchParams;
  const search = Array.isArray(params.search) ? params.search[0] : params.search;
  const page = Number(Array.isArray(params.page) ? params.page[0] : params.page) || 1;
  const includeArchived = (Array.isArray(params.arsip) ? params.arsip[0] : params.arsip) === "1";
  const { items, pagination } = await listGuru(actor, { search, page, pageSize: 20, includeArchived });

  const toggleArchivedHref = includeArchived
    ? `/admin/guru${search ? `?search=${encodeURIComponent(search)}` : ""}`
    : `/admin/guru?${new URLSearchParams({ ...(search ? { search } : {}), arsip: "1" }).toString()}`;

  return (
    <main className="space-y-6">
      <div><h1 className="tailadmin-page-title">Guru</h1><p className="mt-2 tailadmin-muted">Kelola akun dan profil guru, termasuk arsip dan impor massal.</p></div>
      <div className="flex flex-wrap justify-end gap-2"><Link href="/admin/guru/impor" className="tailadmin-button-outline px-3 py-2">Impor CSV</Link></div>
      <GuruForm />
      <div className="flex flex-wrap items-center gap-2">
        <form method="get" className="tailadmin-card flex flex-1 flex-col gap-3 p-4 sm:flex-row">
          {includeArchived ? <input type="hidden" name="arsip" value="1" /> : null}
          <input name="search" defaultValue={search || ""} aria-label="Cari Guru" placeholder="Cari nama atau email Guru" className="tailadmin-input" />
          <button className="tailadmin-button-primary sm:w-auto">Cari</button>
        </form>
        <Link href={toggleArchivedHref} className="tailadmin-button-outline px-3 py-2">{includeArchived ? "Sembunyikan arsip" : "Tampilkan arsip"}</Link>
      </div>
      {items.length > 0 ? <section className="grid gap-4 md:grid-cols-2">
        {items.map((item) => <article key={item.id} className="tailadmin-card p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-gray-900">{item.user.name}</h2>
              <p className="mt-1 text-theme-sm text-gray-500">{item.user.email}</p>
              <p className="mt-1 text-theme-sm text-gray-500">{item._count.kelas} kelas</p>
            </div>
            {item.user.deletedAt ? <span className="w-fit rounded-full bg-gray-100 px-2.5 py-1 text-theme-xs font-semibold text-gray-600">Arsip</span> : null}
          </div>
          <Link href={`/admin/guru/${item.id}`} className="mt-3 inline-flex text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800">Lihat profil</Link>
          <PersonAccountActions kind="guru" profileId={item.id} userId={item.user.id} active={item.user.status === "ACTIVE"} archived={Boolean(item.user.deletedAt)} lastLoginAt={item.user.lastLoginAt ? item.user.lastLoginAt.toISOString() : null} isSelf={item.user.id === actor.id} />
        </article>)}
      </section> : <EmptyState icon="teacher" title={includeArchived ? "Tidak ada Guru pada filter ini" : "Belum ada Guru"} description="Tambahkan akun Guru pertama menggunakan formulir di atas." />}
      <PaginationControls basePath="/admin/guru" page={pagination.page} totalPages={pagination.totalPages} params={{ search, ...(includeArchived ? { arsip: "1" } : {}) }} />
    </main>
  );
}
