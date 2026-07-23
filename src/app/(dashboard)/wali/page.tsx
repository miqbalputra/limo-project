import { requireActor, requireRole } from "@/server/auth/session";
import { getActorDashboardContext } from "@/server/dal/actor-dal";

export const metadata = {
  title: "Wali Dashboard",
};

export default async function WaliDashboardPage() {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const context = await getActorDashboardContext(actor);

  return (
    <div>
      <h1 className="tailadmin-page-title">Dashboard Wali</h1>
      <p className="mt-2 tailadmin-muted">Data anak dibatasi berdasarkan relasi Wali-Siswa.</p>
      {context.role === "WALI" ? (
        <section className="mt-6 space-y-4">
          {context.children.length > 1 ? (
            <label className="block max-w-md text-theme-sm font-medium text-gray-700">
              Pilih Anak
              <select className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none">
                {context.children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name} - {child.nomorInduk}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
          {context.children.length > 0 ? (
            context.children.map((child) => (
              <article key={child.id} className="tailadmin-card p-5">
                <h2 className="font-semibold text-gray-900">{child.name}</h2>
                <p className="mt-2 text-theme-sm text-gray-500">Nomor induk: {child.nomorInduk}</p>
                <p className="mt-1 text-theme-sm text-gray-500">Status: {child.status}</p>
              </article>
            ))
          ) : (
            <p className="tailadmin-card p-5 text-theme-sm text-gray-500">
              Belum ada siswa yang terhubung ke akun wali ini.
            </p>
          )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
