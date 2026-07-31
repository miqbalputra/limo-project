import { requireActor, requireRole } from "@/server/auth/session";
import { listMyKelas, listSesiKelas } from "@/server/services/lms-service";
import { GuruSessionOverview } from "@/components/dashboard/guru-session-overview";

export const metadata = { title: "Progres" };

export default async function GuruProgresPage() {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { items: kelas } = await listMyKelas(actor);
  const sesiGroups = await Promise.all(kelas.map(async (item) => ({ kelas: item, sesi: (await listSesiKelas(actor, item.id)).items })));

  return <GuruSessionOverview title="Progres" description="Catat pemahaman, catatan untuk wali, dan catatan internal per sesi. Sesi yang belum lengkap ditampilkan sebagai prioritas." groups={sesiGroups} mode="progres" />;
}
