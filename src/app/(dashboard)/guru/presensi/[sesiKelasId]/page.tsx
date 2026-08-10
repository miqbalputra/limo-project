import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { getSessionRoster } from "@/server/services/attendance-progress-service";
import { PresensiProgresForm } from "@/components/dashboard/attendance-progress-forms";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { FinalizeSessionButton } from "@/components/dashboard/finalize-session-button";
import { formatUiLabel, getUiToneClass } from "@/lib/ui-labels";

export const metadata = { title: "Input Presensi" };

export default async function GuruInputPresensiPage({ params }: { params: Promise<{ sesiKelasId: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { sesiKelasId } = await params;
  const { sesi, students } = await getSessionRoster(actor, sesiKelasId);
  const presensiFilled = students.filter((student) => student.presensi && student.presensi.length > 0).length;
  const progressFilled = students.filter((student) => student.progresBelajar && student.progresBelajar.length > 0).length;
  const presenceStatuses = ["HADIR", "TERLAMBAT", "SAKIT", "IZIN", "ALPA"] as const;

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow={`${sesi.kelas.name} / ${sesi.sessionDate.toISOString().slice(0, 10)}`}
        title={`${sesi.meetingNumber}. ${sesi.topic}`}
         description="Catat kehadiran siswa untuk sesi ini. Perubahan presensi tidak mengubah progres belajar."
         actions={<><Link href="/guru/presensi" className="tailadmin-button-outline px-4 py-2">Kembali</Link>{sesi.status === "DRAFT" ? <><button form="presensi-form" type="submit" className="tailadmin-button-primary gap-2 px-4 py-2"><DashboardIcon name="presensi" className="size-4" />Simpan Presensi</button><FinalizeSessionButton sesiKelasId={sesi.id} /></> : null}</>}
        aside={<div className="grid w-full min-w-0 grid-cols-3 gap-2 rounded-2xl border border-gray-100 bg-white/80 p-3 shadow-theme-xs lg:w-auto lg:min-w-72"><MiniStat label="Siswa" value={students.length} /><MiniStat label="Presensi" value={presensiFilled} /><MiniStat label="Progres" value={progressFilled} /></div>}
      />
      <section aria-label="Ringkasan status presensi" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {presenceStatuses.map((status) => {
          const count = students.filter((student) => student.presensi?.[0]?.status === status).length;
          return <div key={status} className={`rounded-xl px-4 py-3 text-center ${getUiToneClass(status)}`}><p className="text-xl font-semibold">{count}</p><p className="mt-1 text-theme-xs font-semibold">{formatUiLabel(status)}</p></div>;
        })}
      </section>
      <PresensiProgresForm sesiKelasId={sesi.id} students={students} mode="presensi" readOnly={sesi.status !== "DRAFT"} />
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="min-w-0 rounded-2xl bg-gray-50 p-3 text-center"><p className="truncate text-xl font-semibold text-gray-900">{value}</p><p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p></div>;
}
