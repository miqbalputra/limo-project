"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import type { ReactNode } from "react";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { MetricCard, MetricStat } from "@/components/dashboard/metric-card";
import { Money } from "@/components/dashboard/money";
import { PaymentButton } from "@/components/dashboard/payment-button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { summarizeBilling } from "@/lib/billing-summary";
import { formatRupiah } from "@/lib/money";
import { formatUiLabel, getUiToneClass } from "@/lib/ui-labels";

type BillingStatus =
  | "DRAFT"
  | "UNPAID"
  | "PENDING"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED"
  | "REFUNDED";

export type WaliBillingInvoice = {
  id: string;
  period: string;
  jenis: string;
  description: string | null;
  amount: number;
  status: BillingStatus;
  dueDate: string;
  paidAt: string | null;
  siswa: { name: string; nomorInduk: string };
  paymentUrl: string | null;
  paymentProvider: "mayar" | "pakasir" | string | null;
  paymentAvailable: boolean;
  availablePaymentProviders: ("mayar" | "pakasir")[];
  paymentHistoryCount: number;
  paymentHistory: {
    id: string;
    provider: string;
    providerReference: string | null;
    amount: number;
    status: string;
    paymentMethod: string | null;
    paidAt: string | null;
    createdAt: string;
  }[];
};

export function WaliBillingWorkspace({
  items,
}: {
  items: WaliBillingInvoice[];
}) {
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "OPEN" | "PAID" | "OVERDUE"
  >("ALL");
  const [sort, setSort] = useState<"period" | "dueDate">("period");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const summary = summarizeBilling(items);
  const openItems = items.filter((item) =>
    ["UNPAID", "PENDING", "OVERDUE"].includes(item.status),
  );
  const paidItems = items.filter((item) => item.status === "PAID");
  const overdueItems = items.filter((item) => item.status === "OVERDUE");
  const filteredItems = items
    .filter(
      (item) =>
        statusFilter === "ALL" ||
        (statusFilter === "OPEN"
          ? ["UNPAID", "PENDING", "OVERDUE"].includes(item.status)
          : item.status === statusFilter),
    )
    .filter(
      (item) =>
        !deferredSearch ||
        `${item.siswa.name} ${item.siswa.nomorInduk} ${item.jenis}`
          .toLowerCase()
          .includes(deferredSearch),
    )
    .slice()
    .sort((left, right) =>
      sort === "dueDate"
        ? new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime()
        : new Date(right.period).getTime() - new Date(left.period).getTime(),
    );
  const totalAmount = summary.totalAmount;
  const openAmount = summary.openAmount;
  const paidAmount = summary.paidAmount;
  const paymentRate = summary.paymentRate;
  const groups = groupInvoicesByMonth(filteredItems);

  return (
    <>
      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Ringkasan tagihan anak"
      >
        <MetricCard
          compact
          icon="billing"
          label="Total tagihan"
          value={formatRupiah(totalAmount)}
           description={`${summary.paidCount + summary.openCount} tagihan tertagih`}
          tone="brand"
          iconClassName="bg-limo-blue-50 text-limo-blue-600"
        />
        <MetricCard
          compact
          icon="audit"
          label="Sudah dibayar"
          value={formatRupiah(paidAmount)}
          description={`${paidItems.length} tagihan lunas`}
          tone="success"
        />
        <MetricCard
          compact
          icon="todo"
          label="Perlu dibayar"
          value={formatRupiah(openAmount)}
          description={`${openItems.length} tagihan terbuka`}
          tone={openItems.length > 0 ? "warning" : "success"}
        />
        <MetricCard
          compact
          icon="calendar"
          label="Lewat tempo"
          value={String(overdueItems.length)}
          description="Tagihan yang perlu segera dicek"
          tone={overdueItems.length > 0 ? "error" : "success"}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <article className="tailadmin-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-theme-xs font-semibold uppercase tracking-[0.16em] text-limo-blue-700">
                Ringkasan pembayaran
              </p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900">
                Perkembangan pembayaran
              </h2>
              <p className="mt-1 text-theme-sm text-gray-500">
                Ringkasan status pembayaran dari seluruh anak yang terhubung.
              </p>
            </div>
            <span className="grid size-11 place-items-center rounded-xl bg-success-50 text-success-700">
              <DashboardIcon name="progress" className="size-5" />
            </span>
          </div>
          <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-4xl font-semibold tracking-tight text-gray-900">
                {paymentRate}%
              </p>
              <p className="mt-1 text-theme-sm text-gray-500">
                nilai tagihan sudah lunas
              </p>
            </div>
            <p className="text-right text-theme-xs text-gray-500">
              <Money value={paidAmount} /> dari
              <br />
              <span className="font-semibold text-gray-700">
                <Money value={totalAmount} />
              </span>
            </p>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-success-500 transition-all"
              style={{ width: `${paymentRate}%` }}
            />
          </div>
          <div
            data-testid="billing-reconciliation"
            className="mt-5 space-y-1 text-theme-xs leading-5 text-gray-500"
          >
            <p>
              Total tertagih = <Money value={paidAmount} /> lunas +{" "}
              <Money value={openAmount} /> perlu dibayar.
            </p>
            <p>
              Di luar total: <Money value={summary.draftAmount} /> draft /{" "}
              <Money value={summary.cancelledAmount} /> dibatalkan /{" "}
              <Money value={summary.refundedAmount} /> refund.
            </p>
          </div>
        </article>
        <article className="rounded-2xl bg-limo-blue-600 p-5 text-white shadow-theme-sm sm:p-6">
          <span className="grid size-11 place-items-center rounded-xl bg-white/15">
            <DashboardIcon name="billing" className="size-5" />
          </span>
          <h2 className="mt-5 text-lg font-semibold">
            Cara bayar yang tersedia
          </h2>
          <p className="mt-2 text-theme-sm leading-6 text-white/75">
            Pilih metode di tagihan untuk membuat instruksi pembayaran melalui
            Mayar.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-theme-xs font-semibold">
              QRIS
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-theme-xs font-semibold">
              Akun virtual
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-theme-xs font-semibold">
              Dompet digital
            </span>
          </div>
        </article>
      </section>

      <section className="tailadmin-card overflow-hidden">
        <div className="border-b border-gray-200 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-theme-xs font-semibold uppercase tracking-[0.16em] text-limo-blue-700">
                Aktivitas pembayaran
              </p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900">
                Rincian pembayaran
              </h2>
              <p className="mt-1 text-theme-sm text-gray-500">
                Gunakan filter untuk menemukan tagihan dan melakukan pembayaran
                dengan jelas.
              </p>
            </div>
            <label className="block w-full lg:max-w-xs">
              <span className="sr-only">Cari tagihan</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Cari tagihan"
                placeholder="Cari nama anak atau jenis tagihan"
                className="tailadmin-input py-2.5"
              />
            </label>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              aria-label="Filter status tagihan"
            >
              <FilterButton
                active={statusFilter === "ALL"}
                onClick={() => setStatusFilter("ALL")}
              >
                Semua ({items.length})
              </FilterButton>
              <FilterButton
                active={statusFilter === "OPEN"}
                onClick={() => setStatusFilter("OPEN")}
              >
                Perlu dibayar ({openItems.length})
              </FilterButton>
              <FilterButton
                active={statusFilter === "PAID"}
                onClick={() => setStatusFilter("PAID")}
              >
                Lunas ({paidItems.length})
              </FilterButton>
              <FilterButton
                active={statusFilter === "OVERDUE"}
                onClick={() => setStatusFilter("OVERDUE")}
              >
                Lewat tempo ({overdueItems.length})
              </FilterButton>
            </div>
            <label className="flex shrink-0 items-center gap-2 text-theme-xs font-medium text-gray-500">
              <span>Urutkan</span>
              <select
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value as "period" | "dueDate")
                }
                aria-label="Urutkan tagihan"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-theme-xs text-gray-700"
              >
                <option value="period">Periode terbaru</option>
                <option value="dueDate">Jatuh tempo terdekat</option>
              </select>
            </label>
          </div>
        </div>
        <p
          className="border-b border-gray-100 px-5 py-3 text-theme-xs text-gray-500 sm:px-6"
          aria-live="polite"
        >
          Menampilkan {filteredItems.length} tagihan
        </p>
        {groups.length > 0 ? (
          <div className="space-y-5 p-4 sm:p-6">
            {groups.map((group) => (
              <InvoiceMonthGroup key={group.key} group={group} />
            ))}
          </div>
        ) : (
          <EmptyBillingState hasItems={items.length > 0} />
        )}
      </section>
    </>
  );
}

function InvoiceMonthGroup({ group }: { group: InvoiceGroup }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50/60">
      <div className="flex flex-col gap-4 border-b border-gray-100 bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-500">
            Periode pembayaran
          </p>
          <h3 className="mt-1 text-xl font-semibold text-gray-900">
            {group.label}
          </h3>
          <p className="mt-1 text-theme-sm text-gray-500">
            {group.items.length} tagihan / {group.paidCount} lunas /{" "}
            {group.openCount} belum lunas
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:min-w-80">
          <MetricStat align="center" truncateLabel label="Total" value={formatRupiah(group.totalAmount)} />
          <MetricStat align="center" truncateLabel label="Lunas" value={formatRupiah(group.paidAmount)} />
          <MetricStat align="center" truncateLabel label="Sisa" value={formatRupiah(group.openAmount)} />
        </div>
      </div>
      <div className="border-b border-gray-100 bg-white px-5 pb-5">
        <div className="mb-2 flex items-center justify-between text-theme-xs text-gray-500">
          <span>Progres pembayaran periode ini</span>
          <span className="font-semibold text-gray-700">
            {group.paymentRate}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${group.paymentRate >= 100 ? "bg-success-500" : group.paymentRate >= 50 ? "bg-limo-blue-500" : "bg-warning-500"}`}
            style={{ width: `${group.paymentRate}%` }}
          />
        </div>
      </div>
      <div className="grid gap-4 p-4 xl:grid-cols-2">
        {group.items.map((item) => (
          <WaliInvoiceCard key={item.id} item={item} />
        ))}
      </div>
    </article>
  );
}

function WaliInvoiceCard({ item }: { item: WaliBillingInvoice }) {
  const isPayable = ["UNPAID", "PENDING", "OVERDUE"].includes(item.status);
  return (
    <article className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs transition hover:bg-gray-25 hover:shadow-theme-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span
            className={`grid size-11 shrink-0 place-items-center rounded-xl ${getUiToneClass(item.status)}`}
          >
            <DashboardIcon name="billing" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-500">
              {item.siswa.nomorInduk}
            </p>
            <h4
              className="mt-1 truncate font-semibold text-gray-900"
              title={item.siswa.name}
            >
              {item.siswa.name}
            </h4>
            <p className="mt-1 text-theme-sm text-gray-500">
              {item.jenis}
              {item.description ? ` / ${item.description}` : ""}
            </p>
          </div>
        </div>
        <StatusBadge status={item.status} className="w-fit px-3" />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <MetricStat align="center" truncateLabel label="Nominal" value={formatRupiah(item.amount)} />
        <MetricStat align="center" truncateLabel label="Jatuh tempo" value={formatDate(item.dueDate)} />
        <MetricStat align="center" truncateLabel label="Periode" value={formatMonth(item.period)} />
      </div>
      {item.status === "PAID" ? (
        <div className="mt-4 rounded-xl border border-success-100 bg-success-50 p-3 text-theme-sm text-success-700">
          <p className="font-semibold">Pembayaran diterima.</p>
          <p className="mt-1">
            {item.paidAt
              ? `Tercatat pada ${formatDate(item.paidAt)}.`
              : "Status pembayaran sudah lunas."}
          </p>
          <Link
            href={`/wali/tagihan/success?tagihanId=${encodeURIComponent(item.id)}`}
            className="mt-2 inline-flex font-semibold underline"
          >
            Lihat konfirmasi pembayaran
          </Link>
        </div>
      ) : isPayable && item.paymentAvailable ? (
        <PaymentButton
          tagihanId={item.id}
          initialPaymentUrl={item.paymentUrl}
          initialPaymentProvider={item.paymentProvider === "mayar" || item.paymentProvider === "pakasir" ? item.paymentProvider : null}
          availableProviders={item.availablePaymentProviders}
          disabled={false}
        />
      ) : isPayable ? (
        <p className="mt-4 tailadmin-alert-warning">
          Instruksi pembayaran belum tersedia. Hubungi admin LIMO untuk bantuan
          pembayaran.
        </p>
      ) : (
        <p className="mt-4 rounded-xl bg-gray-50 p-3 text-theme-sm text-gray-500">
          Tagihan berstatus {formatUiLabel(item.status).toLowerCase()}.
        </p>
      )}
      {item.paymentHistory.length > 0 ? (
        <details className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <summary className="cursor-pointer text-theme-sm font-semibold text-gray-700">
            Riwayat transaksi ({item.paymentHistory.length}
            {item.paymentHistoryCount > item.paymentHistory.length
              ? ` dari ${item.paymentHistoryCount} terbaru`
              : ""}
            )
          </summary>
          <div className="mt-3 space-y-2">
            {item.paymentHistory.map((payment) => (
              <article
                key={payment.id}
                className="rounded-lg bg-white p-3 text-theme-xs text-gray-600"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-gray-800">
                    {payment.provider.toUpperCase()} /{" "}
                    {formatPaymentMethod(
                      payment.paymentMethod,
                      payment.provider,
                    )}
                  </p>
                  <StatusBadge status={payment.status} compact />
                </div>
                <p className="mt-1 break-all text-gray-500">
                  Referensi: {payment.providerReference || "Tidak tersedia"}
                </p>
                <p className="mt-2 font-semibold text-gray-800">
                  <Money value={payment.amount} />
                </p>
                <p className="mt-1">
                  Dicatat {formatDateTime(payment.createdAt)}
                  {payment.paidAt
                    ? ` / Dibayar ${formatDateTime(payment.paidAt)}`
                    : ""}
                </p>
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-theme-xs font-semibold transition ${active ? "bg-limo-blue-50 text-limo-blue-600" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
    >
      {children}
    </button>
  );
}

function EmptyBillingState({ hasItems }: { hasItems: boolean }) {
  return (
    <div className="px-6 py-14 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-gray-50 text-gray-400">
        <DashboardIcon name="billing" className="size-7" />
      </span>
      <h3 className="mt-4 font-semibold text-gray-900">
        {hasItems ? "Tidak ada tagihan yang cocok" : "Belum ada tagihan"}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-theme-sm leading-6 text-gray-500">
        {hasItems
          ? "Coba ubah filter atau kata kunci pencarian."
          : "Tagihan bulanan akan tampil setelah admin membuat invoice untuk anak yang terhubung."}
      </p>
    </div>
  );
}

type InvoiceGroup = {
  key: string;
  label: string;
  items: WaliBillingInvoice[];
  totalAmount: number;
  paidAmount: number;
  openAmount: number;
  paidCount: number;
  openCount: number;
  paymentRate: number;
};

function groupInvoicesByMonth(items: WaliBillingInvoice[]) {
  const groups = new Map<string, WaliBillingInvoice[]>();
  for (const item of items)
    groups.set(item.period.slice(0, 7), [
      ...(groups.get(item.period.slice(0, 7)) ?? []),
      item,
    ]);
  return [...groups.entries()].map(([key, groupItems]) => {
    const summary = summarizeBilling(groupItems);
    return {
      key,
      label: formatMonth(groupItems[0].period),
      items: groupItems,
      totalAmount: summary.totalAmount,
      paidAmount: summary.paidAmount,
      openAmount: summary.openAmount,
      paidCount: summary.paidCount,
      openCount: summary.openCount,
      paymentRate: summary.paymentRate,
    };
  });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function formatPaymentMethod(value: string | null, provider: string) {
  if (!value)
    return provider === "manual" ? formatUiLabel("MANUAL") : "Tidak tercatat";
  return value
    .replace("va/", "VA ")
    .replace("ewallet/", "")
    .replace("outlet/", "")
    .toUpperCase();
}
