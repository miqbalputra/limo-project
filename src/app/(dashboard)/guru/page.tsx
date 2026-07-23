import { requireActor, requireRole } from "@/server/auth/session";
import { getActorDashboardContext } from "@/server/dal/actor-dal";

export const metadata = {
  title: "Guru Dashboard",
};

export default async function GuruDashboardPage() {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const context = await getActorDashboardContext(actor);

  return (
    <div>
      <h1 className="tailadmin-page-title">Dashboard Guru</h1>
      <p className="mt-2 tailadmin-muted">Kelas yang tampil dibatasi oleh penugasan guru.</p>
      {context.role === "GURU" ? (
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {context.kelas.length > 0 ? (
            context.kelas.map((kelas) => (
              <article key={kelas.id} className="tailadmin-card p-5">
                <h2 className="font-semibold text-gray-900">{kelas.name}</h2>
                <p className="mt-2 text-theme-sm text-gray-500">{kelas._count.enrollments} siswa aktif</p>
              </article>
            ))
          ) : (
            <p className="tailadmin-card p-5 text-theme-sm text-gray-500">
              Belum ada kelas aktif yang ditugaskan.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
