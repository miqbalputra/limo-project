"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirmDialog } from "@/components/dashboard/use-confirm-dialog";

export function UserActions({ userId, active, isSelf }: { userId: string; active: boolean; isSelf: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { confirm, dialog } = useConfirmDialog();

  async function request(path: string, method: string, body?: unknown) {
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Aksi gagal");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aksi gagal");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmRequest(message: string, path: string, method: string, body?: unknown) {
    if (await confirm({ title: "Konfirmasi aksi pengguna", description: message, confirmLabel: "Ya, lanjutkan", variant: "destructive" })) {
      void request(path, method, body);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {!isSelf ? <button disabled={isSubmitting} onClick={() => void confirmRequest(active ? "Nonaktifkan akun ini? Sesi aktif akan dicabut." : "Aktifkan akun ini?", `/api/v1/admin/users/${userId}/status`, "PATCH", { status: active ? "INACTIVE" : "ACTIVE" })} className="tailadmin-button-outline px-3 py-2">{active ? "Nonaktifkan" : "Aktifkan"}</button> : null}
      <button disabled={isSubmitting} onClick={() => void confirmRequest("Cabut semua sesi pengguna ini? Pengguna harus login ulang.", `/api/v1/admin/users/${userId}/sessions/revoke`, "POST")} className="tailadmin-button-outline px-3 py-2">Cabut sesi</button>
      {error ? <p className="w-full text-theme-xs text-error-700">{error}</p> : null}
      {dialog}
    </div>
  );
}
