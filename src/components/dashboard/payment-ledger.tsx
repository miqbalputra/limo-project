import { ResponsiveDataView } from "@/components/dashboard/responsive-data-view";
import { Money } from "@/components/dashboard/money";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { formatUiLabel } from "@/lib/ui-labels";

export type PaymentLedgerItem = {
  id: string;
  provider: string;
  providerReference: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
  paidAt: Date | null;
  createdAt: Date;
  tagihan: {
    id: string;
    jenis: string;
    description: string | null;
    periode: Date;
    status: string;
    siswa: { id: string; name: string; nomorInduk: string };
  };
};

export function PaymentLedger({ items, audience }: { items: PaymentLedgerItem[]; audience: "admin" | "wali" }) {
  if (items.length === 0) {
    return <section className="tailadmin-card px-6 py-14 text-center"><h2 className="font-semibold text-gray-900">Belum ada transaksi</h2><p className="mx-auto mt-2 max-w-md text-theme-sm leading-6 text-gray-500">{audience === "wali" ? "Belum ada transaksi untuk anak pada konteks yang dipilih." : "Belum ada transaksi yang cocok dengan filter ledger."}</p></section>;
  }

  return (
    <section className="tailadmin-card overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-4">
        <p className="text-theme-xs font-semibold uppercase tracking-[0.16em] text-limo-blue-700">Ledger transaksi</p>
        <h2 className="mt-1 font-semibold text-gray-900">Riwayat pembayaran lintas tagihan</h2>
        <p className="mt-1 text-theme-xs text-gray-500">Provider, referensi, metode, nominal, dan status transaksi dicatat per baris.</p>
      </div>
      <ResponsiveDataView
        rows={items}
        getRowKey={(item) => item.id}
        tableLabel="Riwayat pembayaran lintas tagihan"
        desktopBreakpoint="2xl"
        testId="payment-ledger"
        tableClassName="min-w-[940px]"
        columns={[
          {
            id: "invoice",
            label: "Anak / tagihan",
            render: (item) => <><p className="font-semibold text-gray-800">{item.tagihan.siswa.name}</p><p className="mt-1 text-theme-xs text-gray-500">{item.tagihan.siswa.nomorInduk} / {item.tagihan.jenis} / {formatMonth(item.tagihan.periode)}</p><p className="mt-1 break-all font-mono text-[10px] text-gray-400">{item.tagihan.id}</p></>,
          },
          {
            id: "provider",
            label: "Provider / metode",
            render: (item) => <><p className="font-semibold text-gray-700">{item.provider.toUpperCase()}</p><p className="mt-1 text-theme-xs text-gray-500">{formatPaymentMethod(item.paymentMethod, item.provider)}</p></>,
          },
          { id: "reference", label: "Referensi", render: (item) => <span className="break-all font-mono text-theme-xs text-gray-600">{item.providerReference}</span> },
          { id: "amount", label: "Nominal", render: (item) => <Money value={item.amount} className="font-semibold text-gray-900" /> },
          { id: "status", label: "Status", render: (item) => <PaymentStatus status={item.status} provider={item.provider} /> },
          { id: "time", label: "Waktu", render: (item) => <span className="text-theme-xs text-gray-500">Dicatat {formatDateTime(item.createdAt)}{item.paidAt ? <><br />Dibayar {formatDateTime(item.paidAt)}</> : null}</span> },
        ]}
      />
    </section>
  );
}

function PaymentStatus({ status, provider }: { status: string; provider: string }) {
  const helper = provider === "manual" && status === "PAID" ? "Rekonsiliasi manual" : status === "REFUNDED" ? "Refund tercatat" : null;
  return <span className="inline-flex flex-col items-start gap-1"><StatusBadge status={status} compact />{helper ? <span className="text-[10px] font-medium text-gray-500">{helper}</span> : null}</span>;
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
}

function formatMonth(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(value);
}

function formatPaymentMethod(value: string | null, provider: string) {
  if (!value) return provider === "manual" ? formatUiLabel("MANUAL") : "Tidak tercatat";
  return value.replace("va/", "VA ").replace("ewallet/", "").replace("outlet/", "").toUpperCase();
}
