"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { requestJson } from "@/lib/api-json-client";

export function DiskusiAttachmentForm({ threadId }: { threadId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.querySelector<HTMLInputElement>('input[type="file"]');
    const file = input?.files?.[0];
    if (!file) {
      setError("Pilih berkas terlebih dahulu");
      return;
    }

    setError("");
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      await requestJson(`/api/v1/diskusi/threads/${threadId}/attachments`, { method: "POST", body: formData, fallbackMessage: "Gagal mengunggah lampiran" });
      input.value = "";
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mengunggah lampiran");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-2">
      <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Lampirkan berkas</p>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-theme-sm font-semibold text-gray-700 hover:bg-gray-50">
        <input type="file" name="file" className="hidden" disabled={busy} />
        Pilih berkas
      </label>
      <div>
        <button type="submit" disabled={busy} className="tailadmin-button-outline px-4 py-2">
          {busy ? "Mengunggah..." : "Unggah lampiran"}
        </button>
      </div>
    </form>
  );
}

export function DiskusiReplyAttachmentForm({ replyId }: { replyId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setError("");
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      await requestJson(`/api/v1/diskusi/replies/${replyId}/attachments`, { method: "POST", body: formData, fallbackMessage: "Gagal mengunggah lampiran" });
      input.value = "";
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mengunggah lampiran");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-1">
      {error ? <p role="alert" className="text-theme-xs text-error-700">{error}</p> : null}
      <label className="inline-flex w-fit cursor-pointer items-center rounded-xl border border-gray-200 px-3 py-1.5 text-theme-xs font-semibold text-gray-700 hover:bg-gray-50">
        <input type="file" className="hidden" disabled={busy} onChange={(event) => void onChange(event)} />
        {busy ? "Mengunggah..." : "Lampirkan berkas"}
      </label>
    </div>
  );
}

export function DiskusiReplyAttachmentRemoveButton({ replyId, fileId }: { replyId: string; fileId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setError("");
          setBusy(true);
          try {
            await requestJson(`/api/v1/diskusi/replies/${replyId}/attachments/${fileId}/remove`, { method: "DELETE", fallbackMessage: "Gagal menghapus lampiran" });
            router.refresh();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Gagal menghapus lampiran");
          } finally {
            setBusy(false);
          }
        }}
        className="text-theme-xs font-semibold text-error-700 hover:text-error-800"
      >
        {busy ? "Menghapus..." : "Hapus lampiran"}
      </button>
      {error ? <span role="alert" className="text-theme-xs text-error-700">{error}</span> : null}
    </span>
  );
}

export function DiskusiAttachmentRemoveButton({ threadId, fileId }: { threadId: string; fileId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setError("");
          setBusy(true);
          try {
            await requestJson(`/api/v1/diskusi/threads/${threadId}/attachments/${fileId}/remove`, { method: "DELETE", fallbackMessage: "Gagal menghapus lampiran" });
            router.refresh();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Gagal menghapus lampiran");
          } finally {
            setBusy(false);
          }
        }}
        className="text-theme-xs font-semibold text-error-700 hover:text-error-800"
      >
        {busy ? "Menghapus..." : "Hapus"}
      </button>
      {error ? <span role="alert" className="text-theme-xs text-error-700">{error}</span> : null}
    </span>
  );
}
