import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { listMyKelas, listSesiKelas } from "@/server/services/lms-service";
import { GuruSessionOverview } from "@/components/dashboard/guru-session-overview";

export const metadata = { title: "Presensi" };

export default async function GuruPresensiPage() {
  const actor = await requireActor();
  await requirePermission(actor, "guru.session.manage");
  const { items: kelas } = await listMyKelas(actor);
  const sesiGroups = await Promise.all(kelas.map(async (item) => ({ kelas: item, sesi: (await listSesiKelas(actor, item.id)).items })));

  return <GuruSessionOverview title="Presensi" description="Pilih sesi yang belum lengkap, input kehadiran siswa, dan pastikan data wali selalu aktual." groups={sesiGroups} mode="presensi" />;
}
