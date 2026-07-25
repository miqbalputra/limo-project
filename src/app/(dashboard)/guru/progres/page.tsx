import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { listMyKelas, listSesiKelas } from "@/server/services/lms-service";

export const metadata = { title: "Progres" };

export default async function GuruProgresPage() {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { items: kelas } = await listMyKelas(actor);
  const sesiGroups = await Promise.all(kelas.map(async (item) => ({ kelas: item, sesi: (await listSesiKelas(actor, item.id)).items })));

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Progres</h1>
        <p className="mt-2 tailadmin-muted">Pilih sesi kelas untuk input pemahaman, catatan wali, catatan internal, dan presensi.</p>
      </div>
      <section className="grid gap-4 md:grid-cols-2">
        {sesiGroups.flatMap((group) => group.sesi.map((sesi) => (
          <article key={sesi.id} className="tailadmin-card p-5">
            <p className="text-theme-sm font-semibold text-brand-500">{group.kelas.name}</p>
            <h2 className="mt-1 font-semibold text-gray-900">{sesi.meetingNumber}. {sesi.topic}</h2>
            <p className="mt-1 text-theme-sm text-gray-500">{sesi.sessionDate.toISOString().slice(0, 10)}</p>
            <Link href={`/guru/presensi/${sesi.id}`} className="mt-4 tailadmin-button-primary px-4 py-2">Input Progres</Link>
          </article>
        )))}
      </section>
    </main>
  );
}
