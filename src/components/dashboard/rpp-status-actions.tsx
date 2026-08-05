"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RppStatusActions({ rppId, status }: { rppId: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextStatus = status === "DRAFT" ? "PUBLISHED" : status === "PUBLISHED" ? "ARCHIVED" : "DRAFT";
  const label = status === "DRAFT" ? "Publish ke Wali" : status === "PUBLISHED" ? "Arsipkan" : "Kembalikan ke Draft";

  async function updateStatus() {
    if (status === "PUBLISHED" && !window.confirm("Arsipkan RPP ini? RPP tidak lagi terlihat oleh Wali.")) return;
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/v1/guru/rpp/${rppId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Status RPP gagal diubah");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status RPP gagal diubah");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" onClick={updateStatus} disabled={isSubmitting} className="tailadmin-button-outline px-3 py-2 text-theme-xs">{isSubmitting ? "Memproses..." : label}</button>{error ? <p role="alert" className="w-full text-theme-xs text-error-700">{error}</p> : null}</div>;
}
