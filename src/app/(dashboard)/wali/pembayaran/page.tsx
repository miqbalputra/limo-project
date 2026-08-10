import { DashboardHero, MetricCard } from "@/components/dashboard/dashboard-widgets";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { PaymentLedger } from "@/components/dashboard/payment-ledger";
import { requireActor, requireRole } from "@/server/auth/session";
import { resolveWaliChildId } from "@/server/dal/wali-selector-dal";
import { listPaymentLedger } from "@/server/services/billing-service";
import { pembayaranStatusSchema } from "@/server/validation/billing";

export const metadata = { title: "Pembayaran" };

export default async function WaliPembayaranPage({ searchParams }: { searchParams: Promise<{ anak?: string; status?: string; search?: string; page?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const params = await searchParams;
  const selectedStudentId = await resolveWaliChildId(actor, params.anak);
  const search = params.search?.trim() || "";
  const parsedStatus = pembayaranStatusSchema.safeParse(params.status || "");
  const status = parsedStatus.success ? parsedStatus.data : undefined;
  const ledger = await listPaymentLedger(actor, { page: Number(params.page) || 1, pageSize: 50 }, { search, status }, selectedStudentId);
  const paidCount = ledger.items.filter((item) => item.status === "PAID").length;
  const pendingCount = ledger.items.filter((item) => item.status === "PENDING").length;

  return <main className="space-y-6"><DashboardHero eyebrow="Administrasi / Pembayaran" title="Riwayat pembayaran" description="Lihat histori transaksi anak yang dipilih, termasuk metode, provider reference, nominal, status refund, dan transaksi yang direkonsiliasi Admin." aside={<div className="rounded-2xl bg-limo-blue-50 px-5 py-4 text-limo-blue-800 shadow-theme-xs"><p className="text-theme-xs font-semibold uppercase tracking-wide">Konteks anak</p><p className="mt-1 text-lg font-semibold">{selectedStudentId ? "Satu anak" : "Semua anak"}</p><p className="mt-1 text-theme-xs">Atur melalui pemilih anak di header</p></div>} /><section className="grid gap-4 sm:grid-cols-2"><MetricCard label="Transaksi halaman ini" value={ledger.items.length} description="Sesuai anak, filter, dan pagination" icon="billing" /><MetricCard label="Status transaksi" value={`${paidCount} / ${pendingCount}`} description="Lunas / menunggu pada halaman ini" icon="audit" tone={pendingCount > 0 ? "warning" : "success"} /></section><form method="get" className="tailadmin-card grid gap-3 p-4 md:grid-cols-[minmax(220px,1fr)_190px_auto]"><input type="hidden" name="anak" value={params.anak || ""} /><label><span className="sr-only">Cari transaksi pembayaran</span><input name="search" defaultValue={search} aria-label="Cari transaksi pembayaran" placeholder="Cari provider, referensi, atau jenis tagihan" className="tailadmin-input py-2.5" /></label><label><span className="sr-only">Filter status pembayaran</span><select name="status" defaultValue={status || ""} aria-label="Filter status pembayaran" className="tailadmin-input py-2.5"><option value="">Semua status</option><option value="PENDING">Menunggu</option><option value="PAID">Lunas</option><option value="FAILED">Gagal</option><option value="EXPIRED">Kedaluwarsa</option><option value="CANCELLED">Dibatalkan</option><option value="REFUNDED">Dikembalikan</option></select></label><button type="submit" className="tailadmin-button-primary px-4 py-2.5">Terapkan</button></form><PaymentLedger items={ledger.items} audience="wali" /><PaginationControls basePath="/wali/pembayaran" page={ledger.pagination.page} totalPages={ledger.pagination.totalPages} params={{ anak: params.anak, search: search || undefined, status }} /></main>;
}
