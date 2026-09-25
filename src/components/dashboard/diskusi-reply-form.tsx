"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { requestJson } from "@/lib/api-json-client";

export function DiskusiReplyForm({
  threadId,
  parentReplyId,
  compact = false,
  onDone,
}: {
  threadId: string;
  parentReplyId?: string;
  compact?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await requestJson(`/api/v1/diskusi/threads/${threadId}/replies`, {
        method: "POST",
        body: { content, parentReplyId: parentReplyId ?? "" },
        fallbackMessage: "Balasan gagal dikirim",
      });
      setContent("");
      router.refresh();
      onDone?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Balasan gagal dikirim");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={compact ? "grid gap-2" : "grid gap-3"}>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        required
        rows={compact ? 2 : 4}
        maxLength={10000}
        placeholder={compact ? "Tulis balasan Anda" : "Tulis pertanyaan atau tanggapan Anda"}
        aria-label="Isi balasan"
        dir="auto"
        className="tailadmin-input"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy} className="tailadmin-button-primary px-4 py-2">
          {busy ? "Mengirim..." : "Kirim balasan"}
        </button>
        {onDone ? <button type="button" onClick={onDone} className="text-theme-sm font-semibold text-gray-500 hover:text-gray-700">Batal</button> : null}
      </div>
    </form>
  );
}
