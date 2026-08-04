import { requireActor, requireRole } from "@/server/auth/session";
import { listKelas, listPrograms } from "@/server/services/master-data-service";
import { listTagihan, listTarif } from "@/server/services/billing-service";
import { GenerateInvoiceForm, ReconcilePaymentButton, TarifForm } from "@/components/dashboard/billing-forms";
import { PaginationControls } from "@/components/dashboard/pagination-controls";

export const metadata = { title: "Tagihan" };

export default async function AdminTagihanPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const params = await searchParams;
  const page = Number(Array.isArray(params.page) ? params.page[0] : params.page) || 1;
  const [{ items: tagihan, pagination: tagihanPagination }, { items: tarif }, { items: programs }, { items: kelas }] = await Promise.all([
    listTagihan(actor, { page, pageSize: 20 }),
    listTarif(actor),
    listPrograms(actor),
    listKelas(actor),
  ]);

  return (
    <main className="space-y-6">
      <div><h1 className="tailadmin-page-title">Tagihan</h1><p className="mt-2 tailadmin-muted">Kelola tarif dan generate tagihan bulanan.</p></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TarifForm programs={programs.map((p) => ({ id: p.id, name: p.name }))} kelas={kelas.map((k) => ({ id: k.id, name: `${k.program.name} - ${k.name}` }))} />
        <GenerateInvoiceForm />
      </div>
      <section className="grid gap-4 lg:grid-cols-2">
         <div className="tailadmin-card p-5"><h2 className="font-semibold text-gray-900">Tarif</h2>{tarif.length > 0 ? <div className="mt-4 space-y-3">{tarif.map((item) => <article key={item.id} className="rounded-xl bg-gray-50 p-3"><p className="font-semibold text-gray-800">{item.name}</p><p className="text-theme-sm text-gray-500">Rp {item.amount.toString()} / {item.program?.name || item.kelas?.name}</p></article>)}</div> : <p className="mt-4 text-theme-sm text-gray-500">Belum ada tarif. Tambahkan tarif melalui formulir di atas.</p>}</div>
         <div className="tailadmin-card p-5"><h2 className="font-semibold text-gray-900">Tagihan Terbaru</h2>{tagihan.length > 0 ? <div className="mt-4 space-y-3">{tagihan.map((item) => <article key={item.id} className="rounded-xl bg-gray-50 p-3"><p className="font-semibold text-gray-800">{item.siswa.name}</p><p className="text-theme-sm text-gray-500">{item.jenis} {item.periode.toISOString().slice(0, 7)} / Rp {item.amount.toString()} / {item.status}</p><ReconcilePaymentButton tagihanId={item.id} disabled={item.status === "PAID"} /></article>)}</div> : <p className="mt-4 text-theme-sm text-gray-500">Belum ada tagihan terbaru.</p>}</div>
      </section>
      <PaginationControls basePath="/admin/tagihan" page={tagihanPagination.page} totalPages={tagihanPagination.totalPages} />
    </main>
  );
}
