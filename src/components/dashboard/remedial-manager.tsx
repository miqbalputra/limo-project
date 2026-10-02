"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/api-json-client";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { formatUiLabel } from "@/lib/ui-labels";
import { ResponsiveDataView } from "@/components/dashboard/responsive-data-view";
import { useAsyncAction } from "@/components/dashboard/use-async-action";
import { useConfirmDialog } from "@/components/dashboard/use-confirm-dialog";

type DateValue = string | Date | null;
const remedialRequestFallback = "Perubahan remedial gagal disimpan";
type StudentOption = { id: string; name: string; nomorInduk: string };
type AssignmentOption = { id: string; title: string; maxScore: number };
type Participant = {
  id: string;
  studentId: string;
  reason: string;
  status: string;
  originalScore: number | null;
  remedialScore: number | null;
  effectiveScore: number | null;
  student: StudentOption;
};
type RemedialView = {
  id: string;
  sourceType: string;
  sourceId: string;
  sourceTitle: string;
  title: string;
  instructions: string;
  availableFrom: DateValue;
  dueAt: DateValue;
  scorePolicy: string;
  scoreCap: number | null;
  status: string;
  participants: Participant[];
};

export function RemedialManager({
  classId,
  assignments,
  students,
  initialRemedials,
}: {
  classId: string;
  assignments: AssignmentOption[];
  students: StudentOption[];
  initialRemedials: RemedialView[];
}) {
  const router = useRouter();
  const { error, isPending: busy, run } = useAsyncAction();
  const createIdempotencyKey = useRef<string | null>(null);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const reason = String(form.get("reason") || "");
    const studentIds = form.getAll("studentId").map(String);
    await run(
      "create",
      async () => {
        if (studentIds.length === 0)
          throw new Error("Pilih minimal satu peserta remedial");
        createIdempotencyKey.current ||= crypto.randomUUID();
        return requestJson(`/api/v1/guru/kelas/${classId}/remedial`, {
        method: "POST",
        headers: { "Idempotency-Key": createIdempotencyKey.current },
        body: {
          sourceType: "ASSIGNMENT",
          sourceId: String(form.get("sourceId") || ""),
          title: String(form.get("title") || ""),
          instructions: String(form.get("instructions") || ""),
          availableFrom: String(form.get("availableFrom") || ""),
          dueAt: String(form.get("dueAt") || ""),
          scorePolicy: String(form.get("scorePolicy") || "LATEST"),
          scoreCap: String(form.get("scoreCap") || ""),
          status: "DRAFT",
          participants: studentIds.map((studentId) => ({ studentId, reason })),
        },
        fallbackMessage: remedialRequestFallback,
        });
      },
      {
        fallbackMessage: "Remedial gagal dibuat",
        successMessage: "Remedial draf berhasil dibuat.",
        onSuccess: () => {
          createIdempotencyKey.current = null;
          formElement.reset();
          router.refresh();
        },
      },
    );
  }

  async function publish(id: string) {
    await run(
      "publish",
      () =>
        requestJson(`/api/v1/guru/remedial/${id}`, {
        method: "PATCH",
        body: { status: "PUBLISHED" },
        fallbackMessage: remedialRequestFallback,
        }),
      { fallbackMessage: "Remedial gagal dipublikasikan", successMessage: "Remedial diterbitkan.", onSuccess: () => router.refresh() },
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="tailadmin-card grid gap-4 p-5">
        <div>
          <p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-500">
            Tugas remedial
          </p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">
            Buat remedial untuk siswa terpilih
          </h2>
          <p className="mt-1 text-theme-sm text-gray-500">
            Jawaban memakai alur tugas yang sama. Nilai awal tetap
            tersimpan pada histori.
          </p>
        </div>
        {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Judul remedial
            <input
              name="title"
              required
              minLength={3}
              maxLength={200}
              placeholder="Judul remedial"
              className="mt-1 tailadmin-input"
            />
          </label>
          <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Sumber tugas
            <select name="sourceId" required className="mt-1 tailadmin-input">
              <option value="">Pilih tugas sumber yang diterbitkan</option>
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.title} / Maks {assignment.maxScore}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Instruksi remedial
          <textarea
            name="instructions"
            required
            maxLength={50000}
            placeholder="Instruksi remedial"
            className="mt-1 tailadmin-input min-h-28"
          />
        </label>
        <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Alasan penugasan
          <textarea
            name="reason"
            required
            maxLength={5000}
            placeholder="Alasan penugasan untuk siswa"
            className="mt-1 tailadmin-input min-h-20"
          />
        </label>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="grid gap-1 text-theme-xs font-semibold text-gray-600">
            Mulai tersedia
            <input
              name="availableFrom"
              type="datetime-local"
              className="tailadmin-input"
            />
          </label>
          <label className="grid gap-1 text-theme-xs font-semibold text-gray-600">
            Tenggat
            <input
              name="dueAt"
              type="datetime-local"
              required
              className="tailadmin-input"
            />
          </label>
          <label className="grid gap-1 text-theme-xs font-semibold text-gray-600">
            Kebijakan nilai
            <select name="scorePolicy" className="tailadmin-input">
              <option value="LATEST">{formatUiLabel("LATEST")}</option>
              <option value="HIGHEST">{formatUiLabel("HIGHEST")}</option>
              <option value="AVERAGE">{formatUiLabel("AVERAGE")}</option>
              <option value="CAPPED">{formatUiLabel("CAPPED")}</option>
            </select>
          </label>
          <label className="grid gap-1 text-theme-xs font-semibold text-gray-600">
            Batas nilai akhir
            <input
              name="scoreCap"
              type="number"
              min={0}
              max={100}
              placeholder="0-100"
              className="tailadmin-input"
            />
          </label>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Peserta
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {students.map((student) => (
              <label
                key={student.id}
                className="flex items-center gap-2 text-theme-sm text-gray-700"
              >
                <input type="checkbox" name="studentId" value={student.id} />
                {student.name} / {student.nomorInduk}
              </label>
            ))}
          </div>
        </div>
        <button
          disabled={busy}
          className="tailadmin-button-primary w-full sm:w-fit"
        >
          {busy ? "Menyimpan..." : "Simpan Draf Remedial"}
        </button>
      </form>
      {initialRemedials.length > 0 ? (
        initialRemedials.map((remedial) => (
          <article key={remedial.id} className="tailadmin-card overflow-hidden">
            <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={remedial.status} compact />
                  <span className="text-theme-xs text-gray-500">
                    {formatUiLabel(remedial.scorePolicy)} / sumber {remedial.sourceTitle}
                  </span>
                </div>
                <h2 className="mt-2 text-xl font-semibold text-gray-900">
                  {remedial.title}
                </h2>
                <p className="mt-2 whitespace-pre-line text-theme-sm text-gray-500">
                  {remedial.instructions}
                </p>
                <p className="mt-2 text-theme-xs text-gray-500">
                  Tenggat {formatDate(remedial.dueAt)} /{" "}
                  {remedial.participants.length} peserta
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {remedial.status === "DRAFT" ? (
                  <button
                    disabled={busy}
                    onClick={() => void publish(remedial.id)}
                    className="tailadmin-button-primary px-3 py-2 text-theme-xs"
                  >
                    Terbitkan remedial
                  </button>
                ) : null}
                <RemedialCardActions remedial={remedial} />
              </div>
            </div>
            <div className="border-t border-gray-100">
              <ResponsiveDataView
                rows={remedial.participants}
                getRowKey={(participant) => participant.id}
                tableLabel={`Peserta remedial ${remedial.title}`}
                desktopBreakpoint="xl"
                testId={`remedial-${remedial.id}`}
                columns={[
                  { id: "student", label: "Siswa", render: (participant) => <><p className="font-semibold text-gray-900">{participant.student.name}</p><p className="text-theme-xs text-gray-500">{participant.student.nomorInduk}</p></> },
                  { id: "status", label: "Status", render: (participant) => <StatusBadge status={participant.status} /> },
                  { id: "original", label: "Nilai awal", render: (participant) => <span>{formatScore(participant.originalScore)}</span> },
                  { id: "remedial", label: "Remedial", render: (participant) => <span>{formatScore(participant.remedialScore)}</span> },
                  { id: "effective", label: "Nilai efektif", render: (participant) => <span className="font-semibold">{formatScore(participant.effectiveScore)}</span> },
                  { id: "action", label: "Aksi", render: (participant) => <RemedialParticipantSync participantId={participant.id} /> },
                ]}
              />
            </div>
          </article>
        ))
      ) : (
        <div className="tailadmin-card p-8 text-center text-theme-sm text-gray-500">
          Belum ada remedial untuk kelas ini.
        </div>
      )}
    </div>
  );
}

function formatDate(value: DateValue) {
  return value
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(new Date(value))
    : "-";
}

function formatScore(value: number | null) {
  return value === null ? "-" : value.toFixed(2);
}

function RemedialCardActions({ remedial }: { remedial: RemedialView }) {
  const router = useRouter();
  const { error, isPending: busy, run } = useAsyncAction();
  const { confirm, dialog } = useConfirmDialog();
  const [editing, setEditing] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(
      "update",
      () =>
        requestJson(`/api/v1/guru/remedial/${remedial.id}`, {
          method: "PUT",
          body: {
            title: String(data.get("title") || ""),
            instructions: String(data.get("instructions") || ""),
            availableFrom: String(data.get("availableFrom") || ""),
            dueAt: String(data.get("dueAt") || ""),
            scorePolicy: String(data.get("scorePolicy") || "LATEST"),
            scoreCap: String(data.get("scoreCap") || ""),
          },
          fallbackMessage: remedialRequestFallback,
        }),
      {
        fallbackMessage: "Remedial gagal diperbarui",
        successMessage: "Remedial diperbarui.",
        onSuccess: () => {
          setEditing(false);
          router.refresh();
        },
      },
    );
  }

  async function close() {
    if (!(await confirm({ title: "Tutup remedial?", description: "Remedial ditutup dan tidak dapat diubah lagi. Nilai yang sudah tercatat tetap tersimpan.", confirmLabel: "Ya, tutup", variant: "destructive" }))) return;
    await run(
      "close",
      () => requestJson(`/api/v1/guru/remedial/${remedial.id}`, { method: "DELETE", fallbackMessage: remedialRequestFallback }),
      { fallbackMessage: "Remedial gagal ditutup", successMessage: "Remedial ditutup.", onSuccess: () => router.refresh() },
    );
  }

  if (remedial.status === "ARCHIVED") {
    return <span className="rounded-full bg-gray-100 px-3 py-2 text-theme-xs font-semibold text-gray-500">Ditutup</span>;
  }

  return (
    <>
      <button type="button" onClick={() => setEditing((value) => !value)} className="tailadmin-button-outline px-3 py-2 text-theme-xs">{editing ? "Batal ubah" : "Ubah"}</button>
      <button type="button" disabled={busy} onClick={() => void close()} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Tutup</button>
      {editing ? (
        <form onSubmit={save} className="mt-3 grid w-full gap-3 rounded-xl border border-limo-blue-100 bg-limo-blue-50/40 p-4">
          <input name="title" required defaultValue={remedial.title} aria-label="Judul remedial" className="tailadmin-input" />
          <textarea name="instructions" required defaultValue={remedial.instructions} aria-label="Instruksi remedial" className="tailadmin-input min-h-24" />
          <div className="grid gap-3 md:grid-cols-4">
            <label className="grid gap-1 text-theme-xs font-semibold text-gray-600">Mulai tersedia<input name="availableFrom" type="datetime-local" defaultValue={toDateTimeInput(remedial.availableFrom)} className="tailadmin-input" /></label>
            <label className="grid gap-1 text-theme-xs font-semibold text-gray-600">Tenggat<input name="dueAt" type="datetime-local" required defaultValue={toDateTimeInput(remedial.dueAt)} className="tailadmin-input" /></label>
            <label className="grid gap-1 text-theme-xs font-semibold text-gray-600">Kebijakan nilai
              <select name="scorePolicy" defaultValue={remedial.scorePolicy} className="tailadmin-input">
                <option value="LATEST">{formatUiLabel("LATEST")}</option>
                <option value="HIGHEST">{formatUiLabel("HIGHEST")}</option>
                <option value="AVERAGE">{formatUiLabel("AVERAGE")}</option>
                <option value="CAPPED">{formatUiLabel("CAPPED")}</option>
              </select>
            </label>
            <label className="grid gap-1 text-theme-xs font-semibold text-gray-600">Batas nilai<input name="scoreCap" type="number" min={0} max={100} defaultValue={remedial.scoreCap ?? ""} className="tailadmin-input" /></label>
          </div>
          {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
          <button type="submit" disabled={busy} className="tailadmin-button-primary w-fit px-3 py-2 text-theme-xs">{busy ? "Menyimpan..." : "Simpan perubahan"}</button>
        </form>
      ) : null}
      {dialog}
    </>
  );
}

function RemedialParticipantSync({ participantId }: { participantId: string }) {
  const router = useRouter();
  const { isPending: busy, run } = useAsyncAction();

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() =>
        void run(
          "sync",
          () => requestJson(`/api/v1/guru/remedial/participants/${participantId}/sync`, { method: "POST", fallbackMessage: remedialRequestFallback }),
          { fallbackMessage: "Sinkronisasi nilai gagal", successMessage: "Nilai remedial disinkronkan.", onSuccess: () => router.refresh() },
        )
      }
      className="tailadmin-button-outline px-2.5 py-1.5 text-[11px]"
    >
      {busy ? "Memproses..." : "Sinkronkan nilai"}
    </button>
  );
}

function toDateTimeInput(value: DateValue) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
