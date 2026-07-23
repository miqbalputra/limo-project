import { requireActor, requireRole } from "@/server/auth/session";
import { listTagihan } from "@/server/services/billing-service";

export const metadata = { title: "Tagihan" };

export default async function WaliTagihanPage() {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { items } = await listTagihan(actor);

  return (
    <main className="space-y-6">
      <div><h1 className="tailadmin-page-title">Tagihan</h1><p className="mt-2 tailadmin-muted">Riwayat tagihan anak yang terhubung ke akun ini.</p></div>
      <section className="space-y-4">
        {items.map((item) => <article key={item.id} className="tailadmin-card p-5"><p className="text-theme-sm font-semibold text-brand-500">{item.siswa.name} / {item.siswa.nomorInduk}</p><h2 className="mt-1 font-semibold text-gray-900">{item.jenis} {item.periode.toISOString().slice(0, 7)}</h2><p className="mt-2 text-theme-sm text-gray-500">Rp {item.amount.toString()} / jatuh tempo {item.dueDate.toISOString().slice(0, 10)} / {item.status}</p></article>)}
      </section>
    </main>
  );
}
