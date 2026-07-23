import { requireActor, requireRole } from "@/server/auth/session";
import { listPrograms } from "@/server/services/master-data-service";
import { ProgramForm } from "@/components/dashboard/master-data-forms";

export const metadata = { title: "Program" };

export default async function AdminProgramPage() {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const { items } = await listPrograms(actor);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Program</h1>
        <p className="mt-2 tailadmin-muted">Kelola program Bahasa Inggris dan Bahasa Arab.</p>
      </div>
      <ProgramForm />
      <section className="grid gap-4 md:grid-cols-2">
        {items.map((program) => (
          <article key={program.id} className="tailadmin-card p-5">
            <p className="text-theme-sm font-semibold text-brand-500">{program.kind}</p>
            <h2 className="mt-1 text-lg font-semibold text-gray-900">{program.name}</h2>
            <p className="mt-2 text-theme-sm text-gray-500">{program.description || "Belum ada deskripsi."}</p>
            <p className="mt-3 text-theme-sm text-gray-500">{program._count.levels} level, {program._count.kelas} kelas, {program._count.siswa} siswa</p>
          </article>
        ))}
      </section>
    </main>
  );
}
