"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/api-json-client";
import { PengumumanForm, type PengumumanValues } from "@/components/dashboard/pengumuman-form";

export function PengumumanActions({
  id,
  kelasId,
  status,
  initial,
}: {
  id: string;
  kelasId: string;
  status: string;
  initial: PengumumanValues;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function changeStatus(next: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    setError("");
    setBusy(next);
    try {
      await requestJson(`/api/v1/pengumuman/${id}/status`, { method: "POST", body: { status: next }, fallbackMessage: "Status pengumuman gagal diubah" });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status pengumuman gagal diubah");
    } finally {
      setBusy("");
    }
  }

  if (editing) {
    return <div className="rounded-2xl border border-gray-200 bg-gray-25 p-4"><PengumumanForm kelasId={kelasId} id={id} initial={initial} onCancel={() => setEditing(false)} /></div>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setEditing(true)} className="tailadmin-button-outline px-3 py-1.5">Ubah</button>
      {status === "DRAFT" ? <button type="button" disabled={Boolean(busy)} onClick={() => void changeStatus("PUBLISHED")} className="tailadmin-button-primary px-3 py-1.5">{busy === "PUBLISHED" ? "Memproses..." : "Terbitkan"}</button> : null}
      {status === "PUBLISHED" ? (
        <>
          <button type="button" disabled={Boolean(busy)} onClick={() => void changeStatus("DRAFT")} className="tailadmin-button-outline px-3 py-1.5">{busy === "DRAFT" ? "Memproses..." : "Jadikan draf"}</button>
          <button type="button" disabled={Boolean(busy)} onClick={() => void changeStatus("ARCHIVED")} className="tailadmin-button-outline px-3 py-1.5">{busy === "ARCHIVED" ? "Memproses..." : "Arsipkan"}</button>
        </>
      ) : null}
      {status === "ARCHIVED" ? <button type="button" disabled={Boolean(busy)} onClick={() => void changeStatus("PUBLISHED")} className="tailadmin-button-outline px-3 py-1.5">{busy === "PUBLISHED" ? "Memproses..." : "Pulihkan"}</button> : null}
      {error ? <p role="alert" className="w-full text-theme-xs text-error-700">{error}</p> : null}
    </div>
  );
}
