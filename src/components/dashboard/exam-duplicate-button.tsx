"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/api-json-client";

export function ExamDuplicateButton({ ujianId }: { ujianId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function duplicate() {
    setError("");
    setIsSubmitting(true);

    try {
      await requestJson(`/api/v1/ujian/${ujianId}/duplicate`, { method: "POST", fallbackMessage: "Ujian gagal diduplikasi" });

      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ujian gagal diduplikasi");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <span className="inline-flex flex-col items-start gap-1"><button type="button" onClick={() => void duplicate()} disabled={isSubmitting} className="tailadmin-button-outline px-4 py-2">{isSubmitting ? "Menduplikasi..." : "Duplikat sebagai Draf"}</button>{error ? <span className="text-theme-xs text-error-700">{error}</span> : null}</span>;
}
