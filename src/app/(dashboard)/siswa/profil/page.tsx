import { notFound } from "next/navigation";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { getStudentProfile } from "@/server/services/student-service";

export const metadata = { title: "Profil Siswa" };

export default async function StudentProfilePage() {
  if (!isFeatureEnabled("studentPortalEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["SISWA"]);
  const { item } = await getStudentProfile(actor);

  return <main className="space-y-6"><DashboardHero eyebrow="Akun" title="Profil Siswa" description="Informasi profil yang digunakan untuk menghubungkan Anda dengan kelas dan aktivitas belajar." /><section className="tailadmin-card max-w-2xl p-5"><dl className="divide-y divide-gray-100"><ProfileRow label="Nama" value={item.name} /><ProfileRow label="Nomor Induk" value={item.nomorInduk} /><ProfileRow label="Program" value={item.program.name} /><ProfileRow label="Identifier Login" value={item.loginIdentifier} /><ProfileRow label="Email Kontak" value={item.contactEmail || "Tidak diatur"} /><ProfileRow label="Status" value={item.status} /></dl></section></main>;
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 py-3 sm:grid-cols-[180px_1fr] sm:gap-4"><dt className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">{label}</dt><dd className="text-theme-sm font-medium text-gray-800">{value}</dd></div>;
}
