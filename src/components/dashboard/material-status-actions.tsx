"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MaterialStatusActions({ materiId, status }: { materiId: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextStatus = status === "DRAFT" ? "PUBLISHED" : status === "PUBLISHED" ? "ARCHIVED" : "DRAFT";
  const label = status === "DRAFT" ? "Publish" : status === "PUBLISHED" ? "Arsipkan" : "Kembalikan ke Draft";

  async function updateStatus() {
    if (status === "PUBLISHED" && !window.confirm("Arsipkan materi ini? Materi tidak lagi tampil untuk Wali.")) return;
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/v1/guru/materi/${materiId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Status materi gagal diubah");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status materi gagal diubah");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={updateStatus} disabled={isSubmitting} className="tailadmin-button-outline px-3 py-1 text-theme-xs">{isSubmitting ? "Memproses..." : label}</button>{error ? <p role="alert" className="text-theme-xs text-error-700">{error}</p> : null}</div>;
}
