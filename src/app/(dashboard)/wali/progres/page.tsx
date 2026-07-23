import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { getActorDashboardContext } from "@/server/dal/actor-dal";

export const metadata = { title: "Progres Anak" };

export default async function WaliProgresPage() {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const context = await getActorDashboardContext(actor);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Progres Anak</h1>
        <p className="mt-2 tailadmin-muted">Pilih anak untuk melihat ringkasan presensi, progres, dan nilai final.</p>
      </div>
      {context.role === "WALI" ? (
        <section className="grid gap-4 md:grid-cols-2">
          {context.children.map((child) => (
            <article key={child.id} className="tailadmin-card p-5">
              <p className="text-theme-sm font-semibold text-brand-500">{child.nomorInduk}</p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900">{child.name}</h2>
              <Link href={`/wali/progres/${child.id}`} className="mt-4 tailadmin-button-primary px-4 py-2">Lihat Ringkasan</Link>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}
