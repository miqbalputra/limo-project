"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/api-json-client";

export function QuizReleaseButton({ ujianId, responseId, label }: { ujianId: string; responseId?: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function release() {
    setBusy(true);
    setError("");

    try {
      const path = responseId
        ? `/api/v1/kuis/${ujianId}/responses/${responseId}/release`
        : `/api/v1/kuis/${ujianId}/release`;
      await requestJson(path, { method: "POST", fallbackMessage: "Gagal merilis nilai" });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal merilis nilai");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" onClick={() => void release()} disabled={busy} className="tailadmin-button-outline px-3 py-2 text-theme-xs">{busy ? "Merilis..." : label}</button>
      {error ? <span role="alert" className="text-theme-xs text-error-700">{error}</span> : null}
    </span>
  );
}
