"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { SessionDuplicateButton } from "@/components/dashboard/session-duplicate-button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { requestJson } from "@/lib/api-json-client";

type SessionClass = {
  id: string;
  name: string;
  programName: string;
  levelName: string;
  guruName?: string | null;
};

type SessionItem = {
  id: string;
  meetingNumber: number;
  topic: string;
  sessionDate: string;
  status: "DRAFT" | "FINAL" | "CANCELLED";
  kelas: SessionClass;
  _count: { presensi: number; progresBelajar: number; materi: number };
};

type SessionWorkspaceProps = {
  scope: "admin" | "guru";
  classes: SessionClass[];
  sessions: SessionItem[];
  selectedClassId?: string;
  selectedStatus?: string;
};

export function SessionWorkspace({ scope, classes, sessions, selectedClassId, selectedStatus }: SessionWorkspaceProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [cancellingSession, setCancellingSession] = useState<SessionItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const selectedClass = classes.find((item) => item.id === selectedClassId) || classes[0];
  const isAdmin = scope === "admin";
  const apiBase = `/api/v1/${scope}/sesi`;

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);

    try {
      await requestJson(apiBase, {
        method: "POST",
        body: {
          kelasId: String(data.get("kelasId") || ""),
          meetingNumber: Number(data.get("meetingNumber") || 1),
          topic: String(data.get("topic") || ""),
          sessionDate: String(data.get("sessionDate") || ""),
        },
        fallbackMessage: "Sesi gagal disimpan",
      });
      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sesi gagal disimpan");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateSession(event: FormEvent<HTMLFormElement>, session: SessionItem) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);
    const reason = String(data.get("reason") || "");

    if (isAdmin && session.status === "FINAL" && !reason.trim()) {
      setError("Alasan override wajib diisi untuk sesi yang sudah final.");
      setIsSubmitting(false);
      return;
    }

    try {
      await requestJson(`${apiBase}/${session.id}`, {
        method: "PATCH",
        body: {
          meetingNumber: Number(data.get("meetingNumber") || 1),
          topic: String(data.get("topic") || ""),
          sessionDate: String(data.get("sessionDate") || ""),
          reason,
        },
        fallbackMessage: "Sesi gagal disimpan",
      });
      setEditingSessionId(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sesi gagal diperbarui");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function cancelSession() {
    if (!cancellingSession) return;
    setCancelError("");

    if (isAdmin && cancellingSession.status === "FINAL" && !cancelReason.trim()) {
      setCancelError("Alasan override wajib diisi untuk sesi yang sudah final.");
      return;
    }

    setIsCancelling(true);
    try {
      await requestJson(`${apiBase}/${cancellingSession.id}`, {
        method: "DELETE",
        body: { reason: cancelReason },
        fallbackMessage: "Sesi gagal disimpan",
      });
      setCancellingSession(null);
      setCancelReason("");
      router.refresh();
    } catch (caught) {
      setCancelError(caught instanceof Error ? caught.message : "Sesi gagal dibatalkan");
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <>
      <section className="tailadmin-card p-4 sm:p-5">
        <form method="get" className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_190px_auto]">
          <label className="grid gap-1"><span className="text-theme-xs font-medium text-gray-600">Kelas</span><select name="kelasId" defaultValue={selectedClassId || ""} aria-label="Filter kelas sesi" className="tailadmin-input py-2.5"><option value="">Semua kelas</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.programName} / {item.name}</option>)}</select></label>
          <label className="grid gap-1"><span className="text-theme-xs font-medium text-gray-600">Status</span><select name="status" defaultValue={selectedStatus || ""} aria-label="Filter status sesi" className="tailadmin-input py-2.5"><option value="">Semua status</option><option value="DRAFT">Draf</option><option value="FINAL">Final</option><option value="CANCELLED">Dibatalkan</option></select></label>
          <button type="submit" className="tailadmin-button-primary self-end px-4 py-2.5">Terapkan</button>
        </form>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <form onSubmit={createSession} className="tailadmin-card grid gap-3 p-5">
          <div><p className="text-theme-xs font-semibold uppercase tracking-[0.16em] text-limo-blue-700">{isAdmin ? "Override administratif" : "Sesi kelas"}</p><h2 className="mt-1 font-semibold text-gray-900">Tambah sesi</h2><p className="mt-1 text-theme-xs leading-5 text-gray-500">{isAdmin ? "Admin dapat membuat sesi pada seluruh kelas aktif. Aksi ini dicatat sebagai override." : "Anda hanya dapat membuat sesi pada kelas aktif yang ditugaskan kepada Anda."}</p></div>
          {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
          <label className="grid gap-1"><span className="text-theme-xs font-medium text-gray-600">Kelas</span><select name="kelasId" required defaultValue={selectedClass?.id || ""} aria-label="Kelas sesi baru" className="tailadmin-input">{classes.length === 0 ? <option value="">Belum ada kelas aktif</option> : classes.map((item) => <option key={item.id} value={item.id}>{item.programName} / {item.name}{isAdmin && item.guruName ? ` / ${item.guruName}` : ""}</option>)}</select></label>
          <label className="grid gap-1"><span className="text-theme-xs font-medium text-gray-600">Pertemuan ke</span><input name="meetingNumber" type="number" min={1} required defaultValue={1} className="tailadmin-input" /></label>
          <label className="grid gap-1"><span className="text-theme-xs font-medium text-gray-600">Topik</span><input name="topic" required placeholder="Contoh: Percakapan perkenalan" className="tailadmin-input" /></label>
          <label className="grid gap-1"><span className="text-theme-xs font-medium text-gray-600">Tanggal sesi</span><input name="sessionDate" type="date" required className="tailadmin-input" /></label>
          <button type="submit" disabled={isSubmitting || classes.length === 0} className="tailadmin-button-primary">{isSubmitting ? "Menyimpan..." : "Simpan sesi"}</button>
        </form>

        <section className="tailadmin-card overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-4"><p className="text-theme-xs font-semibold uppercase tracking-[0.16em] text-limo-blue-700">Lifecycle sesi</p><h2 className="mt-1 font-semibold text-gray-900">Sesi terjadwal</h2><p className="mt-1 text-theme-xs text-gray-500">Draf dapat diubah atau dibatalkan. Sesi final terkunci untuk Guru; Admin hanya dapat override dengan alasan tercatat.</p></div>
          {sessions.length > 0 ? <div className="divide-y divide-gray-100">{sessions.map((session) => {
            const canMutate = session.status === "DRAFT" || (isAdmin && session.status === "FINAL");
            const editing = editingSessionId === session.id;
            return <article key={session.id} className="p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-700">{session.kelas.programName} / {session.kelas.name}</p><h3 className="mt-1 font-semibold text-gray-900">Pertemuan {session.meetingNumber}: {session.topic}</h3><p className="mt-1 text-theme-sm text-gray-500">{formatDate(session.sessionDate)}{isAdmin && session.kelas.guruName ? ` / Guru: ${session.kelas.guruName}` : ""}</p><p className="mt-1 text-theme-xs text-gray-500">{session._count.presensi} presensi / {session._count.progresBelajar} progres / {session._count.materi} materi</p></div><StatusBadge status={session.status} className="w-fit px-3" /></div>{editing ? <form onSubmit={(event) => void updateSession(event, session)} className="mt-4 grid gap-3 rounded-xl border border-limo-blue-100 bg-limo-blue-50/40 p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1"><span className="text-theme-xs font-medium text-gray-600">Pertemuan ke</span><input name="meetingNumber" type="number" min={1} required defaultValue={session.meetingNumber} className="tailadmin-input" /></label><label className="grid gap-1"><span className="text-theme-xs font-medium text-gray-600">Tanggal sesi</span><input name="sessionDate" type="date" required defaultValue={session.sessionDate.slice(0, 10)} className="tailadmin-input" /></label></div><label className="grid gap-1"><span className="text-theme-xs font-medium text-gray-600">Topik</span><input name="topic" required defaultValue={session.topic} className="tailadmin-input" /></label>{isAdmin && session.status === "FINAL" ? <label className="grid gap-1"><span className="text-theme-xs font-medium text-gray-600">Alasan override</span><textarea name="reason" required minLength={8} placeholder="Jelaskan alasan perubahan sesi final" className="tailadmin-input min-h-24" /></label> : null}<div className="flex flex-wrap gap-2"><button type="submit" disabled={isSubmitting} className="tailadmin-button-primary px-4 py-2">{isSubmitting ? "Menyimpan..." : "Simpan perubahan"}</button><button type="button" onClick={() => setEditingSessionId(null)} disabled={isSubmitting} className="tailadmin-button-outline px-4 py-2">Batal</button></div></form> : null}{(canMutate || (scope === "guru" && session.status !== "CANCELLED")) && !editing ? <div className="mt-4 flex flex-wrap gap-2">{canMutate ? <><button type="button" onClick={() => { setError(""); setEditingSessionId(session.id); }} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Edit sesi</button><button type="button" onClick={() => { setCancelError(""); setCancelReason(""); setCancellingSession(session); }} className="inline-flex items-center justify-center rounded-lg bg-error-50 px-3 py-2 text-theme-xs font-semibold text-error-700 hover:bg-error-100">Batalkan sesi</button></> : null}{scope === "guru" && session.status !== "CANCELLED" ? <SessionDuplicateButton sesiKelasId={session.id} /> : null}</div> : null}</article>;
          })}</div> : <div className="p-5"><EmptyState icon="calendar" title="Belum ada sesi yang cocok" description="Ubah filter atau buat sesi baru untuk mulai menyiapkan agenda kelas." /></div>}
        </section>
      </section>

      <ConfirmDialog
        open={Boolean(cancellingSession)}
        title="Batalkan sesi kelas?"
        description={cancellingSession ? `Pertemuan ${cancellingSession.meetingNumber}: ${cancellingSession.topic} akan ditandai dibatalkan dan tidak dapat diisi lagi.` : ""}
        confirmLabel="Ya, batalkan sesi"
        variant="destructive"
        isBusy={isCancelling}
        error={cancelError}
        onClose={() => { if (!isCancelling) setCancellingSession(null); }}
        onConfirm={() => void cancelSession()}
      >
        {isAdmin && cancellingSession?.status === "FINAL" ? <label className="grid gap-1"><span className="text-theme-xs font-medium text-gray-700">Alasan override</span><textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} required minLength={8} placeholder="Jelaskan alasan pembatalan sesi final" className="tailadmin-input min-h-24" /></label> : null}
      </ConfirmDialog>
    </>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value));
}
