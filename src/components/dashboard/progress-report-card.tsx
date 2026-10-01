import { ProgressReportReadButton } from "@/components/dashboard/progress-report-read-button";

export type ReportSnapshot = {
  attendance?: { total?: number; present?: number; rate?: number | null };
  progress?: { count?: number; average?: number | null };
  exams?: { count?: number; average?: number | null; items?: { title: string; score: number }[] };
  assignments?: { total?: number; graded?: number; late?: number };
  completion?: { required?: number; completed?: number; percentage?: number | null };
  finalGrade?: { score: number; letter: string | null } | null;
};

export type ProgressReportItem = {
  id: string;
  reportType: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  summary: string;
  strengths: string;
  improvementAreas: string;
  teacherRecommendation: string;
  snapshotData: ReportSnapshot | null;
  publishedAt: string | null;
  revisedAt: string | null;
  revisionReason: string | null;
  createdAt: string;
  updatedAt: string;
  student: { id: string; name: string; nomorInduk: string };
  kelas: { id: string; name: string; program: { name: string }; level: { name: string } };
  createdBy: { id: string; name: string } | null;
  readCount: number;
  isRead: boolean | null;
};

const STATUS_LABEL: Record<string, string> = { DRAFT: "Draf", PUBLISHED: "Terbit", REVISED: "Direvisi" };
const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-warning-50 text-warning-700",
  PUBLISHED: "bg-success-50 text-success-700",
  REVISED: "bg-limo-blue-50 text-limo-blue-700",
};
const TYPE_LABEL: Record<string, string> = { WEEKLY: "Mingguan", MONTHLY: "Bulanan", LEVEL_COMPLETION: "Penyelesaian level" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-theme-sm font-semibold text-gray-800">{value}</p>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <p className="mt-1 whitespace-pre-line text-theme-sm text-gray-700">{body?.trim() ? body : "-"}</p>
    </div>
  );
}

export function ProgressReportCard({ item, read }: { item: ProgressReportItem; read?: { endpoint: string } }) {
  const snapshot = item.snapshotData ?? {};
  const periodEndInclusive = new Date(new Date(item.periodEnd).getTime() - 86_400_000).toISOString();

  return (
    <article className="tailadmin-card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-500">{TYPE_LABEL[item.reportType] ?? item.reportType}</p>
          <h3 className="mt-1 text-lg font-semibold text-gray-900">{item.student.name}</h3>
          <p className="text-theme-sm text-gray-500">{item.kelas.program.name} / {item.kelas.level.name} - {item.kelas.name}</p>
          <p className="mt-1 text-theme-xs text-gray-500">Periode {formatDate(item.periodStart)} - {formatDate(periodEndInclusive)}</p>
        </div>
        <span className={`rounded-xl px-3 py-1.5 text-theme-xs font-semibold ${STATUS_STYLE[item.status] ?? "bg-gray-100 text-gray-600"}`}>{STATUS_LABEL[item.status] ?? item.status}</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Metric label="Kehadiran" value={snapshot.attendance?.rate != null ? `${snapshot.attendance.rate}%` : "Belum ada data"} />
        <Metric label="Aktivitas wajib" value={snapshot.completion?.percentage != null ? `${snapshot.completion.percentage}%` : "Belum ada data"} />
        <Metric label="Rata-rata nilai ujian" value={snapshot.exams?.average != null ? `${snapshot.exams.average}` : "Belum ada data"} />
      </div>

      <div className="grid gap-3">
        <Section title="Ringkasan" body={item.summary} />
        <Section title="Kelebihan" body={item.strengths} />
        <Section title="Hal yang perlu ditingkatkan" body={item.improvementAreas} />
        <Section title="Rekomendasi Guru" body={item.teacherRecommendation} />
      </div>

      {item.status === "REVISED" && item.revisionReason ? (
        <p className="rounded-xl bg-gray-50 p-3 text-theme-xs text-gray-600">Revisi: {item.revisionReason}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
        <p className="text-theme-xs text-gray-500">
          {item.publishedAt ? `Diterbitkan ${formatDate(item.publishedAt)}` : "Belum diterbitkan"}
          {item.createdBy ? ` | Guru: ${item.createdBy.name}` : ""}
          {item.readCount > 0 ? ` | Dibaca ${item.readCount}x` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/api/v1/reports/${item.id}/pdf`} className="tailadmin-button-outline px-3 py-1.5">Unduh PDF</a>
          {read ? <ProgressReportReadButton endpoint={read.endpoint} alreadyRead={Boolean(item.isRead)} /> : null}
        </div>
      </div>
    </article>
  );
}
