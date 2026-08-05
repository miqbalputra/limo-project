import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { listStudentClasses } from "@/server/services/student-service";

export const metadata = { title: "Kelas Saya" };

export default async function StudentClassesPage() {
  if (!isFeatureEnabled("studentPortalEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["SISWA"]);
  const { items } = await listStudentClasses(actor);

  return <main className="space-y-6"><DashboardHero eyebrow="Belajar" title="Kelas Saya" description="Pilih kelas aktif untuk melihat materi, sesi pembelajaran, dan evaluasi yang tersedia." />{items.length > 0 ? <section className="grid gap-4 md:grid-cols-2">{items.map((item) => <Link key={item.id} href={`/siswa/kelas/${item.kelas.id}`} className="tailadmin-card block p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-theme-sm"><p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{item.kelas.program.name} / {item.kelas.level.name}</p><h2 className="mt-1 text-lg font-semibold text-gray-900">{item.kelas.name}</h2><p className="mt-2 text-theme-sm text-gray-500">{item.kelas.scheduleNote || "Jadwal belum dicatat"}</p><p className="mt-4 text-theme-xs font-semibold text-brand-600">Buka detail kelas</p></Link>)}</section> : <EmptyState icon="classes" title="Belum ada kelas aktif" description="Anda belum memiliki enrollment aktif. Hubungi Admin jika data kelas belum sesuai." />}</main>;
}
