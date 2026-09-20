import { requireActor, requireRole } from "@/server/auth/session";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { NotificationRetryButton } from "@/components/dashboard/notification-retry-button";
import { getNotificationLogSummary, listNotificationLog, parseNotificationChannel, parseNotificationStatus } from "@/server/services/notification-log-service";

export const metadata = { title: "Log Notifikasi" };

const statusLabels: Record<string, string> = {
  PENDING: "Menunggu",
  PROCESSING: "Diproses",
  SENT: "Terkirim",
  FAILED: "Gagal",
  CANCELLED: "Dibatalkan",
};

const statusStyles: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  PROCESSING: "bg-warning-50 text-warning-700",
  SENT: "bg-success-50 text-success-700",
  FAILED: "bg-error-50 text-error-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const channelLabels: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  in_app: "In-app",
};

export default async function AdminNotifikasiPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const page = Number(first("page")) || 1;
  const status = parseNotificationStatus(first("status"));
  const channel = parseNotificationChannel(first("channel"));
  const search = (first("search") || "").trim();
  const filters = { status, channel, search: search || undefined };

  const [{ items, pagination }, summary] = await Promise.all([
    listNotificationLog(actor, { page, pageSize: 25 }, filters),
    getNotificationLogSummary(actor),
  ]);

  return (
    <main className="space-y-6">
      <div>
        <p className="text-theme-sm font-medium text-gray-500">Administrasi Sistem</p>
        <h1 className="mt-1 tailadmin-page-title">Log Notifikasi</h1>
        <p className="mt-2 tailadmin-muted">Rekam jejak pengiriman email, WhatsApp, dan notifikasi in-app: status, jumlah percobaan, respons provider, dan pesan error.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Menunggu" value={summary.pending} tone="text-gray-900" />
        <Metric label="Diproses" value={summary.processing} tone="text-warning-700" />
        <Metric label="Terkirim" value={summary.sent} tone="text-success-700" />
        <Metric label="Gagal" value={summary.failed} tone="text-error-700" />
      </section>

      <form method="get" className="tailadmin-card grid gap-3 p-4 md:grid-cols-[1fr_180px_180px_auto]">
        <input name="search" defaultValue={search} aria-label="Cari notifikasi" placeholder="Cari penerima, template, subjek, isi" className="tailadmin-input" />
        <select name="status" defaultValue={status || ""} aria-label="Filter status notifikasi" className="tailadmin-input">
          <option value="">Semua status</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select name="channel" defaultValue={channel || ""} aria-label="Filter kanal notifikasi" className="tailadmin-input">
          <option value="">Semua kanal</option>
          {Object.entries(channelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button className="tailadmin-button-primary">Terapkan</button>
      </form>

      <section className="tailadmin-card overflow-hidden">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Riwayat Pengiriman</h2>
          <p className="mt-1 text-theme-xs text-gray-500">Menampilkan {pagination.totalItems} notifikasi, diurutkan dari yang terbaru.</p>
        </div>
        {items.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {items.map((item) => {
              const lastDelivery = item.deliveries[0] ?? null;
              const canRetry = item.status === "FAILED" || item.status === "PENDING";
              return (
                <article key={item.id} className="grid gap-3 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusStyles[item.status] ?? "bg-gray-100 text-gray-600"}`}>{statusLabels[item.status] ?? item.status}</span>
                        <span className="rounded-full bg-limo-blue-50 px-2.5 py-1 text-[10px] font-bold text-limo-blue-700">{channelLabels[item.channel] ?? item.channel}</span>
                        <span className="text-theme-xs font-semibold text-gray-700">{item.template}</span>
                      </div>
                      <p className="mt-1 break-all text-theme-sm font-semibold text-gray-900">{item.subject || "(tanpa subjek)"}</p>
                      <p className="break-all text-theme-xs text-gray-500">Ke: {item.recipient}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2 text-right">
                      <p className="text-theme-xs text-gray-500">{formatDate(item.createdAt)}</p>
                      <p className="text-theme-xs text-gray-400">{item._count.deliveries} percobaan</p>
                      {canRetry ? <NotificationRetryButton id={item.id} /> : null}
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-2 text-theme-xs text-gray-600">{truncate(item.body, 240)}</p>
                  {lastDelivery ? (
                    <p className="text-theme-xs text-gray-500">
                      Terakhir: {lastDelivery.provider} / {lastDelivery.status} / attempt {lastDelivery.attempt}
                      {lastDelivery.sentAt ? ` / ${formatDate(lastDelivery.sentAt)}` : ""}
                      {lastDelivery.errorMessage ? ` — ${lastDelivery.errorMessage}` : ""}
                    </p>
                  ) : (
                    <p className="text-theme-xs text-gray-400">Belum ada percobaan pengiriman.</p>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="bell" title="Belum ada notifikasi" description="Rekam jejak notifikasi email/WhatsApp/in-app akan muncul di sini." />
        )}
      </section>

      <PaginationControls basePath="/admin/notifikasi" page={pagination.page} totalPages={pagination.totalPages} params={{ search: search || undefined, status, channel }} />
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <article className="tailadmin-card p-5">
      <p className="text-theme-sm text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</p>
    </article>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}
