"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { PasswordField } from "@/components/dashboard/password-field";
import { useConfirmDialog } from "@/components/dashboard/use-confirm-dialog";
import { requestJson } from "@/lib/api-json-client";

export function SetPasswordPanel({ endpoint }: { endpoint: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { confirm, dialog } = useConfirmDialog();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") || "");
    const reason = String(data.get("reason") || "");

    setError("");
    setMessage("");

    const confirmed = await confirm({
      title: "Ubah password akun ini?",
      description: "Semua sesi pengguna akan dicabut dan pengguna harus login ulang memakai password baru.",
      confirmLabel: "Ya, ubah password",
      variant: "destructive",
    });
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      await requestJson(endpoint, { method: "POST", body: { password, reason }, fallbackMessage: "Password gagal diubah" });
      form.reset();
      setOpen(false);
      setMessage("Password diperbarui. Semua sesi pengguna dicabut.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Password gagal diubah");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      {open ? (
        <form onSubmit={submit} className="grid gap-3">
          <PasswordField name="password" label="Password baru" required hint="Minimal 8 karakter. Password tidak ditampilkan lagi setelah disimpan." />
          <label className="grid gap-1">
            <span className="text-theme-xs font-medium text-gray-600">Alasan perubahan (opsional)</span>
            <input name="reason" maxLength={500} aria-label="Alasan perubahan password" className="tailadmin-input min-h-11" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={isSubmitting} className="tailadmin-button-primary min-h-11 px-3 py-2">{isSubmitting ? "Menyimpan..." : "Simpan password"}</button>
            <button type="button" disabled={isSubmitting} onClick={() => { setOpen(false); setError(""); }} className="tailadmin-button-outline min-h-11 px-3 py-2">Batal</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => { setMessage(""); setOpen(true); }} className="tailadmin-button-outline min-h-11 px-3 py-2">Ubah password</button>
      )}
      {message ? <p role="status" className="mt-2 text-theme-xs font-semibold text-success-700">{message}</p> : null}
      {error ? <p role="alert" className="mt-2 text-theme-xs text-error-700">{error}</p> : null}
      {dialog}
    </div>
  );
}
