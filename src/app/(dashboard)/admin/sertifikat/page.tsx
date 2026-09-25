import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { listSertifikat } from "@/server/services/certificate-service";
import { listKelas } from "@/server/services/master-data-service";
import { SertifikatIssueForm } from "@/components/dashboard/sertifikat-issue-form";
import { SertifikatRevokeButton } from "@/components/dashboard/sertifikat-revoke-button";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { PaginationControls } from "@/components/dashboard/pagination-controls";

export const metadata = { title: "Sertifikat" };

export default async function AdminSertifikatPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const params = await searchParams;
  const search = Array.isArray(params.search) ? params.search[0] : params.search;
  const page = Number(Array.isArray(params.page) ? params.page[0] : params.page) || 1;

  const [{ items, pagination }, { items: kelas }] = await Promise.all([
    listSertifikat(actor, { search, page, pageSize: 20 }),
    listKelas(actor),
  ]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Sertifikat</h1>
        <p className="mt-2 tailadmin-muted">Terbitkan sertifikat penyelesaian untuk siswa, unduh PDF, dan cabut bila diperlukan.</p>
      </div>

      <SertifikatIssueForm kelasOptions={kelas.map((item) => ({ id: item.id, name: `${item.program.name} - ${item.name}` }))} />

      <form method="get" className="tailadmin-card flex flex-col gap-3 p-4 sm:flex-row">
        <input name="search" defaultValue={search || ""} aria-label="Cari sertifikat" placeholder="Cari kode, judul, atau nama siswa" className="tailadmin-input" />
        <button className="tailadmin-button-primary sm:w-auto">Cari</button>
      </form>

      <section className="tailadmin-card overflow-hidden">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Daftar sertifikat</h2>
          <p className="mt-1 text-theme-xs text-gray-500">{pagination.totalItems} sertifikat tercatat</p>
        </div>
        {items.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {items.map((item) => (
              <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-theme-sm font-semibold text-gray-900">{item.siswa.name}</p>
                  <p className="mt-0.5 text-theme-xs text-gray-500">{item.title}</p>
                  <p className="mt-0.5 text-theme-xs text-gray-500">{item.kelas.program.name} / {item.kelas.name} · {formatDate(item.issuedAt)}</p>
                  <p className="mt-0.5 font-mono text-theme-xs text-gray-500">{item.code}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {item.revokedAt ? (
                    <span className="rounded-full bg-error-50 px-3 py-1 text-theme-xs font-semibold text-error-700">Dicabut</span>
                  ) : (
                    <>
                      <Link href={`/api/v1/sertifikat/${item.id}/pdf`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs font-semibold text-gray-700 hover:bg-gray-50">Unduh PDF</Link>
                      <SertifikatRevokeButton id={item.id} code={item.code} />
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : <div className="p-5"><EmptyState icon="exam" title="Belum ada sertifikat" description="Terbitkan sertifikat pertama menggunakan formulir di atas." /></div>}
      </section>

      <PaginationControls basePath="/admin/sertifikat" page={pagination.page} totalPages={pagination.totalPages} params={{ search }} />
    </main>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(value);
}
