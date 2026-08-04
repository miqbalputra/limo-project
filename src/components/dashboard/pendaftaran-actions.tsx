"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function postJson(path: string, body?: Record<string, string>) {
  const response = await fetch(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(payload.error?.message || "Aksi gagal diproses");
  }
}

export function PendaftaranActions({ id, disabled }: { id: string; disabled: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function approve() {
    if (!window.confirm("Setujui pendaftaran ini dan buat akun Wali?")) return;
    setMessage("");
    setIsSubmitting(true);

    try {
      await postJson(`/api/v1/admin/pendaftaran/${id}/approve`);
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Approval gagal");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function reject() {
    const reason = window.prompt("Masukkan alasan penolakan yang aman ditampilkan ke calon siswa");

    if (!reason) {
      return;
    }

    setMessage("");
    setIsSubmitting(true);

    try {
      await postJson(`/api/v1/admin/pendaftaran/${id}/reject`, { reason });
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Penolakan gagal");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={approve}
          disabled={disabled || isSubmitting}
          className="inline-flex rounded-lg bg-success-500 px-3 py-2 text-theme-xs font-semibold text-white transition-colors hover:bg-success-700 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={reject}
          disabled={disabled || isSubmitting}
          className="inline-flex rounded-lg bg-error-500 px-3 py-2 text-theme-xs font-semibold text-white transition-colors hover:bg-error-700 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
      {message ? <p className="text-theme-xs text-error-700">{message}</p> : null}
    </div>
  );
}
