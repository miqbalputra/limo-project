import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { listWaliStudentTasks } from "@/server/services/online-exam-service";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { withWaliChildContext } from "@/lib/wali-selector";
import { formatUiLabel, getUiToneClass } from "@/lib/ui-labels";

export const metadata = { title: "Daftar Tugas Anak" };

export default async function WaliStudentTasksPage({ params }: { params: Promise<{ siswaId: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { siswaId } = await params;
  const { siswa, tasks } = await listWaliStudentTasks(actor, siswaId);

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow={`${siswa.nomorInduk} / ${siswa.program.name}`}
        title={`Tugas ${siswa.name}`}
        description="Daftar tugas dan ujian daring yang tersedia untuk anak. Buka instruksi sebelum mulai mengerjakan."
        actions={<Link href={withWaliChildContext("/wali/tugas", siswaId)} className="tailadmin-button-outline px-4 py-2">Pilih Anak Lain</Link>}
        aside={<div className="grid size-20 place-items-center rounded-3xl bg-limo-blue-50 text-3xl font-semibold text-limo-blue-700 shadow-theme-xs">{siswa.name.slice(0, 1).toUpperCase()}</div>}
      />

      {tasks.length > 0 ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {tasks.map((task) => {
            const canResume = task.latestAttempt?.status === "IN_PROGRESS" && (!task.latestAttempt.expiresAt || task.latestAttempt.expiresAt > new Date());
            const actionHref = canResume ? `/wali/tugas/attempt/${task.latestAttempt.id}` : `/wali/tugas/${siswa.id}/ujian/${task.id}`;

            return (
              <article key={task.id} className="tailadmin-card min-w-0 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-700">{task.kelas.program.name} / {task.kelas.name}</p>
                    <h2 className="mt-1 truncate text-lg font-semibold text-gray-900" title={task.title}>{task.title}</h2>
                    <p className="mt-2 text-theme-sm text-gray-500">{task._count.questions} soal / {task.durationMinutes} menit{task.availableUntil ? ` / sampai ${task.availableUntil.toISOString().slice(0, 10)}` : ""}</p>
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1 text-theme-xs font-semibold ${getUiToneClass(task.status)}`}>{formatUiLabel(task.status, "Belum dimulai")}</span>
                </div>
                <p className="mt-4 line-clamp-2 rounded-2xl bg-gray-50 p-3 text-theme-sm leading-6 text-gray-500">{task.description || "Tidak ada deskripsi tambahan."}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={actionHref} className="tailadmin-button-primary px-4 py-2">{canResume ? "Lanjutkan" : task.status === "FINAL" ? "Lihat status" : "Buka instruksi"}</Link>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState icon="exam" title="Belum ada tugas daring" description="Tugas akan tampil setelah Guru menerbitkan ujian dalam mode daring melalui akun Wali." />
      )}
    </main>
  );
}
