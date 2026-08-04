import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { getSessionRoster } from "@/server/services/attendance-progress-service";
import { PresensiProgresForm } from "@/components/dashboard/attendance-progress-forms";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { FinalizeSessionButton } from "@/components/dashboard/finalize-session-button";

export const metadata = { title: "Input Progres" };

export default async function GuruInputProgresPage({ params }: { params: Promise<{ sesiKelasId: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { sesiKelasId } = await params;
  const { sesi, students } = await getSessionRoster(actor, sesiKelasId);

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow={`${sesi.kelas.name} / ${sesi.sessionDate.toISOString().slice(0, 10)}`}
        title={`Input Progres: ${sesi.meetingNumber}. ${sesi.topic}`}
         description="Catat pemahaman dan catatan belajar siswa. Perubahan progres tidak mengubah presensi."
         actions={<><Link href="/guru/progres" className="tailadmin-button-outline px-4 py-2">Kembali ke Progres</Link>{sesi.status === "DRAFT" ? <FinalizeSessionButton sesiKelasId={sesi.id} /> : null}</>}
        aside={<div className="rounded-2xl bg-brand-50 px-5 py-4 text-center"><p className="text-3xl font-semibold text-brand-600">{students.length}</p><p className="mt-1 text-theme-xs font-semibold text-brand-600">Siswa aktif</p></div>}
      />
       <PresensiProgresForm sesiKelasId={sesi.id} students={students} mode="progres" readOnly={sesi.status !== "DRAFT"} />
    </main>
  );
}
