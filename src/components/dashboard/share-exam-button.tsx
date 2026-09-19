"use client";

import { useState } from "react";
import { requestJson } from "@/lib/api-json-client";

export function ShareExamButton({ ujianId, hasToken }: { ujianId: string; hasToken: boolean }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate(regenerate = false) {
    setLoading(true);
    setError("");
    setCopied(false);

    try {
      const result = await requestJson<{ url: string }>(`/api/v1/ujian/${ujianId}/share`, {
        method: "POST",
        body: { regenerate },
        fallbackMessage: "Gagal membuat tautan kuis",
      });
      setUrl(new URL(result.data.url, window.location.origin).toString());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal membuat tautan kuis");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Tidak dapat menyalin otomatis. Salin tautan secara manual.");
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void generate(false)} disabled={loading} className="tailadmin-button-outline px-4 py-2">
          {loading ? "Menyiapkan..." : hasToken || url ? "Lihat tautan kuis" : "Bagikan kuis"}
        </button>
        {url ? (
          <button type="button" onClick={() => void generate(true)} className="tailadmin-button-outline px-4 py-2 text-theme-xs">Buat ulang tautan</button>
        ) : null}
      </div>
      {url ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2">
          <input readOnly value={url} aria-label="Tautan kuis" className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-theme-xs" />
          <button type="button" onClick={() => void copy()} className="tailadmin-button-primary px-3 py-2 text-theme-xs">{copied ? "Tersalin" : "Salin"}</button>
          <a href={url} target="_blank" rel="noreferrer" className="tailadmin-button-outline px-3 py-2 text-theme-xs">Buka</a>
        </div>
      ) : null}
      {error ? <p className="tailadmin-alert-error">{error}</p> : null}
      <p className="text-theme-xs text-gray-500">Tautan bisa dibuka tanpa login dan mengikuti pengaturan kuis (terbit, waktu, dan penilaian).</p>
    </div>
  );
}
