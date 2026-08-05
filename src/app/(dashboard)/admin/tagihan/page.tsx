import { requireActor, requireRole } from "@/server/auth/session";
import { listKelas, listPrograms } from "@/server/services/master-data-service";
import { listTagihan, listTarif } from "@/server/services/billing-service";
import { isMayarConfigured } from "@/server/providers/payment/mayar";
import { GenerateInvoiceForm, ReconcilePaymentButton, TarifForm } from "@/components/dashboard/billing-forms";
import { PaginationControls } from "@/components/dashboard/pagination-controls";

export const metadata = { title: "Tagihan" };

export default async function AdminTagihanPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const params = await searchParams;
  const page = Number(Array.isArray(params.page) ? params.page[0] : params.page) || 1;
  const search = String(Array.isArray(params.search) ? params.search[0] || "" : params.search || "").trim();
  const requestedStatus = String(Array.isArray(params.status) ? params.status[0] || "" : params.status || "");
  const status = ["UNPAID", "PENDING", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"].includes(requestedStatus) ? requestedStatus as "UNPAID" | "PENDING" | "PAID" | "OVERDUE" | "CANCELLED" | "REFUNDED" : undefined;
  const [{ items: tagihan, pagination: tagihanPagination }, { items: tarif }, { items: programs }, { items: kelas }] = await Promise.all([
    listTagihan(actor, { page, pageSize: 20 }, { search, status }),
    listTarif(actor),
    listPrograms(actor),
    listKelas(actor),
  ]);
  const mayarConfigured = isMayarConfigured();

  return (
    <main className="space-y-6">
      <div><h1 className="tailadmin-page-title">Tagihan</h1><p className="mt-2 tailadmin-muted">Kelola tarif, generate tagihan bulanan, pantau histori pembayaran, dan rekonsiliasi Mayar.</p></div>
      <section className={`rounded-2xl border p-4 ${mayarConfigured ? "border-success-200 bg-success-50" : "border-warning-200 bg-warning-50"}`}>
        <p className={`text-theme-sm font-semibold ${mayarConfigured ? "text-success-800" : "text-warning-800"}`}>Payment Gateway: Mayar {mayarConfigured ? "aktif" : "belum dikonfigurasi"}</p>
        <p className={`mt-1 text-theme-xs ${mayarConfigured ? "text-success-700" : "text-warning-700"}`}>Wali dapat membayar melalui checkout Mayar dengan QRIS, Virtual Account, dan kanal yang aktif pada dashboard merchant Mayar.</p>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <TarifForm programs={programs.map((p) => ({ id: p.id, name: p.name }))} kelas={kelas.map((k) => ({ id: k.id, name: `${k.program.name} - ${k.name}` }))} />
        <GenerateInvoiceForm />
      </div>
      <section className="grid gap-4 lg:grid-cols-2">
          <div className="tailadmin-card p-5"><h2 className="font-semibold text-gray-900">Tarif</h2>{tarif.length > 0 ? <div className="mt-4 space-y-3">{tarif.map((item) => <article key={item.id} className="rounded-xl bg-gray-50 p-3"><div className="flex items-start justify-between gap-3"><p className="font-semibold text-gray-800">{item.name}</p><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.isActive ? "bg-success-50 text-success-700" : "bg-gray-100 text-gray-500"}`}>{item.isActive ? "Aktif" : "Arsip"}</span></div><p className="text-theme-sm text-gray-500">Rp {item.amount.toString()} / {item.program?.name || item.kelas?.name}</p><p className="mt-1 text-theme-xs text-gray-400">Berlaku {formatDate(item.effectiveFrom)}{item.effectiveTo ? ` - ${formatDate(item.effectiveTo)}` : ""}</p></article>)}</div> : <p className="mt-4 text-theme-sm text-gray-500">Belum ada tarif. Tambahkan tarif melalui formulir di atas.</p>}</div>
          <div className="tailadmin-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-gray-900">Tagihan Terbaru</h2><p className="mt-1 text-theme-xs text-gray-500">Filter tagihan dan lihat histori transaksi Mayar.</p></div><form method="get" className="flex flex-wrap gap-2"><input name="search" defaultValue={search} aria-label="Cari tagihan" placeholder="Cari siswa / nomor induk" className="tailadmin-input w-48 py-2" /><select name="status" defaultValue={status || ""} aria-label="Filter status tagihan" className="tailadmin-input w-40 py-2"><option value="">Semua status</option><option value="UNPAID">Belum dibayar</option><option value="PENDING">Menunggu</option><option value="PAID">Lunas</option><option value="OVERDUE">Lewat tempo</option><option value="CANCELLED">Dibatalkan</option></select><button className="tailadmin-button-outline px-3 py-2">Filter</button></form></div>{tagihan.length > 0 ? <div className="mt-4 space-y-3">{tagihan.map((item) => <article key={item.id} className="rounded-xl bg-gray-50 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-gray-800">{item.siswa.name}</p><p className="text-theme-xs text-gray-500">{item.siswa.nomorInduk} / {item.jenis} {item.periode.toISOString().slice(0, 7)}</p></div><span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-gray-600">{item.status}</span></div><p className="mt-2 text-theme-sm text-gray-500">Rp {item.amount.toString()} / jatuh tempo {formatDate(item.dueDate)}</p>{item.paymentHistory.length > 0 ? <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3"><p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">Histori Pembayaran</p><div className="mt-2 space-y-1">{item.paymentHistory.map((payment) => <p key={payment.id} className="text-theme-xs text-gray-600">{payment.provider.toUpperCase()} / {formatPaymentMethod(payment.paymentMethod)} / {payment.status}{payment.paidAt ? ` / ${formatDate(payment.paidAt)}` : ""}</p>)}</div></div> : <p className="mt-2 text-theme-xs text-gray-400">Belum ada transaksi payment gateway.</p>}<ReconcilePaymentButton tagihanId={item.id} disabled={item.status === "PAID"} /></article>)}</div> : <p className="mt-4 text-theme-sm text-gray-500">Belum ada tagihan sesuai filter.</p>}</div>
      </section>
      <PaginationControls basePath="/admin/tagihan" page={tagihanPagination.page} totalPages={tagihanPagination.totalPages} />
    </main>
  );
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatPaymentMethod(value: string | null) {
  if (!value) return "Checkout";
  return value.replace("va/", "VA ").replace("ewallet/", "").replace("outlet/", "").toUpperCase();
}
