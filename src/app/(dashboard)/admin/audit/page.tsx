import { requireActor, requireRole } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

export const metadata = { title: "Audit Log" };

export default async function AdminAuditPage() {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);

  const items = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      reason: true,
      metadata: true,
      ipAddress: true,
      createdAt: true,
      actor: { select: { name: true, email: true, role: true } },
    },
  });

  return (
    <main className="space-y-6">
      <div>
        <p className="text-theme-sm font-medium text-gray-500">Administrasi Sistem</p>
        <h1 className="mt-1 tailadmin-page-title">Audit Log</h1>
        <p className="mt-2 tailadmin-muted">Riwayat 100 aktivitas terbaru untuk approval, auth, data siswa, LMS, ujian, presensi, dan pembayaran.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Total Ditampilkan" value={String(items.length)} />
        <Metric label="Auth" value={String(items.filter((item) => item.action.includes("LOGIN") || item.action.includes("PASSWORD") || item.action.includes("USER")).length)} />
        <Metric label="Akademik" value={String(items.filter((item) => ["Materi", "BankSoal", "Ujian", "HasilUjian", "SesiKelas"].includes(item.entityType)).length)} />
        <Metric label="Operasional" value={String(items.filter((item) => ["Siswa", "Pendaftaran", "Tagihan", "Pembayaran"].includes(item.entityType)).length)} />
      </section>

      <section className="tailadmin-card overflow-hidden">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Aktivitas Terbaru</h2>
          <p className="mt-1 text-theme-xs text-gray-500">Diurutkan dari aktivitas paling baru.</p>
        </div>
        <div className="hidden grid-cols-[170px_1fr_1fr_130px] gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-theme-xs font-semibold uppercase tracking-wide text-gray-500 lg:grid">
          <span>Waktu</span>
          <span>Aksi</span>
          <span>Actor</span>
          <span>Entitas</span>
        </div>
        <div className="divide-y divide-gray-100">
          {items.map((item) => (
            <article key={item.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[170px_1fr_1fr_130px] lg:items-start lg:gap-4">
              <div>
                <p className="text-theme-sm font-semibold text-gray-900">{formatDate(item.createdAt)}</p>
                <p className="text-theme-xs text-gray-500">{item.ipAddress || "IP tidak tercatat"}</p>
              </div>
              <div>
                <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-theme-xs font-semibold text-brand-600">{item.action}</span>
                {item.reason ? <p className="mt-2 text-theme-sm text-gray-600">{item.reason}</p> : null}
                {formatMetadata(item.metadata) ? <p className="mt-2 break-all rounded-lg bg-gray-50 p-2 text-theme-xs text-gray-500">{formatMetadata(item.metadata)}</p> : null}
              </div>
              <div>
                <p className="text-theme-sm font-semibold text-gray-900">{item.actor?.name ?? "System"}</p>
                <p className="text-theme-xs text-gray-500">{item.actor?.email ?? "system"}{item.actor ? ` / ${item.actor.role}` : ""}</p>
              </div>
              <div>
                <p className="text-theme-sm font-semibold text-gray-900">{item.entityType}</p>
                <p className="break-all text-theme-xs text-gray-500">{item.entityId ?? "-"}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="tailadmin-card p-5">
      <p className="text-theme-sm text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
    </article>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function formatMetadata(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return JSON.stringify(value);
}
