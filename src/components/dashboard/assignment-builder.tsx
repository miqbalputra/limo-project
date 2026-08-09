"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { RubricOption } from "@/components/dashboard/rubric-manager";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { requestJson } from "@/lib/api-json-client";
import { formatUiLabel } from "@/lib/ui-labels";
import { useAsyncAction } from "@/components/dashboard/use-async-action";
import { useConfirmDialog } from "@/components/dashboard/use-confirm-dialog";

type DateValue = string | Date | null;
const assignmentRequestFallback = "Perubahan tugas gagal disimpan";

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

export function AssignmentBuilder({ kelasId, initialAssignments, rubrics = [] }: { kelasId: string; initialAssignments: AssignmentView[]; rubrics?: RubricOption[] }) {
  const router = useRouter();
  const { error, isPending: isSubmitting, run } = useAsyncAction();

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(
      "create",
      () =>
        requestJson(`/api/v1/guru/kelas/${kelasId}/tugas`, {
        method: "POST",
        body: {
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
        },
        fallbackMessage: assignmentRequestFallback,
        }),
      {
        fallbackMessage: "Tugas gagal dibuat",
        onSuccess: () => {
          event.currentTarget.reset();
          router.refresh();
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="tailadmin-card grid gap-4 p-5">
        <div>
          <p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-500">Tugas online</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">Buat tugas baru</h2>
          <p className="mt-1 text-theme-sm text-gray-500">Tugas terpisah dari ujian. Draf siswa tersimpan dengan nomor versi dan dapat dilanjutkan setelah login ulang.</p>
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
          <label className="grid gap-1 text-theme-xs font-semibold text-gray-600">Batas akhir<input name="cutoffAt" type="datetime-local" className="tailadmin-input" /></label>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-theme-sm text-gray-600">
          <label className="flex items-center gap-2"><span>Maks. percobaan</span><input name="maxAttempts" type="number" min={1} max={10} defaultValue={1} className="tailadmin-input w-20" /></label>
          <label className="flex items-center gap-2"><input name="allowLateSubmission" type="checkbox" /> Izinkan terlambat</label>
          <label className="flex items-center gap-2"><input name="allowResubmission" type="checkbox" /> Izinkan revisi</label>
        </div>
        <button disabled={isSubmitting} className="tailadmin-button-primary w-full sm:w-fit">{isSubmitting ? "Menyimpan..." : "Simpan Draf Tugas"}</button>
      </form>

      {initialAssignments.length > 0 ? <div className="space-y-4">{initialAssignments.map((assignment) => <AssignmentCard key={assignment.id} assignment={assignment} rubrics={rubrics} onRefresh={() => router.refresh()} />)}</div> : <div className="tailadmin-card p-8 text-center text-theme-sm text-gray-500">Belum ada tugas. Buat draf pertama untuk kelas ini.</div>}
    </div>
  );
}

function AssignmentCard({ assignment, rubrics, onRefresh }: { assignment: AssignmentView; rubrics: RubricOption[]; onRefresh: () => void }) {
  const { error, isPending: busy, run } = useAsyncAction();
  const { confirm, dialog } = useConfirmDialog();

  async function updateStatus(status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    if (status === "ARCHIVED" && !(await confirm({ title: "Arsipkan tugas?", description: "Jawaban lama tetap tersimpan.", confirmLabel: "Ya, arsipkan", variant: "destructive" }))) return;
    await run(
      "status",
      () =>
        requestJson(`/api/v1/guru/tugas/${assignment.id}`, {
        method: "PATCH",
        body: { status },
        fallbackMessage: assignmentRequestFallback,
        }),
      { fallbackMessage: "Status tugas gagal diubah", onSuccess: onRefresh },
    );
  }

  return (
    <>
    <article className="tailadmin-card overflow-hidden">
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><StatusBadge status={assignment.status} compact className="uppercase tracking-wide" /><span className="text-theme-xs text-gray-500">{formatUiLabel(assignment.submissionType)} / Nilai {assignment.maxScore}</span></div>
          <h2 className="mt-2 break-words text-xl font-semibold text-gray-900">{assignment.title}</h2>
          <p className="mt-2 whitespace-pre-line text-theme-sm leading-6 text-gray-500">{assignment.instructions}</p>
          <p className="mt-3 text-theme-xs text-gray-500">{assignment.dueAt ? `Tenggat ${formatDate(assignment.dueAt)}` : "Tanpa tenggat"} / {assignment.maxAttempts} percobaan / {assignment._count?.submissions || 0} jawaban</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
          {assignment.status !== "PUBLISHED" ? <button disabled={busy} onClick={() => void updateStatus("PUBLISHED")} className="tailadmin-button-primary px-3 py-2 text-theme-xs">Terbitkan</button> : null}
          {assignment.status !== "ARCHIVED" ? <button disabled={busy} onClick={() => void updateStatus("ARCHIVED")} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Arsipkan</button> : null}
          {assignment.status === "ARCHIVED" ? <button disabled={busy} onClick={() => void updateStatus("DRAFT")} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Kembalikan Draf</button> : null}
          <a href={`/guru/tugas/${assignment.id}/submissions`} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Lihat jawaban</a>
        </div>
      </div>
      {error ? <p className="px-5 pb-4 tailadmin-alert-error">{error}</p> : null}
      <RubricAssignmentControl assignment={assignment} rubrics={rubrics} onRefresh={onRefresh} />
    </article>
    {dialog}
    </>
  );
}

function RubricAssignmentControl({ assignment, rubrics, onRefresh }: { assignment: AssignmentView; rubrics: RubricOption[]; onRefresh: () => void }) {
  const [rubricId, setRubricId] = useState(assignment.rubricTemplateId || "");
  const { error, isPending: busy, run } = useAsyncAction();
  const publishedRubrics = rubrics.filter((rubric) => rubric.status === "PUBLISHED");

  async function attach() {
    if (!rubricId) return;
    await run(
      "attach",
      () =>
        requestJson(`/api/v1/guru/tugas/${assignment.id}/rubric`, {
        method: "PATCH",
        body: { rubricId },
        fallbackMessage: assignmentRequestFallback,
        }),
      { fallbackMessage: "Rubrik gagal dipasang", onSuccess: onRefresh },
    );
  }

  return <div className="border-t border-gray-100 bg-gray-50 px-5 py-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-500">Rubrik penilaian</p><p className="mt-1 text-theme-sm text-gray-600">{assignment.rubricTemplate ? `Terpasang: ${assignment.rubricTemplate.title}` : "Belum ada rubrik. Nilai manual dapat ditambahkan pada buku nilai."}</p></div><div className="flex flex-col gap-2 sm:flex-row"><select value={rubricId} onChange={(event) => setRubricId(event.target.value)} className="tailadmin-input min-w-56 bg-white text-theme-sm"><option value="">Pilih rubrik diterbitkan</option>{publishedRubrics.map((rubric) => <option key={rubric.id} value={rubric.id}>{rubric.title}</option>)}</select><button disabled={busy || !rubricId} onClick={() => void attach()} className="tailadmin-button-outline px-3 py-2 text-theme-xs">{busy ? "Memasang..." : "Pasang Rubrik"}</button></div></div>{publishedRubrics.length === 0 ? <p className="mt-2 text-theme-xs text-gray-500">Terbitkan template rubrik terlebih dahulu.</p> : null}{error ? <p className="mt-2 text-theme-xs text-error-600">{error}</p> : null}</div>;
}

function formatDate(value: DateValue) {
  if (!value) return "";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}
