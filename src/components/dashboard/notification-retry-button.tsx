"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/api-json-client";

export function NotificationRetryButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function retry() {
    setLoading(true);
    setError("");

    try {
      await requestJson(`/api/v1/admin/notifikasi/${id}/retry`, { method: "POST", body: {}, fallbackMessage: "Gagal mengirim ulang notifikasi" });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mengirim ulang notifikasi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => void retry()} disabled={loading} className="tailadmin-button-outline px-3 py-1.5 text-theme-xs">
        {loading ? "Mengirim..." : "Kirim ulang"}
      </button>
      {error ? <p className="mt-1 text-theme-xs text-error-600">{error}</p> : null}
    </div>
  );
}
