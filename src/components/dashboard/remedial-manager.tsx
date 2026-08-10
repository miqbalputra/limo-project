"use client";

import { FormEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/api-json-client";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { formatUiLabel } from "@/lib/ui-labels";
import { ResponsiveDataView } from "@/components/dashboard/responsive-data-view";
import { useAsyncAction } from "@/components/dashboard/use-async-action";

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
    const form = new FormData(event.currentTarget);
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
        onSuccess: () => {
          createIdempotencyKey.current = null;
          event.currentTarget.reset();
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
      { fallbackMessage: "Remedial gagal dipublikasikan", onSuccess: () => router.refresh() },
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
        {error ? <p className="tailadmin-alert-error">{error}</p> : null}
        <div className="grid gap-3 md:grid-cols-2">
          <input
            name="title"
            required
            minLength={3}
            maxLength={200}
            placeholder="Judul remedial"
            className="tailadmin-input"
          />
          <select name="sourceId" required className="tailadmin-input">
            <option value="">Pilih tugas sumber yang diterbitkan</option>
            {assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.title} / Maks {assignment.maxScore}
              </option>
            ))}
          </select>
        </div>
        <textarea
          name="instructions"
          required
          maxLength={50000}
          placeholder="Instruksi remedial"
          className="tailadmin-input min-h-28"
        />
        <textarea
          name="reason"
          required
          maxLength={5000}
          placeholder="Alasan penugasan untuk siswa"
          className="tailadmin-input min-h-20"
        />
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
              {remedial.status === "DRAFT" ? (
                <button
                  disabled={busy}
                  onClick={() => void publish(remedial.id)}
                  className="tailadmin-button-primary px-3 py-2 text-theme-xs"
                >
                  Terbitkan remedial
                </button>
              ) : null}
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
