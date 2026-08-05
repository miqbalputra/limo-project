"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { RubricOption } from "@/components/dashboard/rubric-manager";

type DateValue = string | Date | null;

export type AssignmentView = {
  id: string;
  kelasId: string;
  title: string;
  instructions: string;
  submissionType: string;
  maxScore: number;
  availableFrom: DateValue;
  dueAt: DateValue;
  cutoffAt: DateValue;
  maxAttempts: number;
  allowLateSubmission: boolean;
  allowResubmission: boolean;
  status: string;
  publishedAt: DateValue;
  createdAt: DateValue;
  updatedAt: DateValue;
  rubricTemplateId: string | null;
  rubricTemplate: { id: string; title: string; status: string } | null;
  _count?: { submissions: number };
};

async function requestJson(path: string, options: RequestInit = {}) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
  const payload = (await response.json().catch(() => ({}))) as { data?: unknown; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || "Perubahan tugas gagal disimpan");
  return payload.data;
}

export function AssignmentBuilder({ kelasId, initialAssignments, rubrics = [] }: { kelasId: string; initialAssignments: AssignmentView[]; rubrics?: RubricOption[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const data = new FormData(event.currentTarget);
      await requestJson(`/api/v1/guru/kelas/${kelasId}/tugas`, {
        method: "POST",
        body: JSON.stringify({
          title: String(data.get("title") || ""),
          instructions: String(data.get("instructions") || ""),
          submissionType: String(data.get("submissionType") || "ONLINE_TEXT"),
          maxScore: Number(data.get("maxScore") || 100),
          availableFrom: String(data.get("availableFrom") || ""),
          dueAt: String(data.get("dueAt") || ""),
          cutoffAt: String(data.get("cutoffAt") || ""),
          maxAttempts: Number(data.get("maxAttempts") || 1),
          allowLateSubmission: Boolean(data.get("allowLateSubmission")),
          allowResubmission: Boolean(data.get("allowResubmission")),
        }),
      });
      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tugas gagal dibuat");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="tailadmin-card grid gap-4 p-5">
        <div>
          <p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">Tugas online</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">Buat tugas baru</h2>
          <p className="mt-1 text-theme-sm text-gray-500">Tugas terpisah dari ujian. Draft Siswa tersimpan dengan nomor versi dan dapat dilanjutkan setelah login ulang.</p>
        </div>
        {error ? <p className="tailadmin-alert-error">{error}</p> : null}
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_7rem]">
          <input name="title" required minLength={3} maxLength={200} placeholder="Judul tugas" className="tailadmin-input" />
          <select name="submissionType" className="tailadmin-input">
            <option value="ONLINE_TEXT">Jawaban teks</option>
            <option value="FILE">Dokumen</option>
            <option value="IMAGE">Foto/gambar</option>
            <option value="AUDIO">Audio</option>
            <option value="VIDEO">Video</option>
            <option value="EXTERNAL_LINK">Link eksternal</option>
            <option value="OFFLINE_ACTIVITY">Aktivitas offline</option>
          </select>
          <input name="maxScore" type="number" min={1} defaultValue={100} placeholder="Nilai maks" className="tailadmin-input" />
        </div>
        <textarea name="instructions" required maxLength={50000} placeholder="Instruksi tugas" className="tailadmin-input min-h-32" />
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-theme-xs font-semibold text-gray-600">Mulai tersedia<input name="availableFrom" type="datetime-local" className="tailadmin-input" /></label>
          <label className="grid gap-1 text-theme-xs font-semibold text-gray-600">Tenggat<input name="dueAt" type="datetime-local" className="tailadmin-input" /></label>
          <label className="grid gap-1 text-theme-xs font-semibold text-gray-600">Cutoff<input name="cutoffAt" type="datetime-local" className="tailadmin-input" /></label>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-theme-sm text-gray-600">
          <label className="flex items-center gap-2"><span>Max attempt</span><input name="maxAttempts" type="number" min={1} max={10} defaultValue={1} className="tailadmin-input w-20" /></label>
          <label className="flex items-center gap-2"><input name="allowLateSubmission" type="checkbox" /> Izinkan terlambat</label>
          <label className="flex items-center gap-2"><input name="allowResubmission" type="checkbox" /> Izinkan revisi</label>
        </div>
        <button disabled={isSubmitting} className="tailadmin-button-primary w-full sm:w-fit">{isSubmitting ? "Menyimpan..." : "Simpan Draft Tugas"}</button>
      </form>

      {initialAssignments.length > 0 ? <div className="space-y-4">{initialAssignments.map((assignment) => <AssignmentCard key={assignment.id} assignment={assignment} rubrics={rubrics} onRefresh={() => router.refresh()} />)}</div> : <div className="tailadmin-card p-8 text-center text-theme-sm text-gray-500">Belum ada tugas. Buat draft pertama untuk kelas ini.</div>}
    </div>
  );
}

function AssignmentCard({ assignment, rubrics, onRefresh }: { assignment: AssignmentView; rubrics: RubricOption[]; onRefresh: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function updateStatus(status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    if (status === "ARCHIVED" && !window.confirm("Arsipkan tugas ini? Submission lama tetap tersimpan.")) return;
    setError("");
    setBusy(true);
    try {
      await requestJson(`/api/v1/guru/tugas/${assignment.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      onRefresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status tugas gagal diubah");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="tailadmin-card overflow-hidden">
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClass(assignment.status)}`}>{assignment.status}</span><span className="text-theme-xs text-gray-500">{assignment.submissionType} / Nilai {assignment.maxScore}</span></div>
          <h2 className="mt-2 break-words text-xl font-semibold text-gray-900">{assignment.title}</h2>
          <p className="mt-2 whitespace-pre-line text-theme-sm leading-6 text-gray-500">{assignment.instructions}</p>
          <p className="mt-3 text-theme-xs text-gray-500">{assignment.dueAt ? `Tenggat ${formatDate(assignment.dueAt)}` : "Tanpa tenggat"} / {assignment.maxAttempts} attempt / {assignment._count?.submissions || 0} submission</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
          {assignment.status !== "PUBLISHED" ? <button disabled={busy} onClick={() => void updateStatus("PUBLISHED")} className="tailadmin-button-primary px-3 py-2 text-theme-xs">Publish</button> : null}
          {assignment.status !== "ARCHIVED" ? <button disabled={busy} onClick={() => void updateStatus("ARCHIVED")} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Arsipkan</button> : null}
          {assignment.status === "ARCHIVED" ? <button disabled={busy} onClick={() => void updateStatus("DRAFT")} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Kembalikan Draft</button> : null}
          <a href={`/guru/tugas/${assignment.id}/submissions`} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Lihat Submission</a>
        </div>
      </div>
      {error ? <p className="px-5 pb-4 tailadmin-alert-error">{error}</p> : null}
      <RubricAssignmentControl assignment={assignment} rubrics={rubrics} onRefresh={onRefresh} />
    </article>
  );
}

function RubricAssignmentControl({ assignment, rubrics, onRefresh }: { assignment: AssignmentView; rubrics: RubricOption[]; onRefresh: () => void }) {
  const [rubricId, setRubricId] = useState(assignment.rubricTemplateId || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const publishedRubrics = rubrics.filter((rubric) => rubric.status === "PUBLISHED");

  async function attach() {
    if (!rubricId) return;
    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/v1/guru/tugas/${assignment.id}/rubric`, { method: "PATCH", body: JSON.stringify({ rubricId }) });
      onRefresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Rubrik gagal dipasang");
    } finally {
      setBusy(false);
    }
  }

  return <div className="border-t border-gray-100 bg-gray-50 px-5 py-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">Rubrik penilaian</p><p className="mt-1 text-theme-sm text-gray-600">{assignment.rubricTemplate ? `Terpasang: ${assignment.rubricTemplate.title}` : "Belum ada rubrik. Nilai manual dapat ditambahkan pada fase gradebook."}</p></div><div className="flex flex-col gap-2 sm:flex-row"><select value={rubricId} onChange={(event) => setRubricId(event.target.value)} className="tailadmin-input min-w-56 bg-white text-theme-sm"><option value="">Pilih rubrik published</option>{publishedRubrics.map((rubric) => <option key={rubric.id} value={rubric.id}>{rubric.title}</option>)}</select><button disabled={busy || !rubricId} onClick={() => void attach()} className="tailadmin-button-outline px-3 py-2 text-theme-xs">{busy ? "Memasang..." : "Pasang Rubrik"}</button></div></div>{publishedRubrics.length === 0 ? <p className="mt-2 text-theme-xs text-gray-500">Publish template rubrik terlebih dahulu.</p> : null}{error ? <p className="mt-2 text-theme-xs text-error-600">{error}</p> : null}</div>;
}

function statusClass(status: string) {
  return { DRAFT: "bg-gray-100 text-gray-700", PUBLISHED: "bg-success-50 text-success-700", ARCHIVED: "bg-error-50 text-error-700" }[status] || "bg-gray-100 text-gray-700";
}

function formatDate(value: DateValue) {
  if (!value) return "";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}
