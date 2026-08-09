"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { requestJson } from "@/lib/api-json-client";

async function postJson(path: string, body?: Record<string, string>) {
  await requestJson(path, { method: "POST", body, fallbackMessage: "Aksi gagal diproses" });
}

export function PendaftaranActions({ id, disabled }: { id: string; disabled: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function closeDialog() {
    if (isSubmitting) return;
    setDialog(null);
    setMessage("");
  }

  function openDialog(nextDialog: "approve" | "reject") {
    setMessage("");
    if (nextDialog === "reject") setReason("");
    setDialog(nextDialog);
  }

  async function approve() {
    setMessage("");
    setIsSubmitting(true);

    try {
      await postJson(`/api/v1/admin/pendaftaran/${id}/approve`);
      setDialog(null);
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Persetujuan gagal");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function reject() {
    const cleanReason = reason.trim();
    if (cleanReason.length < 8) {
      setMessage("Alasan penolakan minimal 8 karakter.");
      return;
    }

    setMessage("");
    setIsSubmitting(true);

    try {
      await postJson(`/api/v1/admin/pendaftaran/${id}/reject`, { reason: cleanReason });
      setDialog(null);
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Penolakan gagal");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => openDialog("approve")} disabled={disabled || isSubmitting} className="inline-flex items-center gap-1.5 rounded-lg bg-success-500 px-3 py-2 text-theme-xs font-semibold text-white transition-colors hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-50">
          <CheckIcon />
          Setujui
        </button>
        <button type="button" onClick={() => openDialog("reject")} disabled={disabled || isSubmitting} className="inline-flex items-center gap-1.5 rounded-lg bg-error-500 px-3 py-2 text-theme-xs font-semibold text-white transition-colors hover:bg-error-700 disabled:cursor-not-allowed disabled:opacity-50">
          <CloseIcon />
          Tolak
        </button>
      </div>

      {dialog ? (
        <ConfirmDialog
          open
          title={dialog === "approve" ? "Setujui pendaftaran?" : "Tolak pendaftaran?"}
          description={dialog === "approve" ? "Sistem akan membuat data siswa dan akun Wali. Pastikan data dan dokumen sudah diperiksa." : "Alasan ini akan ditampilkan kepada calon siswa atau Wali."}
          confirmLabel={dialog === "approve" ? "Ya, setujui" : "Ya, tolak"}
          variant={dialog === "approve" ? "status" : "destructive"}
          isBusy={isSubmitting}
          error={message}
          onClose={closeDialog}
          onConfirm={() => void (dialog === "approve" ? approve() : reject())}
        >
          {dialog === "reject" ? <div>
            <label htmlFor="rejection-reason" className="block text-theme-xs font-semibold text-gray-700">Alasan penolakan</label>
            <textarea id="rejection-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={8} maxLength={500} required placeholder="Contoh: Dokumen identitas belum lengkap." className="tailadmin-input mt-1.5 min-h-24 resize-y" />
            <p className="mt-1 text-[11px] text-gray-400">Minimal 8 karakter, maksimal 500 karakter.</p>
          </div> : null}
        </ConfirmDialog>
      ) : null}
    </>
  );
}

function CheckIcon() {
  return <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m4 10 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" /></svg>;
}
