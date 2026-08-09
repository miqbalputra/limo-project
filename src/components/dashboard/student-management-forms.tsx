"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { formatUiLabel } from "@/lib/ui-labels";
import { requestJson } from "@/lib/api-json-client";

type Option = { id: string; name: string };
type WaliOption = { id: string; user: { name: string; email: string } };

async function mutate(path: string, method: string, body?: Record<string, unknown>) {
  await requestJson(path, { method, body, fallbackMessage: "Data gagal diproses" });
}

function useMutation() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function run(action: () => Promise<void>) {
    setError("");
    setIsSubmitting(true);
    try {
      await action();
      router.refresh();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Data gagal diproses");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  return { error, isSubmitting, run };
}

export function UpdateStudentForm({
  student,
  programs,
}: {
  student: { id: string; name: string; birthDate: string; programId: string; status: string };
  programs: Option[];
}) {
  const mutation = useMutation();
  const [pendingUpdate, setPendingUpdate] = useState<{ name: string; birthDate: string; programId: string; status: string } | null>(null);

  async function saveStudent(update: { name: string; birthDate: string; programId: string; status: string }) {
    const saved = await mutation.run(() => mutate(`/api/v1/admin/siswa/${student.id}`, "PATCH", update));
    if (saved) setPendingUpdate(null);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const update = {
      name: String(data.get("name") || ""),
      birthDate: String(data.get("birthDate") || ""),
      programId: String(data.get("programId") || ""),
      status: String(data.get("status") || "ACTIVE"),
    };
    if (update.status !== student.status) {
      setPendingUpdate(update);
      return;
    }
    void saveStudent(update);
  }

  return (
    <>
      <form onSubmit={onSubmit} className="tailadmin-card grid gap-3 p-5">
        <h2 className="font-semibold text-gray-900">Data Siswa</h2>
        {mutation.error ? <p className="tailadmin-alert-error">{mutation.error}</p> : null}
        <input name="name" required defaultValue={student.name} className="tailadmin-input" />
        <input name="birthDate" type="date" defaultValue={student.birthDate} className="tailadmin-input" />
        <select name="programId" required defaultValue={student.programId} className="tailadmin-input">
          {programs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select name="status" defaultValue={student.status} className="tailadmin-input">
          <option value="ACTIVE">{formatUiLabel("ACTIVE")}</option>
          <option value="INACTIVE">{formatUiLabel("INACTIVE")}</option>
          <option value="GRADUATED">{formatUiLabel("GRADUATED")}</option>
          <option value="ARCHIVED">{formatUiLabel("ARCHIVED")}</option>
        </select>
        <button disabled={mutation.isSubmitting} className="tailadmin-button-primary">{mutation.isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}</button>
      </form>
      <ConfirmDialog open={Boolean(pendingUpdate)} title="Ubah status siswa?" description={pendingUpdate?.status === "ARCHIVED" ? "Siswa akan diarsipkan dan keanggotaan kelas aktifnya diakhiri." : pendingUpdate?.status === "ACTIVE" ? "Status siswa akan diaktifkan kembali. Pastikan keanggotaan kelas yang diperlukan sudah sesuai." : "Perubahan ke status nonaktif akan mengakhiri keanggotaan kelas aktif siswa."} confirmLabel="Ya, ubah status" variant={pendingUpdate?.status === "ARCHIVED" ? "destructive" : "status"} isBusy={mutation.isSubmitting} error={mutation.error} onClose={() => { if (!mutation.isSubmitting) setPendingUpdate(null); }} onConfirm={() => { if (pendingUpdate) void saveStudent(pendingUpdate); }} />
    </>
  );
}

export function StudentRelationForm({ studentId, walis }: { studentId: string; walis: WaliOption[] }) {
  const mutation = useMutation();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void mutation.run(async () => {
      await mutate(`/api/v1/admin/siswa/${studentId}/wali`, "POST", {
        waliProfileId: String(data.get("waliProfileId") || ""),
        relationship: String(data.get("relationship") || "Wali"),
        isPrimary: data.get("isPrimary") === "on",
      });
      form.reset();
    });
  }

  return (
    <form onSubmit={onSubmit} className="tailadmin-card grid gap-3 p-5">
      <h2 className="font-semibold text-gray-900">Hubungkan Wali</h2>
      {mutation.error ? <p className="tailadmin-alert-error">{mutation.error}</p> : null}
      <select name="waliProfileId" required className="tailadmin-input">
        <option value="">Pilih wali</option>
        {walis.map((item) => <option key={item.id} value={item.id}>{item.user.name} - {item.user.email}</option>)}
      </select>
      <input name="relationship" defaultValue="Orang tua" className="tailadmin-input" />
       <label className="text-theme-sm text-gray-700"><input name="isPrimary" type="checkbox" className="mr-2 accent-limo-blue-500" />Wali utama</label>
      <button disabled={mutation.isSubmitting} className="tailadmin-button-primary">Hubungkan Wali</button>
    </form>
  );
}

export function TransferStudentForm({ studentId, kelas }: { studentId: string; kelas: Option[] }) {
  const mutation = useMutation();
  const [pendingTransfer, setPendingTransfer] = useState<{ kelasId: string; startDate: string } | null>(null);

  async function transferStudent(transfer: { kelasId: string; startDate: string }) {
    const transferred = await mutation.run(() => mutate(`/api/v1/admin/siswa/${studentId}/transfer`, "POST", transfer));
    if (transferred) setPendingTransfer(null);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPendingTransfer({
      kelasId: String(data.get("kelasId") || ""),
      startDate: String(data.get("startDate") || ""),
    });
  }

  return (
    <>
      <form onSubmit={onSubmit} className="tailadmin-card grid gap-3 p-5">
        <h2 className="font-semibold text-gray-900">Mutasi Kelas</h2>
        {mutation.error ? <p className="tailadmin-alert-error">{mutation.error}</p> : null}
        <select name="kelasId" required className="tailadmin-input">
          <option value="">Pilih kelas tujuan</option>
          {kelas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <input name="startDate" type="date" required className="tailadmin-input" />
        <button disabled={mutation.isSubmitting} className="tailadmin-button-primary">Pindahkan Kelas</button>
      </form>
      <ConfirmDialog open={Boolean(pendingTransfer)} title="Pindahkan siswa ke kelas baru?" description={pendingTransfer ? <>Keanggotaan kelas aktif akan ditutup dan siswa akan masuk ke <strong>{kelas.find((item) => item.id === pendingTransfer.kelasId)?.name || "kelas tujuan"}</strong> mulai {pendingTransfer.startDate}.</> : ""} confirmLabel="Ya, pindahkan siswa" variant="status" isBusy={mutation.isSubmitting} error={mutation.error} onClose={() => { if (!mutation.isSubmitting) setPendingTransfer(null); }} onConfirm={() => { if (pendingTransfer) void transferStudent(pendingTransfer); }} />
    </>
  );
}

export function StudentRecordActions({ studentId, archived }: { studentId: string; archived: boolean }) {
  const mutation = useMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function runAction() {
    const completed = await mutation.run(() => mutate(archived ? `/api/v1/admin/siswa/${studentId}/restore` : `/api/v1/admin/siswa/${studentId}`, archived ? "POST" : "DELETE"));
    if (completed) setConfirmOpen(false);
  }

  return (
    <>
      <div>
      {mutation.error ? <p className="mb-2 tailadmin-alert-error">{mutation.error}</p> : null}
      <button
        type="button"
        disabled={mutation.isSubmitting}
        onClick={() => setConfirmOpen(true)}
        className={archived ? "tailadmin-button-primary" : "inline-flex rounded-lg bg-error-500 px-4 py-2.5 text-theme-sm font-medium text-white hover:bg-error-700 disabled:opacity-50"}
      >
        {archived ? "Pulihkan Siswa" : "Arsipkan Siswa"}
      </button>
      </div>
      <ConfirmDialog open={confirmOpen} title={archived ? "Pulihkan siswa?" : "Arsipkan siswa?"} description={archived ? "Siswa akan dipulihkan. Keanggotaan kelas baru mungkin perlu dibuat sebelum kembali aktif di kelas." : "Siswa akan diarsipkan dan seluruh keanggotaan kelas aktifnya diakhiri."} confirmLabel={archived ? "Ya, pulihkan" : "Ya, arsipkan"} variant={archived ? "status" : "destructive"} isBusy={mutation.isSubmitting} error={mutation.error} onClose={() => { if (!mutation.isSubmitting) setConfirmOpen(false); }} onConfirm={() => void runAction()} />
    </>
  );
}

export function RemoveWaliButton({ studentId, waliProfileId }: { studentId: string; waliProfileId: string }) {
  const mutation = useMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function remove() {
    const removed = await mutation.run(() => mutate(`/api/v1/admin/siswa/${studentId}/wali/${waliProfileId}`, "DELETE"));
    if (removed) setConfirmOpen(false);
  }
  return (
    <><button type="button" disabled={mutation.isSubmitting} onClick={() => setConfirmOpen(true)} className="text-theme-xs font-semibold text-error-700 hover:underline disabled:opacity-50">Lepas</button><ConfirmDialog open={confirmOpen} title="Lepaskan hubungan Wali?" description="Wali tidak lagi dapat melihat data siswa ini dari akunnya." confirmLabel="Ya, lepaskan" variant="destructive" isBusy={mutation.isSubmitting} error={mutation.error} onClose={() => { if (!mutation.isSubmitting) setConfirmOpen(false); }} onConfirm={() => void remove()} /></>
  );
}
