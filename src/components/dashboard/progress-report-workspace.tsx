"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { requestJson } from "@/lib/api-json-client";
import type { ProgressReportItem, ReportSnapshot } from "@/components/dashboard/progress-report-card";

type KelasOption = { id: string; name: string };
type StudentOption = { kelasId: string; id: string; name: string; nomorInduk: string };

const STATUS_LABEL: Record<string, string> = { DRAFT: "Draf", PUBLISHED: "Terbit", REVISED: "Direvisi" };
const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-warning-50 text-warning-700",
  PUBLISHED: "bg-success-50 text-success-700",
  REVISED: "bg-limo-blue-50 text-limo-blue-700",
};
const TYPE_LABEL: Record<string, string> = { WEEKLY: "Mingguan", MONTHLY: "Bulanan", LEVEL_COMPLETION: "Penyelesaian level" };

type EditState = { summary: string; strengths: string; improvementAreas: string; teacherRecommendation: string; reason: string };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

function monthDefaults() {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const end = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  return { start, end };
}

function metricValue(snapshot: ReportSnapshot | null, key: "attendance" | "completion" | "exams") {
  if (key === "attendance") return snapshot?.attendance?.rate != null ? `${snapshot.attendance.rate}%` : "Belum ada data";
  if (key === "completion") return snapshot?.completion?.percentage != null ? `${snapshot.completion.percentage}%` : "Belum ada data";
  return snapshot?.exams?.average != null ? `${snapshot.exams.average}` : "Belum ada data";
}

export function ProgressReportWorkspace({ kelasOptions, students, initialItems }: { kelasOptions: KelasOption[]; students: StudentOption[]; initialItems: ProgressReportItem[] }) {
  const router = useRouter();
  const defaults = useMemo(() => monthDefaults(), []);
  const [kelasId, setKelasId] = useState(kelasOptions[0]?.id ?? "");
  const kelasStudents = useMemo(() => students.filter((student) => student.kelasId === kelasId), [students, kelasId]);
  const [studentId, setStudentId] = useState("");
  const [reportType, setReportType] = useState("MONTHLY");
  const [periodStart, setPeriodStart] = useState(defaults.start);
  const [periodEnd, setPeriodEnd] = useState(defaults.end);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState("");
  const [edit, setEdit] = useState<EditState>({ summary: "", strengths: "", improvementAreas: "", teacherRecommendation: "", reason: "" });

  const activeStudentId = studentId || kelasStudents[0]?.id || "";

  async function run(action: () => Promise<void>, successMessage: string) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await action();
      setNotice(successMessage);
      setEditingId("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(item: ProgressReportItem) {
    setEditingId(item.id);
    setEdit({
      summary: item.summary,
      strengths: item.strengths,
      improvementAreas: item.improvementAreas,
      teacherRecommendation: item.teacherRecommendation,
      reason: "",
    });
  }

  return (
    <div className="space-y-4">
      {error ? <p className="tailadmin-alert-error" role="alert">{error}</p> : null}
      {notice ? <p className="tailadmin-alert-success" role="status">{notice}</p> : null}

      <section className="tailadmin-card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="sm:col-span-2 font-semibold text-gray-900">Buat draf laporan</h2>
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Kelas
          <select value={kelasId} onChange={(event) => { setKelasId(event.target.value); setStudentId(""); }} className="mt-2 tailadmin-input">
            {kelasOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </label>
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Siswa
          <select value={activeStudentId} onChange={(event) => setStudentId(event.target.value)} className="mt-2 tailadmin-input">
            {kelasStudents.length === 0 ? <option value="">Tidak ada siswa aktif</option> : null}
            {kelasStudents.map((student) => <option key={student.id} value={student.id}>{student.name} ({student.nomorInduk})</option>)}
          </select>
        </label>
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Jenis laporan
          <select value={reportType} onChange={(event) => setReportType(event.target.value)} className="mt-2 tailadmin-input">
            <option value="WEEKLY">Mingguan</option>
            <option value="MONTHLY">Bulanan</option>
            <option value="LEVEL_COMPLETION">Penyelesaian level</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Mulai
            <input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="mt-2 tailadmin-input" />
          </label>
          <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Akhir
            <input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className="mt-2 tailadmin-input" />
          </label>
        </div>
        <div className="sm:col-span-2">
          <button
            type="button"
            disabled={busy || !kelasId || !activeStudentId}
            onClick={() => void run(async () => {
              await requestJson("/api/v1/guru/reports", { method: "POST", body: { kelasId, studentId: activeStudentId, reportType, periodStart, periodEnd }, fallbackMessage: "Gagal membuat draf laporan" });
            }, "Draf laporan dibuat. Lengkapi narasi lalu terbitkan.")}
            className="tailadmin-button-primary px-5 py-2.5"
          >
            {busy ? "Memproses..." : "Buat draf laporan"}
          </button>
        </div>
      </section>

      {initialItems.length === 0 ? (
        <p className="tailadmin-card p-5 text-theme-sm text-gray-500">Belum ada laporan. Buat draf pertama dari data periode.</p>
      ) : null}

      {initialItems.map((item) => (
        <article key={item.id} className="tailadmin-card space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-500">{TYPE_LABEL[item.reportType] ?? item.reportType}</p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">{item.student.name}</h3>
              <p className="text-theme-sm text-gray-500">{item.kelas.program.name} / {item.kelas.level.name} - {item.kelas.name}</p>
              <p className="mt-1 text-theme-xs text-gray-500">Periode {formatDate(item.periodStart)} - {formatDate(new Date(new Date(item.periodEnd).getTime() - 86_400_000).toISOString())}</p>
            </div>
            <span className={`rounded-xl px-3 py-1.5 text-theme-xs font-semibold ${STATUS_STYLE[item.status] ?? "bg-gray-100 text-gray-600"}`}>{STATUS_LABEL[item.status] ?? item.status}</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 p-3"><p className="text-theme-xs uppercase text-gray-400">Kehadiran</p><p className="text-theme-sm font-semibold text-gray-800">{metricValue(item.snapshotData, "attendance")}</p></div>
            <div className="rounded-xl border border-gray-200 p-3"><p className="text-theme-xs uppercase text-gray-400">Aktivitas wajib</p><p className="text-theme-sm font-semibold text-gray-800">{metricValue(item.snapshotData, "completion")}</p></div>
            <div className="rounded-xl border border-gray-200 p-3"><p className="text-theme-xs uppercase text-gray-400">Rata-rata ujian</p><p className="text-theme-sm font-semibold text-gray-800">{metricValue(item.snapshotData, "exams")}</p></div>
          </div>

          {editingId === item.id ? (
            <div className="grid gap-3">
              {([
                ["summary", "Ringkasan"],
                ["strengths", "Kelebihan"],
                ["improvementAreas", "Hal yang perlu ditingkatkan"],
                ["teacherRecommendation", "Rekomendasi Guru"],
              ] as const).map(([field, label]) => (
                <label key={field} className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                  {label}
                  <textarea value={edit[field]} onChange={(event) => setEdit((current) => ({ ...current, [field]: event.target.value }))} rows={3} dir="auto" className="mt-1 tailadmin-input" />
                </label>
              ))}
              {item.status !== "DRAFT" ? (
                <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                  Alasan revisi (wajib)
                  <input value={edit.reason} onChange={(event) => setEdit((current) => ({ ...current, reason: event.target.value }))} className="mt-1 tailadmin-input" />
                </label>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(async () => {
                    const narrative = { summary: edit.summary, strengths: edit.strengths, improvementAreas: edit.improvementAreas, teacherRecommendation: edit.teacherRecommendation };
                    if (item.status === "DRAFT") {
                      await requestJson(`/api/v1/guru/reports/${item.id}`, { method: "PATCH", body: narrative, fallbackMessage: "Gagal menyimpan draf" });
                    } else {
                      await requestJson(`/api/v1/guru/reports/${item.id}/revise`, { method: "POST", body: { reason: edit.reason, ...narrative }, fallbackMessage: "Gagal menyimpan revisi" });
                    }
                  }, "Perubahan laporan disimpan.")}
                  className="tailadmin-button-primary px-4 py-2"
                >
                  {busy ? "Menyimpan..." : "Simpan"}
                </button>
                <button type="button" onClick={() => setEditingId("")} className="tailadmin-button-outline px-4 py-2">Batal</button>
              </div>
            </div>
          ) : (
            <div className="grid gap-2 text-theme-sm text-gray-700">
              <p><span className="text-theme-xs uppercase text-gray-400">Ringkasan:</span> {item.summary || "-"}</p>
              <p><span className="text-theme-xs uppercase text-gray-400">Kelebihan:</span> {item.strengths || "-"}</p>
              <p><span className="text-theme-xs uppercase text-gray-400">Perlu ditingkatkan:</span> {item.improvementAreas || "-"}</p>
              <p><span className="text-theme-xs uppercase text-gray-400">Rekomendasi:</span> {item.teacherRecommendation || "-"}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            <a href={`/api/v1/reports/${item.id}/pdf`} className="tailadmin-button-outline px-3 py-1.5">Unduh PDF</a>
            <button type="button" onClick={() => startEdit(item)} className="tailadmin-button-outline px-3 py-1.5">{item.status === "DRAFT" ? "Ubah" : "Revisi"}</button>
            {item.status === "DRAFT" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(async () => {
                  await requestJson(`/api/v1/guru/reports/${item.id}/publish`, { method: "POST", body: {}, fallbackMessage: "Gagal menerbitkan laporan" });
                }, "Laporan diterbitkan dan wali/siswa dinotifikasi.")}
                className="tailadmin-button-primary px-3 py-1.5"
              >
                Terbitkan
              </button>
            ) : null}
            <span className="text-theme-xs text-gray-500">{item.publishedAt ? `Diterbitkan ${formatDate(item.publishedAt)}` : "Belum diterbitkan"}{item.readCount > 0 ? ` | Dibaca ${item.readCount}x` : ""}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
