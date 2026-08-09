"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/api-json-client";

export function ActivityViewButton({ classId, moduleId, itemId, disabled }: { classId: string; moduleId: string; itemId: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markViewed() {
    setBusy(true);
    try {
      await requestJson(`/api/v1/siswa/kelas/${classId}/modul/${moduleId}/items/${itemId}/view`, { method: "POST", fallbackMessage: "Aktivitas gagal ditandai" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return <button type="button" disabled={disabled || busy} onClick={() => void markViewed()} className="tailadmin-button-outline px-3 py-1.5 text-[11px]">{busy ? "Menyimpan..." : "Tandai dilihat"}</button>;
}
