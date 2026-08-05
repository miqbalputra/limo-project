import Link from "next/link";
import { notFound } from "next/navigation";
import { StudentAccountForm } from "@/components/dashboard/student-account-form";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { getSiswa } from "@/server/services/people-service";

export const metadata = { title: "Akun Siswa" };

export default async function StudentAccountPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isFeatureEnabled("studentPortalEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const { id } = await params;
  const { item } = await getSiswa(actor, id);

  return <main className="mx-auto max-w-2xl space-y-6"><div><Link href={`/admin/siswa/${item.id}`} className="text-theme-sm font-semibold text-brand-500">Kembali ke detail siswa</Link><h1 className="mt-2 tailadmin-page-title">Akun Siswa: {item.name}</h1><p className="mt-1 tailadmin-muted">Kelola akses portal siswa tanpa mengubah data biodata atau enrollment.</p></div><StudentAccountForm studentId={item.id} studentName={item.name} defaultIdentifier={item.nomorInduk} account={item.siswaAccount} /></main>;
}
