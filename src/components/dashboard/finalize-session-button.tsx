"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FinalizeSessionButton({ sesiKelasId }: { sesiKelasId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function finalize() {
    if (!window.confirm("Finalkan sesi ini? Setelah final, presensi dan progres tidak dapat diubah melalui input biasa.")) return;
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/v1/guru/sesi/${sesiKelasId}/finalize`, { method: "POST" });
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Sesi gagal difinalkan");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sesi gagal difinalkan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <span className="inline-flex flex-col items-start gap-1"><button type="button" onClick={() => void finalize()} disabled={isSubmitting} className="tailadmin-button-outline px-4 py-2">{isSubmitting ? "Memfinalkan..." : "Finalkan Sesi"}</button>{error ? <span role="alert" className="text-theme-xs text-error-700">{error}</span> : null}</span>;
}
