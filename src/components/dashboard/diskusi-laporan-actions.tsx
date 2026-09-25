"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/api-json-client";

export function DiskusiLaporanActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  if (status !== "OPEN") {
    return <span className="text-theme-xs font-semibold text-gray-500">Selesai ditangani</span>;
  }

  async function resolve(next: "RESOLVED" | "DISMISSED") {
    setError("");
    setBusy(next);
    try {
      await requestJson(`/api/v1/admin/diskusi-laporan/${id}/resolve`, { method: "POST", body: { status: next }, fallbackMessage: "Gagal memperbarui laporan" });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memperbarui laporan");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={Boolean(busy)} onClick={() => void resolve("RESOLVED")} className="tailadmin-button-primary px-3 py-1.5">{busy === "RESOLVED" ? "Memproses..." : "Selesaikan"}</button>
      <button type="button" disabled={Boolean(busy)} onClick={() => void resolve("DISMISSED")} className="tailadmin-button-outline px-3 py-1.5">{busy === "DISMISSED" ? "Memproses..." : "Abaikan"}</button>
      {error ? <p role="alert" className="w-full text-theme-xs text-error-700">{error}</p> : null}
    </div>
  );
}
