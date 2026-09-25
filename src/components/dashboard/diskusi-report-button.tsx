"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { requestJson } from "@/lib/api-json-client";

export function DiskusiReportButton({ threadId, replyId, compact = false }: { threadId: string; replyId?: string; compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await requestJson("/api/v1/diskusi/report", {
        method: "POST",
        body: { threadId, replyId: replyId ?? "", alasan },
        fallbackMessage: "Laporan gagal dikirim",
      });
      setDone(true);
      setOpen(false);
      setAlasan("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Laporan gagal dikirim");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <span className="inline-flex items-center gap-1.5 text-theme-xs font-semibold text-success-700">Laporan terkirim</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={compact ? "text-theme-xs font-semibold text-gray-500 hover:text-error-700" : "text-theme-sm font-semibold text-gray-500 hover:text-error-700"}
      >
        Laporkan
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-2 rounded-2xl border border-gray-200 bg-gray-25 p-3">
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Alasan pelaporan
        <textarea
          value={alasan}
          onChange={(event) => setAlasan(event.target.value)}
          required
          minLength={5}
          maxLength={500}
          rows={2}
          placeholder="Jelaskan isi yang perlu ditinjau pengelola kelas"
          aria-label="Alasan pelaporan"
          dir="auto"
          className="mt-2 tailadmin-input"
        />
      </label>
      {error ? <p role="alert" className="text-theme-xs text-error-700">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy} className="tailadmin-button-outline px-3 py-1.5">{busy ? "Mengirim..." : "Kirim laporan"}</button>
        <button type="button" onClick={() => setOpen(false)} className="text-theme-sm font-semibold text-gray-500 hover:text-gray-700">Batal</button>
      </div>
    </form>
  );
}
