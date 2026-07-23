import { requireActor, requireRole } from "@/server/auth/session";
import { getSessionRoster } from "@/server/services/attendance-progress-service";
import { PresensiProgresForm } from "@/components/dashboard/attendance-progress-forms";

export const metadata = { title: "Input Presensi" };

export default async function GuruInputPresensiPage({ params }: { params: Promise<{ sesiKelasId: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { sesiKelasId } = await params;
  const { sesi, students } = await getSessionRoster(actor, sesiKelasId);

  return (
    <main className="space-y-6">
      <div>
        <p className="text-theme-sm font-semibold text-brand-500">{sesi.kelas.name}</p>
        <h1 className="mt-1 tailadmin-page-title">{sesi.meetingNumber}. {sesi.topic}</h1>
        <p className="mt-2 tailadmin-muted">{sesi.sessionDate.toISOString().slice(0, 10)}</p>
      </div>
      <PresensiProgresForm sesiKelasId={sesi.id} students={students} />
    </main>
  );
}
