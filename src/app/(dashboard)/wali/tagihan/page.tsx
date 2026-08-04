import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { listTagihan } from "@/server/services/billing-service";
import { PaymentButton } from "@/components/dashboard/payment-button";
import { DashboardHero, EmptyState, ProgressBar } from "@/components/dashboard/dashboard-widgets";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";

export const metadata = { title: "Tagihan" };

type Invoice = Awaited<ReturnType<typeof listTagihan>>["items"][number];

export default async function WaliTagihanPage() {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { items } = await listTagihan(actor);
  const monthGroups = groupInvoicesByMonth(items);
  const openItems = items.filter((item) => ["UNPAID", "PENDING", "OVERDUE"].includes(item.status));
  const paidItems = items.filter((item) => item.status === "PAID");
  const totalAmount = sumAmount(items);
  const openAmount = sumAmount(openItems);
  const paidAmount = sumAmount(paidItems);
  const nearestDue = openItems.slice().sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime())[0];

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Administrasi Pembayaran"
        title="Tagihan Bulanan"
        description="Pantau tagihan per bulan, status pembayaran setiap anak, jatuh tempo terdekat, dan instruksi bayar QRIS/Virtual Account."
        aside={<BillingHero total={totalAmount} paid={paidAmount} open={openAmount} nearestDue={nearestDue?.dueDate ?? null} />}
      />

      {items.length > 0 ? (
        <>
          <section className="grid gap-4 lg:grid-cols-3">
            <SummaryCard icon="billing" label="Total Tagihan" value={formatCurrency(totalAmount)} helper={`${items.length} invoice tercatat`} tone="brand" />
            <SummaryCard icon="billing" label="Sudah Dibayar" value={formatCurrency(paidAmount)} helper={`${paidItems.length} invoice lunas`} tone="success" />
            <SummaryCard icon="billing" label="Perlu Dibayar" value={formatCurrency(openAmount)} helper={nearestDue ? `Jatuh tempo terdekat ${formatDate(nearestDue.dueDate)}` : "Tidak ada tagihan aktif"} tone={openAmount > 0 ? "warning" : "success"} />
          </section>

          <section className="space-y-5">
            {monthGroups.map((group) => (
              <article key={group.key} className="tailadmin-card overflow-hidden p-0">
                <div className="border-b border-gray-100 bg-gray-50/70 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">Periode Bulanan</p>
                      <h2 className="mt-1 text-xl font-semibold text-gray-900">{group.label}</h2>
                      <p className="mt-1 text-theme-sm text-gray-500">{group.items.length} tagihan / {group.paidCount} lunas / {group.openCount} belum lunas</p>
                    </div>
                    <div className="grid min-w-72 grid-cols-3 gap-2">
                      <MiniStat label="Total" value={formatCurrency(group.totalAmount)} />
                      <MiniStat label="Lunas" value={formatCurrency(group.paidAmount)} />
                      <MiniStat label="Sisa" value={formatCurrency(group.openAmount)} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-theme-xs text-gray-500"><span>Progress pembayaran bulan ini</span><span className="font-semibold text-gray-700">{group.paymentRate}%</span></div>
                    <ProgressBar value={group.paymentRate} tone={group.paymentRate >= 100 ? "success" : group.paymentRate >= 50 ? "brand" : "warning"} />
                  </div>
                </div>

                <div className="grid gap-4 p-5 xl:grid-cols-2">
                  {group.items.map((item) => <InvoiceCard key={item.id} item={item} />)}
                </div>
              </article>
            ))}
          </section>
        </>
      ) : (
        <EmptyState icon="billing" title="Belum ada tagihan" description="Tagihan bulanan akan tampil setelah admin membuat invoice untuk anak yang terhubung." />
      )}
    </main>
  );
}

function InvoiceCard({ item }: { item: Invoice }) {
  const status = getStatusView(item.status);
  const isPayable = ["UNPAID", "PENDING", "OVERDUE"].includes(item.status);

  return (
    <article className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 shadow-theme-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${status.iconClass}`}><DashboardIcon name="billing" className="size-5" /></span>
          <div className="min-w-0">
            <p className="truncate text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{item.siswa.nomorInduk}</p>
            <h3 className="mt-1 truncate font-semibold text-gray-900" title={item.siswa.name}>{item.siswa.name}</h3>
            <p className="mt-1 text-theme-sm text-gray-500">{item.jenis}{item.description ? ` / ${item.description}` : ""}</p>
          </div>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-theme-xs font-semibold ${status.badgeClass}`}>{status.label}</span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <MiniStat label="Nominal" value={formatCurrency(Number(item.amount))} />
        <MiniStat label="Jatuh Tempo" value={formatDate(item.dueDate)} />
        <MiniStat label="Periode" value={formatMonth(item.periode)} />
      </div>

      {item.status === "PAID" ? (
        <div className="mt-4 tailadmin-alert-success"><p>Pembayaran diterima pada {item.paidAt ? formatDate(item.paidAt) : "tanggal tercatat"}.</p><Link href={`/wali/tagihan/success?tagihanId=${encodeURIComponent(item.id)}`} className="mt-2 inline-flex font-semibold underline">Lihat konfirmasi pembayaran</Link></div>
      ) : isPayable && item.paymentAvailable ? (
        <PaymentButton tagihanId={item.id} initialPaymentUrl={item.paymentUrl} disabled={false} />
      ) : isPayable ? (
        <p className="mt-4 tailadmin-alert-warning">Instruksi pembayaran belum tersedia. Hubungi admin LIMO untuk bantuan pembayaran.</p>
      ) : (
        <p className="mt-4 rounded-xl bg-gray-50 p-3 text-theme-sm text-gray-500">Tagihan berstatus {status.label.toLowerCase()} dan tidak memerlukan pembayaran saat ini.</p>
      )}
    </article>
  );
}

function BillingHero({ total, paid, open, nearestDue }: { total: number; paid: number; open: number; nearestDue: Date | null }) {
  return (
    <div className="grid min-w-80 grid-cols-3 gap-2 rounded-2xl border border-gray-100 bg-white/80 p-3 shadow-theme-xs">
      <MiniStat label="Total" value={formatCurrency(total)} />
      <MiniStat label="Lunas" value={formatCurrency(paid)} />
      <MiniStat label="Sisa" value={formatCurrency(open)} helper={nearestDue ? formatDate(nearestDue) : "Aman"} />
    </div>
  );
}

function SummaryCard({ icon, label, value, helper, tone }: { icon: "billing"; label: string; value: string; helper: string; tone: "brand" | "success" | "warning" }) {
  const toneClass = {
    brand: "bg-brand-50 text-brand-600",
    success: "bg-success-50 text-success-700",
    warning: "bg-warning-50 text-warning-700",
  }[tone];

  return (
    <article className="tailadmin-card p-5">
      <span className={`grid size-12 place-items-center rounded-2xl ${toneClass}`}><DashboardIcon name={icon} className="size-6" /></span>
      <p className="mt-4 text-2xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-theme-sm font-semibold text-gray-700">{label}</p>
      <p className="mt-1 text-theme-xs leading-5 text-gray-500">{helper}</p>
    </article>
  );
}

function MiniStat({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-gray-50 p-3 text-center">
      <p className="truncate text-theme-sm font-semibold text-gray-900" title={value}>{value}</p>
      <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      {helper ? <p className="mt-0.5 truncate text-[10px] text-gray-400">{helper}</p> : null}
    </div>
  );
}

function groupInvoicesByMonth(items: Invoice[]) {
  const groups = new Map<string, Invoice[]>();

  for (const item of items) {
    const key = item.periode.toISOString().slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return [...groups.entries()].map(([key, groupItems]) => {
    const paidItems = groupItems.filter((item) => item.status === "PAID");
    const openItems = groupItems.filter((item) => ["UNPAID", "PENDING", "OVERDUE"].includes(item.status));
    const totalAmount = sumAmount(groupItems);
    const paidAmount = sumAmount(paidItems);
    const openAmount = sumAmount(openItems);

    return {
      key,
      label: formatMonth(groupItems[0].periode),
      items: groupItems,
      totalAmount,
      paidAmount,
      openAmount,
      paidCount: paidItems.length,
      openCount: openItems.length,
      paymentRate: totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0,
    };
  });
}

function sumAmount(items: Invoice[]) {
  return items.reduce((sum, item) => sum + Number(item.amount), 0);
}

function getStatusView(status: Invoice["status"]) {
  switch (status) {
    case "PAID":
      return { label: "Lunas", badgeClass: "bg-success-50 text-success-700", iconClass: "bg-success-50 text-success-700" };
    case "PENDING":
      return { label: "Menunggu Pembayaran", badgeClass: "bg-brand-50 text-brand-600", iconClass: "bg-brand-50 text-brand-600" };
    case "OVERDUE":
      return { label: "Lewat Tempo", badgeClass: "bg-error-50 text-error-700", iconClass: "bg-error-50 text-error-700" };
    case "UNPAID":
      return { label: "Belum Dibayar", badgeClass: "bg-warning-50 text-warning-700", iconClass: "bg-warning-50 text-warning-700" };
    case "CANCELLED":
      return { label: "Dibatalkan", badgeClass: "bg-gray-100 text-gray-600", iconClass: "bg-gray-50 text-gray-500" };
    case "REFUNDED":
      return { label: "Refund", badgeClass: "bg-gray-100 text-gray-600", iconClass: "bg-gray-50 text-gray-500" };
    default:
      return { label: "Draft", badgeClass: "bg-gray-100 text-gray-600", iconClass: "bg-gray-50 text-gray-500" };
  }
}

function formatCurrency(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatMonth(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(value);
}
