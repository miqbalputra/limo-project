import { requireActor, requireRole } from "@/server/auth/session";
import { listPendaftaran } from "@/server/services/pendaftaran-service";
import { PendaftaranActions } from "@/components/dashboard/pendaftaran-actions";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";

export const metadata = {
  title: "Pendaftaran Admin",
};

export default async function AdminPendaftaranPage() {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const { items } = await listPendaftaran(actor);
  const submitted = items.filter((item) => item.status === "SUBMITTED").length;
  const underReview = items.filter((item) => item.status === "UNDER_REVIEW").length;
  const approved = items.filter((item) => item.status === "APPROVED").length;
  const rejected = items.filter((item) => item.status === "REJECTED").length;

  function statusClass(status: string) {
    if (status === "APPROVED") return "bg-success-50 text-success-700";
    if (status === "REJECTED" || status === "CANCELLED") return "bg-error-50 text-error-700";
    if (status === "UNDER_REVIEW") return "bg-warning-50 text-warning-700";
    return "bg-brand-50 text-brand-600";
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-theme-sm font-medium text-gray-500">Operasional</p><h1 className="mt-1 text-2xl font-semibold text-gray-900">Review Pendaftaran</h1><p className="mt-2 tailadmin-muted">Tinjau data, dokumen privat, dan keputusan penerimaan calon siswa.</p></div>
        <span className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-theme-sm font-medium text-gray-600 shadow-theme-xs">{items.length} data terbaru</span>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Baru Masuk", submitted, "bg-brand-50 text-brand-600"],
          ["Dalam Review", underReview, "bg-warning-50 text-warning-700"],
          ["Disetujui", approved, "bg-success-50 text-success-700"],
          ["Ditolak", rejected, "bg-error-50 text-error-700"],
        ].map(([label, value, tone]) => (
          <article key={String(label)} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs">
            <div className="flex items-center gap-3"><span className={`grid size-10 place-items-center rounded-xl ${tone}`}><DashboardIcon name="registration" className="size-5" /></span><div><p className="text-2xl font-semibold text-gray-900">{value}</p><p className="text-theme-xs text-gray-500">{label}</p></div></div>
          </article>
        ))}
      </section>

      <section className="tailadmin-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4"><div><h2 className="font-semibold text-gray-900">Daftar Pendaftaran</h2><p className="mt-1 text-theme-xs text-gray-500">Maksimal 50 data terbaru</p></div></div>
        <div className="hidden grid-cols-[1.2fr_1fr_130px_170px] gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-theme-xs font-semibold uppercase tracking-wide text-gray-500 md:grid">
          <span>Calon Siswa</span>
          <span>Wali</span>
          <span>Status</span>
          <span>Aksi</span>
        </div>
        {items.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {items.map((item) => {
              const actionDisabled = !["SUBMITTED", "UNDER_REVIEW"].includes(item.status);

              return (
                 <article key={item.id} className="grid gap-4 px-5 py-4 md:grid-cols-[1.2fr_1fr_130px_170px] md:items-center">
                  <div>
                    <p className="font-semibold text-gray-900">{item.studentName}</p>
                    <p className="mt-1 text-theme-xs text-gray-500">{item.kode} / {item.program.name}</p>
                    {item.files.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {item.files.map((file) => (
                          <a
                            key={file.id}
                            href={`/api/v1/files/${file.id}`}
                            className="block text-theme-sm font-semibold text-brand-500 hover:text-brand-600"
                          >
                            {file.originalName}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{item.waliName}</p>
                    <p className="mt-1 text-theme-sm text-gray-500">{item.waliEmail}</p>
                  </div>
                  <div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-theme-xs font-semibold ${statusClass(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                  <PendaftaranActions id={item.id} disabled={actionDisabled} />
                </article>
              );
            })}
          </div>
        ) : (
          <p className="px-5 py-8 text-theme-sm text-gray-500">Belum ada pendaftaran masuk.</p>
        )}
      </section>
    </main>
  );
}
