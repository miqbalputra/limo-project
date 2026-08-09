"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/api-json-client";

export function RequestRevisionButton({ submissionId, disabled }: { submissionId: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function requestRevision() {
    const reason = window.prompt("Alasan revisi wajib diisi");
    if (!reason?.trim()) return;
    const instructions = window.prompt("Instruksi tambahan untuk Siswa (opsional)") || "";
    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/v1/guru/submissions/${submissionId}/revision`, { method: "POST", body: { reason, instructions }, fallbackMessage: "Permintaan revisi gagal disimpan" });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Permintaan revisi gagal disimpan");
    } finally {
      setBusy(false);
    }
  }

  return <div className="flex flex-col items-start gap-1"><button type="button" disabled={disabled || busy} onClick={() => void requestRevision()} className="tailadmin-button-outline min-h-11 px-3 py-2 text-theme-xs">{busy ? "Menyimpan..." : "Minta Revisi"}</button>{error ? <span className="text-[10px] text-error-600">{error}</span> : null}</div>;
}
