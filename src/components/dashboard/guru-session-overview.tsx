import Link from "next/link";
import { DashboardHero, EmptyState, ProgressBar } from "@/components/dashboard/dashboard-widgets";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";

type KelasSessionGroup = {
  kelas: {
    id: string;
    name: string;
    program: { name: string };
    level: { name: string };
    _count: { enrollments: number; sessions: number; materi: number };
  };
  sesi: {
    id: string;
    meetingNumber: number;
    topic: string;
    sessionDate: Date;
    status: string;
    _count: { presensi: number; progresBelajar: number; materi: number };
  }[];
};

type Mode = "presensi" | "progres";

export function GuruSessionOverview({
  title,
  description,
  groups,
  mode,
}: {
  title: string;
  description: string;
  groups: KelasSessionGroup[];
  mode: Mode;
}) {
  const sessions = groups.flatMap((group) => group.sesi.map((sesi) => ({ sesi, kelas: group.kelas })));
  const rows = sessions.map((item) => {
    const expected = item.kelas._count.enrollments;
    const filled = mode === "presensi" ? item.sesi._count.presensi : item.sesi._count.progresBelajar;
    const percent = expected > 0 ? Math.min(100, Math.round((filled / expected) * 100)) : 0;
    const status = getSessionStatus(filled, expected);

    return { ...item, expected, filled, percent, status };
  });
  const pendingRows = rows.filter((row) => row.status.kind !== "complete");
  const completedRows = rows.filter((row) => row.status.kind === "complete");
  const latestRows = rows.slice(0, 6);

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Monitoring Kelas"
        title={title}
        description={description}
        aside={<SessionHero total={rows.length} pending={pendingRows.length} complete={completedRows.length} />}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total Sesi" value={rows.length} helper={`${groups.length} kelas aktif`} tone="brand" />
        <SummaryCard label="Perlu Diinput" value={pendingRows.length} helper={mode === "presensi" ? "Presensi belum lengkap" : "Progres belum lengkap"} tone={pendingRows.length > 0 ? "warning" : "success"} />
        <SummaryCard label="Sudah Lengkap" value={completedRows.length} helper="Sesuai jumlah siswa aktif" tone="success" />
      </section>

      {rows.length > 0 ? (
        <>
          {pendingRows.length > 0 ? (
            <section>
              <SectionTitle title="Prioritas Hari Ini" description="Sesi berikut belum lengkap. Mulai dari sini agar data wali tetap aktual." />
              <div className="grid gap-4 xl:grid-cols-2">
                {pendingRows.map((row) => <SessionCard key={row.sesi.id} row={row} mode={mode} highlight />)}
              </div>
            </section>
          ) : (
            <section className="rounded-3xl border border-success-100 bg-success-50/60 p-5">
              <h2 className="font-semibold text-success-800">Semua sesi sudah lengkap</h2>
              <p className="mt-1 text-theme-sm text-success-700">Presensi/progres untuk sesi yang tersedia sudah sesuai jumlah siswa aktif.</p>
            </section>
          )}

          <section>
            <SectionTitle title="Sesi Terbaru" description="Daftar sesi terbaru untuk pengecekan cepat dan koreksi data jika diperlukan." />
            <div className="grid gap-4 xl:grid-cols-2">
              {latestRows.map((row) => <SessionCard key={row.sesi.id} row={row} mode={mode} />)}
            </div>
          </section>
        </>
      ) : (
        <EmptyState icon="classes" title="Belum ada sesi kelas" description="Buat sesi/pertemuan dari halaman kelas sebelum menginput presensi atau progres." />
      )}
    </main>
  );
}

function SessionHero({ total, pending, complete }: { total: number; pending: number; complete: number }) {
  return (
    <div className="grid min-w-72 grid-cols-3 gap-2 rounded-2xl border border-gray-100 bg-white/80 p-3 shadow-theme-xs">
      <MiniStat label="Sesi" value={total} />
      <MiniStat label="Prioritas" value={pending} />
      <MiniStat label="Lengkap" value={complete} />
    </div>
  );
}

function SummaryCard({ label, value, helper, tone }: { label: string; value: number; helper: string; tone: "brand" | "success" | "warning" }) {
  const classes = {
    brand: "bg-brand-50 text-brand-600",
    success: "bg-success-50 text-success-700",
    warning: "bg-warning-50 text-warning-700",
  }[tone];

  return (
    <article className="tailadmin-card min-w-0 p-5">
      <span className={`grid size-11 place-items-center rounded-xl ${classes}`}><DashboardIcon name="presensi" className="size-5" /></span>
      <p className="mt-4 text-3xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-theme-sm font-semibold text-gray-700">{label}</p>
      <p className="mt-1 text-theme-xs text-gray-500">{helper}</p>
    </article>
  );
}

function SessionCard({
  row,
  mode,
  highlight = false,
}: {
  row: ReturnType<typeof getSessionRows>[number];
  mode: Mode;
  highlight?: boolean;
}) {
  const label = mode === "presensi" ? "Input Presensi" : "Input Progres";
  const helper = mode === "presensi" ? "siswa sudah diabsen" : "progres sudah dicatat";

  return (
    <article className={`tailadmin-card min-w-0 p-5 transition hover:-translate-y-0.5 hover:shadow-theme-sm ${highlight ? "ring-1 ring-warning-100" : ""}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-theme-sm font-semibold text-brand-600">{row.sesi.meetingNumber}</span>
          <div className="min-w-0">
            <p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{row.kelas.program.name} / {row.kelas.name}</p>
            <h2 className="mt-1 truncate font-semibold text-gray-900" title={row.sesi.topic}>{row.sesi.topic}</h2>
            <p className="mt-1 text-theme-xs text-gray-500">{formatDate(row.sesi.sessionDate)} / {row.expected} siswa aktif</p>
          </div>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-theme-xs font-semibold ${row.status.className}`}>{row.status.label}</span>
      </div>

      <div className="mt-5 rounded-2xl bg-gray-50 p-4">
        <div className="mb-2 flex items-center justify-between text-theme-xs text-gray-500">
          <span>{row.filled}/{row.expected} {helper}</span>
          <span className="font-semibold text-gray-700">{row.percent}%</span>
        </div>
        <ProgressBar value={row.percent} tone={row.percent >= 100 ? "success" : row.percent > 0 ? "warning" : "error"} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/guru/${mode}/${row.sesi.id}`} className="tailadmin-button-primary px-4 py-2">{label}</Link>
        <Link href={`/guru/kelas/${row.kelas.id}/ringkasan`} className="tailadmin-button-outline px-4 py-2">Ringkasan Kelas</Link>
      </div>
    </article>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return <div className="mb-4"><h2 className="font-semibold text-gray-900">{title}</h2><p className="mt-1 text-theme-sm text-gray-500">{description}</p></div>;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="min-w-0 rounded-2xl bg-gray-50 p-3 text-center"><p className="truncate text-xl font-semibold text-gray-900">{value}</p><p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p></div>;
}

function getSessionRows() {
  return [] as {
    kelas: KelasSessionGroup["kelas"];
    sesi: KelasSessionGroup["sesi"][number];
    expected: number;
    filled: number;
    percent: number;
    status: ReturnType<typeof getSessionStatus>;
  }[];
}

function getSessionStatus(filled: number, expected: number) {
  if (expected === 0) {
    return { kind: "empty", label: "Tidak ada siswa", className: "bg-gray-100 text-gray-600" };
  }

  if (filled >= expected) {
    return { kind: "complete", label: "Lengkap", className: "bg-success-50 text-success-700" };
  }

  if (filled > 0) {
    return { kind: "partial", label: "Sebagian", className: "bg-warning-50 text-warning-700" };
  }

  return { kind: "none", label: "Belum diinput", className: "bg-error-50 text-error-700" };
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}
