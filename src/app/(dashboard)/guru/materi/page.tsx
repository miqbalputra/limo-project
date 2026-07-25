import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { listMyKelas } from "@/server/services/lms-service";

export const metadata = { title: "Materi Pembelajaran" };

export default async function GuruMateriPage() {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { items: kelas } = await listMyKelas(actor);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Materi Pembelajaran</h1>
        <p className="mt-2 tailadmin-muted">Kelola materi PDF, gambar, teks, dan video berdasarkan program, level, kelas, dan pertemuan.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kelas.map((item) => (
          <article key={item.id} className="tailadmin-card p-5">
            <p className="text-theme-sm font-semibold text-brand-500">{item.program.name} / {item.level.name}</p>
            <h2 className="mt-1 text-lg font-semibold text-gray-900">{item.name}</h2>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-theme-xs text-gray-500">
              <span className="rounded-xl bg-gray-50 p-2"><b className="block text-theme-lg text-gray-900">{item._count.sessions}</b>Sesi</span>
              <span className="rounded-xl bg-gray-50 p-2"><b className="block text-theme-lg text-gray-900">{item._count.materi}</b>Materi</span>
              <span className="rounded-xl bg-gray-50 p-2"><b className="block text-theme-lg text-gray-900">{item._count.enrollments}</b>Siswa</span>
            </div>
            <Link href={`/guru/kelas/${item.id}`} className="mt-4 tailadmin-button-primary w-full justify-center px-4 py-2">
              Kelola Materi
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
