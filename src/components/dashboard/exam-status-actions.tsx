"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirmDialog } from "@/components/dashboard/use-confirm-dialog";
import { requestJson } from "@/lib/api-json-client";

export function ExamStatusActions({ ujianId, status }: { ujianId: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { confirm, dialog } = useConfirmDialog();
  const nextStatus = status === "DRAFT" ? "PUBLISHED" : status === "PUBLISHED" ? "ARCHIVED" : "DRAFT";
  const label = status === "DRAFT" ? "Terbitkan" : status === "PUBLISHED" ? "Arsipkan" : "Kembalikan ke draf";

  async function updateStatus() {
    if (status === "PUBLISHED" && !(await confirm({ title: "Arsipkan ujian?", description: "Ujian tidak lagi tersedia untuk Wali.", confirmLabel: "Ya, arsipkan", variant: "destructive" }))) return;
    setError("");
    setIsSubmitting(true);
    try {
      await requestJson(`/api/v1/ujian/${ujianId}/status`, { method: "PATCH", body: { status: nextStatus }, fallbackMessage: "Status ujian gagal diubah" });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status ujian gagal diubah");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => void updateStatus()} disabled={isSubmitting} className="tailadmin-button-outline px-4 py-2">{isSubmitting ? "Memproses..." : label}</button>{error ? <p role="alert" className="w-full text-theme-xs text-error-700">{error}</p> : null}</div>{dialog}</>;
}
