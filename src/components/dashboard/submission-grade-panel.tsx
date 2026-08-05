"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DateValue = string | Date | null;
type RubricCriterion = { id: string; name: string; description: string | null; maxScore: number; order: number; levels: Array<{ id: string; label: string; description: string | null; score: number; order: number }> };
type GradeCriterion = { id: string; criterionId: string; rubricLevelId: string | null; score: number; comment: string | null };
type Grade = { id: string; rawScore: number | null; score: number | null; feedbackText: string | null; status: string; correctionReason?: string | null; publishedAt: DateValue; createdAt?: DateValue; criteria: GradeCriterion[] };
type GradeContext = {
  submission: {
    id: string;
    status: string;
    onlineText: string | null;
    externalLink: string | null;
    assignment: { id: string; title: string; maxScore: number };
    student: { id: string; name: string; nomorInduk: string };
    files: Array<{ id: string; originalName: string; mimeType: string; sizeBytes: string; mediaDuration: number | null }>;
    grades: Grade[];
  };
  rubricSnapshot: { templateId: string; title: string; criteria: RubricCriterion[] };
  latestGrade: Grade | null;
};

type CriterionInput = { criterionId: string; rubricLevelId: string; score: number; comment: string };

async function requestJson(path: string, options: RequestInit = {}) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
  const payload = (await response.json().catch(() => ({}))) as { data?: unknown; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || "Perubahan penilaian gagal disimpan");
  return payload.data;
}

export function SubmissionGradePanel({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [context, setContext] = useState<GradeContext | null>(null);
  const [criteria, setCriteria] = useState<CriterionInput[]>([]);
  const [feedbackText, setFeedbackText] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [hasPublishedGrade, setHasPublishedGrade] = useState(false);

  async function openPanel() {
    setOpen(true);
    if (context) return;
    setLoading(true);
    setError("");
    try {
      const response = await requestJson(`/api/v1/guru/submissions/${submissionId}/grade`);
      const loaded = response as GradeContext;
      const latest = loaded.latestGrade;
      setContext(loaded);
      setGrade(latest);
      setHasPublishedGrade(loaded.submission.grades.some((item) => item.status === "PUBLISHED" || item.status === "REVISED"));
      setFeedbackText(latest?.feedbackText || "");
      setCorrectionReason(latest?.correctionReason || "");
      setCriteria(loaded.rubricSnapshot.criteria.map((criterion) => {
        const existing = latest?.criteria.find((item) => item.criterionId === criterion.id);
        return { criterionId: criterion.id, rubricLevelId: existing?.rubricLevelId || "", score: existing?.score || 0, comment: existing?.comment || "" };
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Data penilaian gagal dimuat");
    } finally {
      setLoading(false);
    }
  }

  function updateCriterion(index: number, patch: Partial<CriterionInput>) {
    setCriteria((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const response = await requestJson(`/api/v1/guru/submissions/${submissionId}/grade`, { method: "PATCH", body: JSON.stringify({ feedbackText, correctionReason, criteria }) }) as { item: Grade };
      setGrade(response.item as Grade);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Draft penilaian gagal disimpan");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!grade?.id) return;
    if (!window.confirm("Publikasikan nilai dan feedback ini? Setelah published, koreksi berikutnya wajib memiliki alasan.")) return;
    setBusy(true);
    setError("");
    try {
      const response = await requestJson(`/api/v1/guru/submissions/${submissionId}/grade/publish`, { method: "POST", body: JSON.stringify({ gradeId: grade.id }) }) as { item: Grade };
      setGrade(response.item as Grade);
      setHasPublishedGrade(true);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nilai gagal dipublikasikan");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <button type="button" onClick={() => void openPanel()} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Nilai / Feedback</button>;
  if (loading) return <div className="mt-3 rounded-xl bg-gray-50 p-4 text-theme-sm text-gray-500">Memuat jawaban dan rubrik...</div>;
  if (!context) return <div className="mt-3 rounded-xl bg-error-50 p-4 text-theme-sm text-error-700">{error || "Data penilaian tidak tersedia"}</div>;

  const maxRaw = context.rubricSnapshot.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0);
  const rawScore = criteria.reduce((sum, criterion) => sum + (Number(criterion.score) || 0), 0);
  const normalizedScore = maxRaw > 0 ? Math.round((rawScore / maxRaw) * context.submission.assignment.maxScore) : 0;

  return <div className="mt-3 rounded-2xl border border-brand-100 bg-brand-50/40 p-4" data-testid="submission-grade-panel">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-600">Penilaian {context.rubricSnapshot.title}</p><p className="mt-1 text-theme-sm text-gray-600">{context.submission.student.name} / {context.submission.student.nomorInduk}</p></div><button type="button" onClick={() => setOpen(false)} className="text-theme-xs font-semibold text-gray-500">Tutup</button></div>
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <div className="rounded-xl bg-white p-3"><p className="text-theme-xs font-semibold uppercase text-gray-500">Jawaban</p>{context.submission.onlineText ? <p className="mt-2 whitespace-pre-line text-theme-sm leading-6 text-gray-700">{context.submission.onlineText}</p> : null}{context.submission.externalLink ? <a href={context.submission.externalLink} target="_blank" rel="noreferrer" className="mt-2 block break-all text-theme-sm font-semibold text-brand-600">{context.submission.externalLink}</a> : null}{context.submission.files.map((file) => <div key={file.id} className="mt-3">{file.mimeType.startsWith("audio/") ? <audio controls preload="metadata" src={`/api/v1/assignment-submissions/files/${file.id}?inline=1`} className="w-full" /> : null}{file.mimeType.startsWith("video/") ? <video controls preload="metadata" src={`/api/v1/assignment-submissions/files/${file.id}?inline=1`} className="max-h-64 w-full rounded-lg" /> : null}{!file.mimeType.startsWith("audio/") && !file.mimeType.startsWith("video/") ? <a href={`/api/v1/assignment-submissions/files/${file.id}`} className="text-theme-sm font-semibold text-brand-600">{file.originalName}</a> : <p className="mt-1 text-theme-xs text-gray-500">{file.originalName}{file.mediaDuration ? ` / ${formatDuration(file.mediaDuration)}` : ""}</p>}</div>)}</div>
      <div className="space-y-3">
        {criteria.map((item, index) => { const criterion = context.rubricSnapshot.criteria.find((candidate) => candidate.id === item.criterionId)!; return <div key={item.criterionId} className="rounded-xl bg-white p-3"><div className="flex items-center justify-between gap-2"><div><p className="text-theme-sm font-semibold text-gray-800">{criterion.name}</p><p className="text-theme-xs text-gray-500">Maksimal {criterion.maxScore}</p></div><input aria-label={`Skor ${criterion.name}`} type="number" min={0} max={criterion.maxScore} value={item.score} onChange={(event) => updateCriterion(index, { score: Number(event.target.value) || 0 })} className="tailadmin-input w-20" /></div><select aria-label={`Level ${criterion.name}`} value={item.rubricLevelId} onChange={(event) => updateCriterion(index, { rubricLevelId: event.target.value })} className="tailadmin-input mt-2 w-full"><option value="">Pilih level (opsional)</option>{criterion.levels.map((level) => <option key={level.id} value={level.id}>{level.label} / {level.score}</option>)}</select><input aria-label={`Komentar ${criterion.name}`} value={item.comment} onChange={(event) => updateCriterion(index, { comment: event.target.value })} placeholder="Komentar kriteria (opsional)" className="tailadmin-input mt-2" /></div>; })}
        <p className="rounded-xl bg-white px-3 py-2 text-theme-sm font-semibold text-gray-700">Preview nilai: {normalizedScore} / {context.submission.assignment.maxScore} <span className="font-normal text-gray-500">({rawScore} / {maxRaw})</span></p>
        <textarea value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} maxLength={50000} placeholder="Feedback untuk Siswa dan Wali" className="tailadmin-input min-h-24 bg-white" />
        {hasPublishedGrade ? <textarea value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} maxLength={10000} placeholder="Alasan koreksi wajib diisi setelah nilai published" className="tailadmin-input min-h-20 bg-white" /> : null}
        {error ? <p className="tailadmin-alert-error">{error}</p> : null}
        <div className="flex flex-wrap items-center gap-2"><span className="text-theme-xs text-gray-500">{grade?.status || "DRAFT"}</span><button type="button" disabled={busy} onClick={() => void save()} className="tailadmin-button-outline px-3 py-2 text-theme-xs">{busy ? "Menyimpan..." : "Simpan Draft"}</button><button type="button" disabled={busy || !grade?.id} onClick={() => void publish()} className="tailadmin-button-primary px-3 py-2 text-theme-xs">Publikasikan Nilai</button></div>
      </div>
    </div>
  </div>;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
