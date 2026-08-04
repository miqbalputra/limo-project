import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { getSessionRoster } from "@/server/services/attendance-progress-service";
import { PresensiProgresForm } from "@/components/dashboard/attendance-progress-forms";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { FinalizeSessionButton } from "@/components/dashboard/finalize-session-button";

export const metadata = { title: "Input Presensi" };

export default async function GuruInputPresensiPage({ params }: { params: Promise<{ sesiKelasId: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { sesiKelasId } = await params;
  const { sesi, students } = await getSessionRoster(actor, sesiKelasId);
  const presensiFilled = students.filter((student) => student.presensi && student.presensi.length > 0).length;
  const progressFilled = students.filter((student) => student.progresBelajar && student.progresBelajar.length > 0).length;

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow={`${sesi.kelas.name} / ${sesi.sessionDate.toISOString().slice(0, 10)}`}
        title={`${sesi.meetingNumber}. ${sesi.topic}`}
         description="Catat kehadiran siswa untuk sesi ini. Perubahan presensi tidak mengubah progres belajar."
         actions={<><Link href="/guru/presensi" className="tailadmin-button-outline px-4 py-2">Kembali</Link>{sesi.status === "DRAFT" ? <><button form="presensi-form" type="submit" className="tailadmin-button-primary gap-2 px-4 py-2"><DashboardIcon name="presensi" className="size-4" />Simpan Presensi</button><FinalizeSessionButton sesiKelasId={sesi.id} /></> : null}</>}
        aside={<div className="grid min-w-72 grid-cols-3 gap-2 rounded-2xl border border-gray-100 bg-white/80 p-3 shadow-theme-xs"><MiniStat label="Siswa" value={students.length} /><MiniStat label="Presensi" value={presensiFilled} /><MiniStat label="Progres" value={progressFilled} /></div>}
      />
       <PresensiProgresForm sesiKelasId={sesi.id} students={students} mode="presensi" readOnly={sesi.status !== "DRAFT"} />
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="min-w-0 rounded-2xl bg-gray-50 p-3 text-center"><p className="truncate text-xl font-semibold text-gray-900">{value}</p><p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p></div>;
}
