"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { requestJson } from "@/lib/api-json-client";

export function DiskusiThreadForm({ kelasId }: { kelasId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await requestJson("/api/v1/diskusi/threads", { method: "POST", body: { kelasId, title, content }, fallbackMessage: "Diskusi gagal dibuat" });
      setTitle("");
      setContent("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Diskusi gagal dibuat");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <p className="font-semibold text-gray-900">Mulai diskusi baru</p>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        required
        maxLength={200}
        placeholder="Judul pertanyaan atau topik"
        aria-label="Judul diskusi"
        dir="auto"
        className="tailadmin-input"
      />
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        required
        rows={4}
        maxLength={10000}
        placeholder="Tulis pertanyaan Anda secara rinci"
        aria-label="Isi diskusi"
        dir="auto"
        className="tailadmin-input min-h-28"
      />
      <div>
        <button type="submit" disabled={busy} className="tailadmin-button-primary px-4 py-2">
          {busy ? "Mengirim..." : "Buat diskusi"}
        </button>
      </div>
    </form>
  );
}
