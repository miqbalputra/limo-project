"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { ReconcilePaymentButton } from "@/components/dashboard/billing-forms";
import { MetricCard, MetricStat } from "@/components/dashboard/metric-card";
import { Money } from "@/components/dashboard/money";
import { ResponsiveDataView } from "@/components/dashboard/responsive-data-view";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { formatRupiah } from "@/lib/money";
import { formatUiLabel } from "@/lib/ui-labels";

export type BillingStatus =
  | "DRAFT"
  | "UNPAID"
  | "PENDING"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED"
  | "REFUNDED";

export type AdminBillingInvoice = {
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
  paymentAvailable: boolean;
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

export type BillingSummary = {
  totalCount: number;
  totalAmount: number;
  paidCount: number;
  paidAmount: number;
  openCount: number;
  openAmount: number;
  overdueCount: number;
  overdueAmount: number;
  collectionRate: number;
  statusBreakdown: {
    status: BillingStatus;
    label: string;
    count: number;
    amount: number;
  }[];
};

export function AdminBillingWorkspace({
  invoices,
  summary,
  search,
  status,
}: {
  invoices: AdminBillingInvoice[];
  summary: BillingSummary;
  search: string;
  status?: BillingStatus;
}) {
  const [view, setView] = useState<"table" | "cards">("table");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [quickSearch, setQuickSearch] = useState("");
  const deferredSearch = useDeferredValue(quickSearch.trim().toLowerCase());
  const visibleInvoices = deferredSearch
    ? invoices.filter((item) =>
        `${item.siswa.name} ${item.siswa.nomorInduk} ${item.id} ${item.jenis} ${item.paymentHistory.map((payment) => `${payment.provider} ${payment.providerReference || ""} ${payment.status} ${payment.paymentMethod || ""}`).join(" ")}`
          .toLowerCase()
          .includes(deferredSearch),
      )
    : invoices;

  return (
    <>
      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Ringkasan tagihan"
      >
        <MetricCard
          compact
          icon="billing"
          label="Total ditagihkan"
          value={formatRupiah(summary.totalAmount)}
          description={`${summary.totalCount} invoice tercatat`}
          tone="brand"
        />
        <MetricCard
          compact
          icon="audit"
          label="Sudah tertagih"
          value={formatRupiah(summary.paidAmount)}
          description={`${summary.paidCount} invoice lunas`}
          tone="success"
        />
        <MetricCard
          compact
          icon="todo"
          label="Perlu ditindaklanjuti"
          value={formatRupiah(summary.openAmount)}
          description={`${summary.openCount} invoice masih terbuka`}
          tone={summary.openCount > 0 ? "warning" : "success"}
        />
        <MetricCard
          compact
          icon="calendar"
          label="Lewat jatuh tempo"
          value={formatRupiah(summary.overdueAmount)}
          description={`${summary.overdueCount} tagihan lewat jatuh tempo`}
          tone={summary.overdueCount > 0 ? "error" : "success"}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <CollectionBreakdown summary={summary} />
        <article className="overflow-hidden rounded-2xl bg-gray-950 p-6 text-white shadow-theme-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-theme-xs font-semibold uppercase tracking-[0.16em] text-white/50">
                Ringkasan penagihan
              </p>
              <h2 className="mt-2 text-xl font-semibold">Tingkat pelunasan</h2>
            </div>
            <span className="grid size-11 place-items-center rounded-xl bg-white/10 text-success-300">
              <DashboardIcon name="progress" className="size-5" />
            </span>
          </div>
          <p className="mt-8 text-5xl font-semibold tracking-tight">
            {summary.collectionRate}%
          </p>
          <p className="mt-2 max-w-xs text-theme-sm leading-6 text-white/60">
            Persentase nilai invoice yang sudah berhasil dikonfirmasi sebagai
            lunas.
          </p>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-success-400 transition-all"
              style={{ width: `${Math.min(summary.collectionRate, 100)}%` }}
            />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-5">
            <div>
              <p className="text-theme-xs text-white/50">Nilai lunas</p>
              <p className="mt-1 text-theme-sm font-semibold">
                <Money value={summary.paidAmount} />
              </p>
            </div>
            <div>
              <p className="text-theme-xs text-white/50">Sisa terbuka</p>
              <p className="mt-1 text-theme-sm font-semibold">
                <Money value={summary.openAmount} />
              </p>
            </div>
          </div>
          <Link
            href="/admin/laporan"
            className="mt-6 inline-flex items-center gap-2 text-theme-sm font-semibold text-white hover:text-limo-blue-200"
          >
            Buka laporan lengkap <span aria-hidden="true">-&gt;</span>
          </Link>
        </article>
      </section>

      <section id="invoice-table" className="tailadmin-card overflow-hidden">
        <div className="border-b border-gray-200 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-theme-xs font-semibold uppercase tracking-[0.16em] text-limo-blue-700">
                Daftar tagihan
              </p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900">
                Daftar tagihan
              </h2>
              <p className="mt-1 text-theme-sm text-gray-500">
                Cari tagihan, buka detail pembayaran, dan selesaikan
                rekonsiliasi manual dengan aman.
              </p>
            </div>
            <div
            className="hidden items-center gap-2 rounded-lg bg-gray-50 p-1 2xl:flex"
              aria-label="Pilih tampilan transaksi"
            >
              <button
                type="button"
                onClick={() => setView("table")}
                aria-pressed={view === "table"}
                className={`rounded-md px-3 py-2 text-theme-xs font-semibold ${view === "table" ? "bg-white text-limo-blue-600 shadow-theme-xs" : "text-gray-500 hover:text-gray-700"}`}
              >
                Tabel
              </button>
              <button
                type="button"
                onClick={() => setView("cards")}
                aria-pressed={view === "cards"}
                className={`rounded-md px-3 py-2 text-theme-xs font-semibold ${view === "cards" ? "bg-white text-limo-blue-600 shadow-theme-xs" : "text-gray-500 hover:text-gray-700"}`}
              >
                Kartu
              </button>
            </div>
          </div>

          <div
            className="mt-5 flex gap-2 overflow-x-auto pb-1"
            aria-label="Filter cepat status"
          >
            {[
              { label: formatUiLabel("ALL"), value: "" },
              { label: formatUiLabel("DRAFT"), value: "DRAFT" },
              { label: formatUiLabel("UNPAID"), value: "UNPAID" },
              { label: formatUiLabel("PENDING"), value: "PENDING" },
              { label: formatUiLabel("PAID"), value: "PAID" },
              { label: formatUiLabel("OVERDUE"), value: "OVERDUE" },
            ].map((item) => (
              <Link
                key={item.value || "all"}
                href={getFilterHref(search, item.value)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-theme-xs font-semibold transition ${status === item.value || (!status && !item.value) ? "bg-limo-blue-50 text-limo-blue-600" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(240px,1fr)_190px_auto]">
            <form method="get" action="/admin/tagihan" className="contents">
              <label className="relative block">
                <span className="sr-only">Cari tagihan di server</span>
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <SearchIcon />
                </span>
                <input
                  name="search"
                  defaultValue={search}
                  aria-label="Cari tagihan"
                  placeholder="Cari siswa, ID tagihan, atau referensi pembayaran"
                  className="tailadmin-input py-2.5 pl-10"
                />
              </label>
              <select
                name="status"
                defaultValue={status || ""}
                aria-label="Filter status tagihan"
                className="tailadmin-input py-2.5"
              >
                <option value="">Semua status</option>
                <option value="DRAFT">{formatUiLabel("DRAFT")}</option>
                <option value="UNPAID">{formatUiLabel("UNPAID")}</option>
                <option value="PENDING">{formatUiLabel("PENDING")}</option>
                <option value="PAID">{formatUiLabel("PAID")}</option>
                <option value="OVERDUE">{formatUiLabel("OVERDUE")}</option>
                <option value="CANCELLED">{formatUiLabel("CANCELLED")}</option>
                <option value="REFUNDED">{formatUiLabel("REFUNDED")}</option>
              </select>
              <button className="tailadmin-button-primary px-4 py-2.5">
                Terapkan filter
              </button>
            </form>
          </div>
          <label className="mt-3 block max-w-md">
            <span className="text-theme-xs font-medium text-gray-500">
              Filter cepat pada hasil halaman ini
            </span>
            <input
              value={quickSearch}
              onChange={(event) => setQuickSearch(event.target.value)}
              aria-label="Filter cepat pada hasil halaman ini"
              placeholder="Ketik untuk menyaring tanpa memuat ulang"
              className="tailadmin-input mt-1 py-2"
            />
          </label>
        </div>

        <p
          className="border-b border-gray-100 px-5 py-3 text-theme-xs text-gray-500 sm:px-6"
          aria-live="polite"
        >
          Menampilkan {visibleInvoices.length} tagihan pada halaman ini
        </p>
        {view === "table" ? (
          <ResponsiveDataView
            rows={visibleInvoices}
            getRowKey={(item) => item.id}
            tableLabel="Daftar tagihan"
            desktopBreakpoint="2xl"
            testId="admin-invoices"
            empty={<EmptyInvoices />}
            rowClassName={(item) => expandedId === item.id ? "bg-limo-blue-50/40" : "hover:bg-gray-25"}
            isExpanded={(item) => expandedId === item.id}
            renderExpandedContent={(item) => <InvoiceDetails item={item} />}
            cardLabel={(item) => `Tagihan ${item.jenis} untuk ${item.siswa.name}`}
            columns={[
              {
                id: "student",
                label: "Siswa",
                render: (item) => <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-limo-blue-50 text-theme-sm font-bold text-limo-blue-600">{item.siswa.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="font-semibold text-gray-800">{item.siswa.name}</p><p className="text-theme-xs text-gray-500">{item.siswa.nomorInduk}</p></div></div>,
              },
              {
                id: "invoice",
                label: "Tagihan",
                render: (item) => <><p className="font-medium text-gray-700">{item.jenis}</p><p className="text-theme-xs text-gray-500">{formatMonth(item.period)}</p></>,
              },
              { id: "dueDate", label: "Jatuh tempo", render: (item) => <span className="text-gray-600">{formatDate(item.dueDate)}</span> },
              { id: "amount", label: "Nominal", render: (item) => <Money value={item.amount} className="font-semibold text-gray-900" /> },
              { id: "status", label: "Status", render: (item) => <StatusBadge status={item.status} compact /> },
              { id: "history", label: "Histori pembayaran", render: (item) => <span className="text-theme-xs text-gray-500">{item.paymentHistoryCount > 0 ? `${item.paymentHistory.length} dari ${item.paymentHistoryCount} transaksi terbaru` : "Belum ada transaksi"}</span> },
              {
                id: "action",
                label: "Aksi",
                render: (item) => <button type="button" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} aria-expanded={expandedId === item.id} className="inline-flex min-h-11 items-center rounded-lg px-2.5 py-2 text-theme-xs font-semibold text-limo-blue-600 hover:bg-limo-blue-50">{expandedId === item.id ? "Tutup detail" : "Lihat detail"}</button>,
              },
            ]}
          />
        ) : (
          <InvoiceCards
            invoices={visibleInvoices}
            expandedId={expandedId}
            onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
          />
        )}
      </section>
    </>
  );
}

function CollectionBreakdown({ summary }: { summary: BillingSummary }) {
  const [mode, setMode] = useState<"amount" | "count">("amount");
  const values = summary.statusBreakdown.map((item) =>
    mode === "amount" ? item.amount : item.count,
  );
  const maxValue = Math.max(...values, 1);

  return (
    <article className="tailadmin-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-theme-xs font-semibold uppercase tracking-[0.16em] text-limo-blue-700">
            Sebaran tagihan
          </p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">
            Distribusi status tagihan
          </h2>
          <p className="mt-1 text-theme-sm text-gray-500">
              Pantau kualitas penagihan dari nilai maupun jumlah tagihan.
          </p>
        </div>
        <div
          className="flex items-center gap-1 rounded-lg bg-gray-50 p-1"
          aria-label="Mode distribusi"
        >
          <button
            type="button"
            onClick={() => setMode("amount")}
            aria-pressed={mode === "amount"}
            className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${mode === "amount" ? "bg-white text-limo-blue-600 shadow-theme-xs" : "text-gray-500"}`}
          >
            Nilai
          </button>
          <button
            type="button"
            onClick={() => setMode("count")}
            aria-pressed={mode === "count"}
            className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${mode === "count" ? "bg-white text-limo-blue-600 shadow-theme-xs" : "text-gray-500"}`}
          >
            Jumlah
          </button>
        </div>
      </div>
      <div className="mt-7 space-y-5">
        {summary.statusBreakdown.map((item) => {
          const value = mode === "amount" ? item.amount : item.count;
          return (
            <div key={item.status}>
              <div className="mb-2 flex items-center justify-between gap-3 text-theme-sm">
                <span className="flex items-center gap-2 font-medium text-gray-700">
                  <span
                    className={`size-2 rounded-full ${getStatusDot(item.status)}`}
                  />
                  {formatUiLabel(item.status)}
                </span>
                <span className="font-semibold text-gray-900">
                  {mode === "amount"
                    ? formatRupiah(item.amount)
                    : `${item.count} tagihan`}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all ${getStatusBar(item.status)}`}
                  style={{ width: `${(value / maxValue) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function InvoiceCards({
  invoices,
  expandedId,
  onToggle,
}: {
  invoices: AdminBillingInvoice[];
  expandedId: string | null;
  onToggle: (_id: string) => void;
}) {
  if (invoices.length === 0) return <EmptyInvoices />;
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
      {invoices.map((item) => (
        <article
          key={item.id}
          className="rounded-xl border border-gray-200 bg-white p-4 transition hover:bg-gray-25 hover:shadow-theme-xs"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-limo-blue-50 text-theme-sm font-bold text-limo-blue-600">
                {item.siswa.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h3
                  className="truncate font-semibold text-gray-800"
                  title={item.siswa.name}
                >
                  {item.siswa.name}
                </h3>
                <p className="text-theme-xs text-gray-500">
                  {item.siswa.nomorInduk}
                </p>
              </div>
            </div>
            <StatusBadge status={item.status} compact />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <MetricStat label="Nominal" value={formatRupiah(item.amount)} />
            <MetricStat label="Jatuh tempo" value={formatDate(item.dueDate)} />
          </div>
          <button
            type="button"
            onClick={() => onToggle(item.id)}
            aria-expanded={expandedId === item.id}
            className="mt-4 flex min-h-11 w-full items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-theme-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            {expandedId === item.id ? "Tutup detail" : "Lihat detail"}
          </button>
          {expandedId === item.id ? (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <InvoiceDetails item={item} />
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function InvoiceDetails({ item }: { item: AdminBillingInvoice }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">
            ID tagihan
          </p>
          <button
            type="button"
            onClick={() => void copyInvoiceId(item.id)}
            className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-limo-blue-600 ring-1 ring-gray-200 hover:bg-limo-blue-50"
          >
            Salin ID
          </button>
        </div>
        <p className="mt-1 break-all font-mono text-theme-xs text-gray-600">
          {item.id}
        </p>
        {item.description ? (
          <p className="mt-2 text-theme-sm text-gray-600">{item.description}</p>
        ) : null}
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">
              Histori Pembayaran
            </p>
            {item.paymentHistoryCount > item.paymentHistory.length ? (
              <span className="text-[10px] text-gray-400">
                {item.paymentHistory.length} terbaru dari{" "}
                {item.paymentHistoryCount}
              </span>
            ) : null}
          </div>
          {item.paymentHistory.length > 0 ? (
            <div className="mt-3 space-y-2">
              {item.paymentHistory.map((payment) => (
                <article
                  key={payment.id}
                  className="rounded-lg bg-gray-50 p-3 text-theme-xs text-gray-600"
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
                  <div className="mt-2 flex flex-wrap justify-between gap-2">
                    <Money value={payment.amount} className="font-semibold text-gray-800" />
                    <span>
                      Dicatat {formatDateTime(payment.createdAt)}
                      {payment.paidAt
                        ? ` / Dibayar ${formatDateTime(payment.paidAt)}`
                        : ""}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-theme-xs text-gray-500">
              Belum ada transaksi gerbang pembayaran.
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-col items-stretch gap-2 lg:min-w-48 lg:items-end">
        <ReconcilePaymentButton
          tagihanId={item.id}
          disabled={
            item.status === "PAID" ||
            item.status === "CANCELLED" ||
            item.status === "REFUNDED"
          }
        />
        {item.paymentUrl ? (
          <a
            href={item.paymentUrl}
            target="_blank"
            rel="noreferrer"
            className="tailadmin-button-outline px-3 py-2 text-theme-xs"
          >
            Buka halaman pembayaran Mayar
          </a>
        ) : null}
      </div>
    </div>
  );
}

function EmptyInvoices() {
  return (
    <div className="px-6 py-14 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-gray-50 text-gray-400">
        <DashboardIcon name="billing" className="size-7" />
      </span>
      <h3 className="mt-4 font-semibold text-gray-900">
        Tidak ada tagihan yang cocok
      </h3>
      <p className="mt-2 text-theme-sm text-gray-500">
        Belum ada transaksi gerbang pembayaran pada hasil ini. Coba ubah kata kunci
        atau filter status untuk melihat transaksi lain.
      </p>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function getFilterHref(search: string, status: string) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  const query = params.toString();
  return `/admin/tagihan${query ? `?${query}` : ""}#invoice-table`;
}

function getStatusDot(status: BillingStatus) {
  return {
    DRAFT: "bg-gray-400",
    UNPAID: "bg-warning-500",
    PENDING: "bg-limo-blue-500",
    PAID: "bg-success-500",
    OVERDUE: "bg-error-500",
    CANCELLED: "bg-gray-400",
    REFUNDED: "bg-gray-400",
  }[status];
}

function getStatusBar(status: BillingStatus) {
  return {
    DRAFT: "bg-gray-400",
    UNPAID: "bg-warning-500",
    PENDING: "bg-limo-blue-500",
    PAID: "bg-success-500",
    OVERDUE: "bg-error-500",
    CANCELLED: "bg-gray-400",
    REFUNDED: "bg-gray-400",
  }[status];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
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

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
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

async function copyInvoiceId(id: string) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(id);
  }
}
