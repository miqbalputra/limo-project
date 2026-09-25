"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/api-json-client";
import { DiskusiReplyForm } from "@/components/dashboard/diskusi-reply-form";

function useModeration(endpoint: string) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function run(action: string) {
    setError("");
    setBusy(action);
    try {
      await requestJson(endpoint, { method: "POST", body: { action }, fallbackMessage: "Aksi moderasi gagal" });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aksi moderasi gagal");
    } finally {
      setBusy("");
    }
  }

  return { run, busy, error };
}

export function DiskusiThreadActions({
  threadId,
  status,
  isPinned,
  deleted,
}: {
  threadId: string;
  status: string;
  isPinned: boolean;
  deleted: boolean;
}) {
  const { run, busy, error } = useModeration(`/api/v1/diskusi/threads/${threadId}/moderate`);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={Boolean(busy)} onClick={() => void run(isPinned ? "unpin" : "pin")} className="tailadmin-button-outline px-3 py-1.5">{busy === (isPinned ? "unpin" : "pin") ? "Memproses..." : isPinned ? "Lepas sematan" : "Sematkan"}</button>
      <button type="button" disabled={Boolean(busy)} onClick={() => void run(status === "LOCKED" ? "unlock" : "lock")} className="tailadmin-button-outline px-3 py-1.5">{busy === (status === "LOCKED" ? "unlock" : "lock") ? "Memproses..." : status === "LOCKED" ? "Buka kunci" : "Kunci"}</button>
      {deleted ? (
        <button type="button" disabled={Boolean(busy)} onClick={() => void run("restore")} className="tailadmin-button-outline px-3 py-1.5">{busy === "restore" ? "Memproses..." : "Pulihkan"}</button>
      ) : (
        <>
          <button type="button" disabled={Boolean(busy)} onClick={() => void run("hide")} className="tailadmin-button-outline px-3 py-1.5">{busy === "hide" ? "Memproses..." : "Sembunyikan"}</button>
          <button type="button" disabled={Boolean(busy)} onClick={() => void run("softDelete")} className="tailadmin-button-outline px-3 py-1.5 text-error-700">{busy === "softDelete" ? "Memproses..." : "Hapus"}</button>
        </>
      )}
      {error ? <p role="alert" className="w-full text-theme-xs text-error-700">{error}</p> : null}
    </div>
  );
}

export function DiskusiReplyActions({
  replyId,
  threadId,
  isTeacherAnswer,
  manage,
  canReply = false,
}: {
  replyId: string;
  threadId: string;
  isTeacherAnswer: boolean;
  manage: boolean;
  canReply?: boolean;
}) {
  const { run, busy, error } = useModeration(`/api/v1/diskusi/replies/${replyId}/moderate`);
  const [replying, setReplying] = useState(false);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {manage ? (
          <>
            <button type="button" disabled={Boolean(busy)} onClick={() => void run("hide")} className="tailadmin-button-outline px-3 py-1.5">{busy === "hide" ? "Memproses..." : "Sembunyikan"}</button>
            <button type="button" disabled={Boolean(busy)} onClick={() => void run(isTeacherAnswer ? "unmarkTeacherAnswer" : "markTeacherAnswer")} className="tailadmin-button-outline px-3 py-1.5">{busy.startsWith("mark") || busy.startsWith("unmark") ? "Memproses..." : isTeacherAnswer ? "Lepas tanda jawaban guru" : "Tandai jawaban guru"}</button>
            <button type="button" disabled={Boolean(busy)} onClick={() => void run("softDelete")} className="tailadmin-button-outline px-3 py-1.5 text-error-700">{busy === "softDelete" ? "Memproses..." : "Hapus"}</button>
          </>
        ) : null}
        {canReply ? <button type="button" onClick={() => setReplying((value) => !value)} className="text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800">{replying ? "Tutup" : "Balas"}</button> : null}
        {error ? <p role="alert" className="w-full text-theme-xs text-error-700">{error}</p> : null}
      </div>
      {replying ? <div className="rounded-2xl border border-gray-200 bg-gray-25 p-4"><DiskusiReplyForm threadId={threadId} parentReplyId={replyId} compact onDone={() => setReplying(false)} /></div> : null}
    </div>
  );
}
