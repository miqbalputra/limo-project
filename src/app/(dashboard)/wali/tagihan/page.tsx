import { requireActor, requireRole } from "@/server/auth/session";
import { listTagihan } from "@/server/services/billing-service";
import { resolveWaliChildId } from "@/server/dal/wali-selector-dal";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { MetricStat } from "@/components/dashboard/metric-card";
import { WaliBillingWorkspace, type WaliBillingInvoice } from "@/components/dashboard/wali-billing-workspace";
import { summarizeBilling } from "@/lib/billing-summary";
import { formatRupiah } from "@/lib/money";

export const metadata = { title: "Tagihan" };

export default async function WaliTagihanPage({ searchParams }: { searchParams: Promise<{ anak?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { anak } = await searchParams;
  const { items } = await listTagihan(actor, {}, {}, await resolveWaliChildId(actor, anak));
  const serializedItems = items.map(serializeInvoice);
  const summary = summarizeBilling(serializedItems);
  const openItems = serializedItems.filter((item) => ["UNPAID", "PENDING", "OVERDUE"].includes(item.status));
  const nearestDue = openItems.slice().sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime())[0];

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Administrasi Pembayaran"
        title="Tagihan"
        description="Pantau tagihan bulanan, status pembayaran setiap anak, jatuh tempo terdekat, dan instruksi bayar QRIS atau Akun Virtual."
        aside={<div className="grid w-full min-w-0 grid-cols-2 gap-2 rounded-2xl border border-gray-100 bg-white/85 p-3 shadow-theme-xs sm:grid-cols-3 lg:w-auto lg:min-w-80"><MetricStat align="center" rounded="2xl" truncateLabel label="Total" value={formatRupiah(summary.totalAmount)} /><MetricStat align="center" rounded="2xl" truncateLabel label="Lunas" value={formatRupiah(summary.paidAmount)} /><MetricStat align="center" rounded="2xl" truncateLabel label="Sisa" value={formatRupiah(summary.openAmount)} helper={nearestDue ? formatDate(nearestDue.dueDate) : "Aman"} /></div>}
      />
      <WaliBillingWorkspace items={serializedItems} />
    </main>
  );
}

function serializeInvoice(item: Awaited<ReturnType<typeof listTagihan>>["items"][number]): WaliBillingInvoice {
  return {
    id: item.id,
    period: item.periode.toISOString(),
    jenis: item.jenis,
    description: item.description,
    amount: Number(item.amount),
    status: item.status,
    dueDate: item.dueDate.toISOString(),
    paidAt: item.paidAt?.toISOString() ?? null,
    siswa: item.siswa,
    paymentUrl: item.paymentUrl,
    paymentAvailable: item.paymentAvailable,
    paymentHistoryCount: item.paymentHistoryCount,
    paymentHistory: item.paymentHistory.map((payment) => ({
      id: payment.id,
      provider: payment.provider,
      providerReference: payment.providerReference,
      amount: Number(payment.amount),
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      paidAt: payment.paidAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
    })),
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(value));
}
