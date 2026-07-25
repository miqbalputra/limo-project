import { requireActor, requireRole } from "@/server/auth/session";
import { listTagihan } from "@/server/services/billing-service";

export const metadata = { title: "Tagihan" };

export default async function WaliTagihanPage() {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { items } = await listTagihan(actor);

  return (
    <main className="space-y-6">
      <div><h1 className="tailadmin-page-title">Tagihan</h1><p className="mt-2 tailadmin-muted">Riwayat tagihan anak, status pembayaran, dan link bayar QRIS/Virtual Account Pakasir.</p></div>
      <section className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => (
          <article key={item.id} className="tailadmin-card p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-theme-sm font-semibold text-brand-500">{item.siswa.name} / {item.siswa.nomorInduk}</p>
                <h2 className="mt-1 font-semibold text-gray-900">{item.jenis} {item.periode.toISOString().slice(0, 7)}</h2>
              </div>
              <span className={`w-fit rounded-full px-3 py-1 text-theme-xs font-semibold ${item.status === "PAID" ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700"}`}>{item.status}</span>
            </div>
            <div className="mt-4 grid gap-3 rounded-xl bg-gray-50 p-4 text-theme-sm text-gray-600 sm:grid-cols-2">
              <p><span className="block text-theme-xs text-gray-400">Nominal</span><b className="text-gray-900">Rp {Number(item.amount).toLocaleString("id-ID")}</b></p>
              <p><span className="block text-theme-xs text-gray-400">Jatuh Tempo</span><b className="text-gray-900">{item.dueDate.toISOString().slice(0, 10)}</b></p>
            </div>
            {item.status === "PAID" ? (
              <p className="mt-4 tailadmin-alert-success">Pembayaran diterima pada {item.paidAt?.toISOString().slice(0, 10) ?? "tanggal tercatat"}.</p>
            ) : item.paymentUrl ? (
              <a href={item.paymentUrl} target="_blank" rel="noreferrer" className="mt-4 tailadmin-button-primary w-full justify-center px-4 py-2">
                Bayar QRIS / Virtual Account
              </a>
            ) : (
              <p className="mt-4 tailadmin-alert-warning">Link Pakasir belum dikonfigurasi. Admin tetap dapat melakukan rekonsiliasi manual untuk demo.</p>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
