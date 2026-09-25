"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/api-json-client";

export function ExamResultReleaseButton({ hasilId, released }: { hasilId: string; released: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (released) {
    return <span className="inline-flex items-center gap-1.5 rounded-xl bg-success-50 px-3 py-1.5 text-theme-xs font-semibold text-success-700">Nilai dirilis</span>;
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setError("");
          setBusy(true);
          try {
            await requestJson(`/api/v1/hasil-ujian/${hasilId}/release`, { method: "POST", fallbackMessage: "Gagal merilis nilai" });
            router.refresh();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Gagal merilis nilai");
          } finally {
            setBusy(false);
          }
        }}
        className="tailadmin-button-outline w-fit px-3 py-1.5 text-theme-xs"
      >
        {busy ? "Memproses..." : "Rilis nilai ke siswa/wali"}
      </button>
      {error ? <p role="alert" className="text-theme-xs text-error-700">{error}</p> : null}
    </div>
  );
}
