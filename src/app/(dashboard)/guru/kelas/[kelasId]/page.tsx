import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { getClassSummary } from "@/server/services/report-service";
import { GuruRoster } from "@/components/dashboard/guru-roster";
import { isFeatureEnabled } from "@/server/features/feature-flags";

export const metadata = { title: "Kelola Kelas" };

export default async function GuruKelasDetailPage({ params }: { params: Promise<{ kelasId: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { kelasId } = await params;
  const summary = await getClassSummary(actor, kelasId);

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="tailadmin-page-title">Kelola Kelas</h1>
          <p className="mt-2 tailadmin-muted">Tinjau roster dan akses workspace terpisah untuk sesi serta materi. Data hanya tersedia untuk kelas aktif yang ditugaskan kepada Anda.</p>
        </div>
        <div className="flex flex-wrap gap-2"><Link href={`/guru/sesi?kelasId=${kelasId}`} className="tailadmin-button-primary w-fit px-4 py-2">Kelola Sesi</Link><Link href={`/guru/materi?kelasId=${kelasId}`} className="tailadmin-button-outline w-fit px-4 py-2">Kelola Materi</Link><Link href={`/guru/kelas/${kelasId}/modul`} className="tailadmin-button-outline w-fit px-4 py-2">Susun Modul</Link><Link href={`/guru/kelas/${kelasId}/progres`} className="tailadmin-button-outline w-fit px-4 py-2">Progres Aktivitas</Link>{isFeatureEnabled("assignmentsEnabled") ? <Link href={`/guru/kelas/${kelasId}/tugas`} className="tailadmin-button-outline w-fit px-4 py-2">Kelola Tugas</Link> : null}{isFeatureEnabled("remedialEnabled") && isFeatureEnabled("assignmentsEnabled") ? <Link href={`/guru/kelas/${kelasId}/remedial`} className="tailadmin-button-outline w-fit px-4 py-2">Remedial</Link> : null}{isFeatureEnabled("gradebookEnabled") ? <Link href={`/guru/kelas/${kelasId}/gradebook`} className="tailadmin-button-outline w-fit px-4 py-2">Buka Buku Nilai</Link> : null}</div>
      </div>
      <GuruRoster kelasId={kelasId} rows={summary.rows} />
    </main>
  );
}
