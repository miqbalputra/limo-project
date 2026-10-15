import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { getUpsellOpportunities } from "@/server/services/upsell-service";
import { DashboardHero, EmptyState, SectionHeader } from "@/components/dashboard/dashboard-widgets";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { UpsellOfferButton } from "@/components/dashboard/upsell-offer-button";
import { MetricStat } from "@/components/dashboard/metric-card";
import { ResponsiveDataView } from "@/components/dashboard/responsive-data-view";

export const metadata = { title: "Peluang Lanjutan" };

export default async function AdminUpsellPage() {
  const actor = await requireActor();
  await requirePermission(actor, "admin.upsell.view");
  if (!isFeatureEnabled("upsellEnabled")) {
    notFound();
  }

  const summary = await getUpsellOpportunities(actor);

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Mesin Pendapatan"
        title="Peluang Kenaikan Level"
        description="Sistem mendeteksi siswa yang mendekati menyelesaikan levelnya dari progres modul, nilai ujian, dan kehadiran — lalu membantu Anda menawarkan program berikutnya ke Wali di momen yang tepat."
        actions={<Link href="/admin/radar" className="tailadmin-button-outline gap-2"><DashboardIcon name="progress" className="size-4" />Radar Intelijen</Link>}
        aside={<div className="rounded-2xl bg-gray-900 px-5 py-4 text-left text-white shadow-theme-lg"><p className="text-theme-xs text-white/60">Siswa Siap Naik Level</p><p className="mt-1 text-3xl font-semibold">{summary.eligibleCount}</p><p className="text-theme-xs text-white/70">dari {summary.scannedEnrollments} pendaftaran aktif dianalisis</p></div>}
      />

      <section>
        <SectionHeader title="Siswa Siap Naik Level" description="Diurutkan dari skor kesiapan tertinggi. Tawaran dikirim maksimal satu kali per siswa per kelas per bulan." />
        {summary.opportunities.length > 0 ? (
          <div className="tailadmin-card overflow-hidden">
            <ResponsiveDataView
              rows={summary.opportunities}
              getRowKey={(row) => `${row.siswaId}:${row.kelasId}`}
              tableLabel="Siswa siap kenaikan level"
              desktopBreakpoint="xl"
              testId="admin-upsell-students"
              columns={[
                {
                  id: "student",
                  label: "Siswa",
                  render: (row) => (
                    <>
                      <p className="font-semibold text-gray-900">{row.name}</p>
                      <p className="text-theme-xs text-gray-500">{row.nomorInduk} &middot; {row.program}</p>
                      <p className="text-theme-xs text-gray-500">{row.kelasName}</p>
                    </>
                  ),
                },
                {
                  id: "next",
                  label: "Level Berikutnya",
                  render: (row) =>
                    row.nextLevel ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-limo-blue-50 px-3 py-1 text-theme-xs font-semibold text-limo-blue-700">{row.currentLevel} &rarr; {row.nextLevel}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1 text-theme-xs font-semibold text-success-700">Tahap akhir &middot; sertifikat</span>
                    ),
                },
                {
                  id: "readiness",
                  label: "Kesiapan",
                  render: (row) => (
                    <div className="grid grid-cols-3 gap-2">
                      <MetricStat rounded="xl" truncateLabel label="Modul" value={row.readiness.moduleProgress === null ? "-" : `${Math.round(row.readiness.moduleProgress)}%`} />
                      <MetricStat rounded="xl" truncateLabel label="Nilai" value={row.readiness.averageScore === null ? "-" : String(Math.round(row.readiness.averageScore))} />
                      <MetricStat rounded="xl" truncateLabel label="Hadir" value={row.readiness.attendanceRate === null ? "-" : `${row.readiness.attendanceRate}%`} />
                    </div>
                  ),
                },
                {
                  id: "action",
                  label: "Aksi",
                  render: (row) => (
                    <div className="flex items-center gap-3">
                      <Link href={`/admin/siswa/${row.siswaId}`} className="inline-flex min-h-11 items-center font-semibold text-limo-blue-700 hover:text-limo-blue-800">Detail</Link>
                      <UpsellOfferButton siswaId={row.siswaId} kelasId={row.kelasId} />
                    </div>
                  ),
                },
              ]}
            />
          </div>
        ) : (
          <EmptyState icon="levels" title="Belum ada siswa yang siap" description="Sistem belum menemukan siswa dengan kesiapan penuh (progres modul, nilai, dan kehadiran di atas ambang). Cek kembali setelah periode pembelajaran berjalan." />
        )}
      </section>

    </main>
  );
}
