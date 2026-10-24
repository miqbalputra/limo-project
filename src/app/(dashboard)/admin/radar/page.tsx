import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { getRadarIntel, type RadarRiskLevel } from "@/server/services/radar-intelijen-service";
import { DashboardHero, EmptyState, MetricCard, ProgressBar, SectionHeader } from "@/components/dashboard/dashboard-widgets";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { RadarInterventionButton } from "@/components/dashboard/radar-intervention-button";
import { MetricStat } from "@/components/dashboard/metric-card";
import { Money } from "@/components/dashboard/money";
import { ResponsiveDataView } from "@/components/dashboard/responsive-data-view";
import { formatRupiah } from "@/lib/money";

export const metadata = { title: "Radar Intelijen" };

const LEVEL_STYLES: Record<RadarRiskLevel, { badge: string; label: string }> = {
  AMAN: { badge: "bg-success-50 text-success-700", label: "Aman" },
  WASPADA: { badge: "bg-warning-50 text-warning-700", label: "Waspada" },
  RISIKO: { badge: "bg-error-50 text-error-700", label: "Risiko" },
  KRITIS: { badge: "bg-error-500 text-white", label: "Kritis" },
};

const FACTOR_LABELS: Record<string, string> = {
  PRESENSI: "Kehadiran rendah",
  TREN_PRESENSI: "Kehadiran menurun",
  NILAI: "Nilai di bawah standar",
  TREN_NILAI: "Nilai menurun",
  PROGRES: "Progres stagnan",
  TAGIHAN: "Tunggakan tagihan",
};

export default async function AdminRadarPage() {
  const actor = await requireActor();
  await requirePermission(actor, "admin.radar.view");
  if (!isFeatureEnabled("radarIntelEnabled")) {
    notFound();
  }

  const intel = await getRadarIntel(actor);
  const atRiskRows = intel.students.filter((row) => row.level !== "AMAN").slice(0, 20);
  const maxFactorCount = Math.max(1, ...Object.values(intel.factorCounts));

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Pusat Intelijen Lembaga"
        title="Radar Intelijen"
        description="Deteksi dini siswa yang berisiko berhenti belajar dari pola kehadiran, nilai, progres, dan tagihan — lalu lakukan intervensi sebelum terlambat."
        actions={<Link href="/admin/laporan" className="tailadmin-button-outline gap-2"><DashboardIcon name="audit" className="size-4" />Laporan Operasional</Link>}
        aside={<div className="rounded-2xl bg-gray-900 px-5 py-4 text-left text-white shadow-theme-lg"><p className="text-theme-xs text-white/60">Skor Kesehatan Retensi</p><p className="mt-1 text-3xl font-semibold">{intel.retentionHealth === null ? "-" : intel.retentionHealth}</p><p className="text-theme-xs text-white/70">dari 100 &middot; {intel.totalStudents} siswa aktif dianalisis</p></div>}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Siswa Berisiko" value={intel.counts.RISIKO + intel.counts.KRITIS} description={`${intel.counts.KRITIS} kritis &middot; ${intel.counts.RISIKO} risiko`} icon="student" tone="error" />
        <MetricCard label="Perlu Waspada" value={intel.counts.WASPADA} description="Siswa dengan indikasi awal" icon="progress" tone="warning" />
        <MetricCard label="Pendapatan Berisiko" value={formatRupiah(intel.revenueAtRiskAmount)} description="Tunggakan siswa berisiko/kritis" icon="billing" tone="error" />
        <MetricCard label="Total Tunggakan" value={formatRupiah(intel.overdueTotalAmount)} description="Semua tagihan jatuh tempo" icon="billing" tone="warning" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="tailadmin-card p-5">
          <SectionHeader title="Faktor Risiko Terbanyak" description="Sebaran indikator pada seluruh siswa dalam 60 hari terakhir." />
          <div className="space-y-3">
            {(Object.keys(intel.factorCounts) as Array<keyof typeof intel.factorCounts>).map((factor) => (
              <div key={factor} className="space-y-1.5">
                <div className="flex items-center justify-between text-theme-sm"><span className="font-medium text-gray-700">{FACTOR_LABELS[factor] ?? factor}</span><span className="font-semibold text-gray-900">{intel.factorCounts[factor]} siswa</span></div>
                <ProgressBar value={intel.factorCounts[factor]} max={maxFactorCount} tone={intel.factorCounts[factor] === 0 ? "success" : "warning"} />
              </div>
            ))}
          </div>
        </div>
        <div className="tailadmin-card p-5">
          <SectionHeader title="Hotspot Kelas" description="Kelas dengan siswa berisiko terbanyak — fokuskan pendampingan di sini." />
          {intel.hotspots.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {intel.hotspots.map((hotspot) => (
                <article key={hotspot.kelasName} className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-700">{hotspot.program}</p>
                  <h3 className="mt-1 truncate font-semibold text-gray-900" title={hotspot.kelasName}>{hotspot.kelasName}</h3>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <MetricStat align="start" rounded="xl" label="Siswa berisiko" value={String(hotspot.atRiskCount)} />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState icon="classes" title="Tidak ada hotspot" description="Tidak ditemukan kelas dengan konsentrasi siswa berisiko." />
          )}
        </div>
      </section>

      <section>
        <SectionHeader title="Siswa Prioritas Intervensi" description="20 siswa dengan skor risiko tertinggi. Kirim notifikasi pendampingan ke Wali dalam satu klik." />
        {atRiskRows.length > 0 ? (
          <div className="tailadmin-card overflow-hidden">
            <ResponsiveDataView
              rows={atRiskRows}
              getRowKey={(row) => row.siswaId}
              tableLabel="Siswa prioritas intervensi"
              desktopBreakpoint="xl"
              testId="admin-radar-students"
              columns={[
                {
                  id: "student",
                  label: "Siswa",
                  render: (row) => (
                    <>
                      <p className="font-semibold text-gray-900">{row.name}</p>
                      <p className="text-theme-xs text-gray-500">{row.nomorInduk} &middot; {row.program}</p>
                      <p className="text-theme-xs text-gray-500">{row.kelasNames.join(", ") || "Belum terdaftar kelas"}</p>
                    </>
                  ),
                },
                {
                  id: "level",
                  label: "Level Risiko",
                  render: (row) => (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-theme-xs font-semibold ${LEVEL_STYLES[row.level].badge}`}>
                      {LEVEL_STYLES[row.level].label} &middot; {row.score}
                    </span>
                  ),
                },
                {
                  id: "attendance",
                  label: "Kehadiran",
                  render: (row) => <span className={row.attendanceRate !== null && row.attendanceRate < 75 ? "font-semibold text-error-700" : "text-gray-700"}>{row.attendanceRate === null ? "-" : `${row.attendanceRate}%`}</span>,
                },
                { id: "score", label: "Nilai", render: (row) => <span className="text-gray-700">{row.averageScore === null ? "-" : row.averageScore}</span> },
                { id: "progress", label: "Progres", render: (row) => <span className="text-gray-700">{row.daysSinceProgress === null ? "Belum ada" : `${row.daysSinceProgress} hari lalu`}</span> },
                { id: "overdue", label: "Tunggakan", render: (row) => row.overdueAmount > 0 ? <Money value={row.overdueAmount} className="font-semibold text-error-700" /> : "-" },
                {
                  id: "factors",
                  label: "Faktor",
                  render: (row) => <span className="text-theme-xs text-gray-600">{row.factors.map((factor) => FACTOR_LABELS[factor] ?? factor).join(", ")}</span>,
                },
                {
                  id: "action",
                  label: "Aksi",
                  render: (row) => (
                    <div className="flex items-center gap-3">
                      <Link href={`/admin/siswa/${row.siswaId}`} className="inline-flex min-h-11 items-center font-semibold text-limo-blue-700 hover:text-limo-blue-800">Detail</Link>
                      <RadarInterventionButton siswaId={row.siswaId} />
                    </div>
                  ),
                },
              ]}
            />
          </div>
        ) : (
          <EmptyState icon="student" title="Semua siswa aman" description="Tidak ada siswa berisiko dalam 60 hari terakhir. Pertahankan kualitas pembelajaran dan komunikasi dengan Wali." />
        )}
      </section>

    </main>
  );
}
