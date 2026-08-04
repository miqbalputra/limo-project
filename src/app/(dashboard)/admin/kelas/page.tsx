import { requireActor, requireRole } from "@/server/auth/session";
import { listGuruOptions, listKelas, listLevels, listPrograms } from "@/server/services/master-data-service";
import { KelasForm } from "@/components/dashboard/master-data-forms";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { MasterDataActions } from "@/components/dashboard/master-data-actions";

export const metadata = { title: "Kelas" };

export default async function AdminKelasPage() {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const [{ items: kelas }, { items: programs }, { items: levels }, { items: gurus }] = await Promise.all([
    listKelas(actor),
    listPrograms(actor),
    listLevels(actor),
    listGuruOptions(actor),
  ]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Kelas</h1>
        <p className="mt-2 tailadmin-muted">Kelola kelas dan guru pengampu.</p>
      </div>
      <KelasForm
        programs={programs.map((program) => ({ id: program.id, name: program.name }))}
        levels={levels.map((level) => ({ id: level.id, name: `${level.program.name} - ${level.name}`, programId: level.program.id }))}
        gurus={gurus}
      />
      {kelas.length > 0 ? <section className="grid gap-4 md:grid-cols-2">
        {kelas.map((item) => (
          <article key={item.id} className="tailadmin-card p-5">
            <p className="text-theme-sm font-semibold text-brand-500">{item.program.name} / {item.level.name}</p>
            <h2 className="mt-1 text-lg font-semibold text-gray-900">{item.name}</h2>
            <p className="mt-2 text-theme-sm text-gray-500">Guru: {item.guruProfile?.user.name || "Belum ditentukan"}</p>
            <p className="mt-1 text-theme-sm text-gray-500">{item._count.enrollments} siswa aktif</p>
            <p className="mt-1 text-theme-sm text-gray-500">{item.scheduleNote || "Belum ada catatan jadwal"}</p>
            <MasterDataActions resource="kelas" id={item.id} name={item.name} scheduleNote={item.scheduleNote || ""} guruProfileId={item.guruProfile?.id || ""} guruOptions={gurus} archived={item.status !== "ACTIVE"} />
          </article>
        ))}
      </section> : <EmptyState icon="classes" title="Belum ada kelas" description="Buat kelas dan tentukan guru pengampu menggunakan formulir di atas." />}
    </main>
  );
}
