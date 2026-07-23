import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { listMyKelas } from "@/server/services/lms-service";

export const metadata = { title: "Kelas Saya" };

export default async function GuruKelasPage() {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { items } = await listMyKelas(actor);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Kelas Saya</h1>
        <p className="mt-2 tailadmin-muted">Kelas dibatasi berdasarkan penugasan guru.</p>
      </div>
      <section className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <article key={item.id} className="tailadmin-card p-5">
            <p className="text-theme-sm font-semibold text-brand-500">{item.program.name} / {item.level.name}</p>
            <h2 className="mt-1 text-lg font-semibold text-gray-900">{item.name}</h2>
            <p className="mt-2 text-theme-sm text-gray-500">{item._count.enrollments} siswa aktif, {item._count.sessions} sesi, {item._count.materi} materi</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/guru/kelas/${item.id}`} className="tailadmin-button-primary px-4 py-2">Kelola</Link>
              <Link href={`/guru/kelas/${item.id}/ringkasan`} className="tailadmin-button-outline px-4 py-2">Ringkasan</Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
