"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SessionDuplicateButton({ sesiKelasId }: { sesiKelasId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function duplicate() {
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/v1/guru/sesi/${sesiKelasId}/duplicate`, { method: "POST" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(payload.error?.message || "Sesi gagal diduplikasi");
      }

      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sesi gagal diduplikasi");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <span className="inline-flex flex-col items-start gap-1"><button type="button" onClick={() => void duplicate()} disabled={isSubmitting} className="tailadmin-button-outline px-3 py-1.5 text-theme-xs">{isSubmitting ? "Menduplikasi..." : "Duplikat Sesi"}</button>{error ? <span className="text-theme-xs text-error-700">{error}</span> : null}</span>;
}
