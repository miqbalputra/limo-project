import Link from "next/link";
import { DashboardHero, MetricCard } from "@/components/dashboard/dashboard-widgets";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { PaymentLedger } from "@/components/dashboard/payment-ledger";
import { requireActor, requireRole } from "@/server/auth/session";
import { listPaymentLedger } from "@/server/services/billing-service";
import { pembayaranStatusSchema } from "@/server/validation/billing";

export const metadata = { title: "Pembayaran" };

export default async function AdminPembayaranPage({ searchParams }: { searchParams: Promise<{ search?: string; status?: string; page?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const params = await searchParams;
  const search = params.search?.trim() || "";
  const parsedStatus = pembayaranStatusSchema.safeParse(params.status || "");
  const status = parsedStatus.success ? parsedStatus.data : undefined;
  const ledger = await listPaymentLedger(actor, { page: Number(params.page) || 1, pageSize: 30 }, { search, status });
  const paidCount = ledger.items.filter((item) => item.status === "PAID").length;
  const pendingCount = ledger.items.filter((item) => item.status === "PENDING").length;
  const refundedCount = ledger.items.filter((item) => item.status === "REFUNDED").length;

  return <main className="space-y-6"><DashboardHero eyebrow="Administrasi / Keuangan" title="Pembayaran" description="Ledger lintas invoice untuk menelusuri provider, referensi pembayaran, metode, nominal, status refund, dan rekonsiliasi manual." actions={<Link href="/admin/tagihan" className="tailadmin-button-outline px-4 py-2.5">Kembali ke tagihan</Link>} /><section className="grid gap-4 sm:grid-cols-3"><MetricCard label="Transaksi halaman ini" value={ledger.items.length} description="Sesuai filter dan pagination saat ini" icon="billing" /><MetricCard label="Lunas" value={paidCount} description="Transaksi berstatus lunas" icon="audit" tone="success" /><MetricCard label="Perlu dicek" value={pendingCount + refundedCount} description={`${pendingCount} menunggu / ${refundedCount} refund`} icon="todo" tone={pendingCount + refundedCount > 0 ? "warning" : "gray"} /></section><form method="get" className="tailadmin-card grid gap-3 p-4 md:grid-cols-[minmax(220px,1fr)_190px_auto]"><label><span className="sr-only">Cari ledger pembayaran</span><input name="search" defaultValue={search} aria-label="Cari ledger pembayaran" placeholder="Cari siswa, invoice, provider, atau referensi" className="tailadmin-input py-2.5" /></label><label><span className="sr-only">Filter status pembayaran</span><select name="status" defaultValue={status || ""} aria-label="Filter status pembayaran" className="tailadmin-input py-2.5"><option value="">Semua status</option><option value="PENDING">Menunggu</option><option value="PAID">Lunas</option><option value="FAILED">Gagal</option><option value="EXPIRED">Kedaluwarsa</option><option value="CANCELLED">Dibatalkan</option><option value="REFUNDED">Dikembalikan</option></select></label><button type="submit" className="tailadmin-button-primary px-4 py-2.5">Terapkan</button></form><PaymentLedger items={ledger.items} audience="admin" /><PaginationControls basePath="/admin/pembayaran" page={ledger.pagination.page} totalPages={ledger.pagination.totalPages} params={{ search: search || undefined, status }} /></main>;
}
