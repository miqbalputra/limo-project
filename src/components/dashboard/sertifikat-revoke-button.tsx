"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/api-json-client";

export function SertifikatRevokeButton({ id, code }: { id: string; code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function revoke() {
    const reason = window.prompt(`Alasan mencabut sertifikat ${code}?`);
    if (!reason || reason.trim().length < 5) return;

    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/v1/admin/sertifikat/${id}/revoke`, { method: "POST", body: { reason: reason.trim() }, fallbackMessage: "Gagal mencabut sertifikat" });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mencabut sertifikat");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" onClick={() => void revoke()} disabled={busy} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-error-200 px-3 text-theme-xs font-semibold text-error-600 hover:bg-error-50 disabled:opacity-40">{busy ? "Mencabut..." : "Cabut"}</button>
      {error ? <span role="alert" className="text-theme-xs text-error-700">{error}</span> : null}
    </span>
  );
}
