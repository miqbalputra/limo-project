"use client";

import { FormEvent, useState } from "react";
import { requestJson } from "@/lib/api-json-client";

export function ChangePasswordForm() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);
    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      await requestJson("/api/v1/auth/change-password", {
        method: "POST",
        body: {
          currentPassword: String(data.get("currentPassword") || ""),
          newPassword: String(data.get("newPassword") || ""),
        },
        fallbackMessage: "Password gagal diubah",
      });

      form.reset();
      setSuccess("Kata sandi berhasil diubah dan sesi lain telah dicabut.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Password gagal diubah");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="tailadmin-card grid max-w-xl gap-4 p-5">
      {error ? <p className="tailadmin-alert-error">{error}</p> : null}
      {success ? <p className="tailadmin-alert-success">{success}</p> : null}
      <label className="text-theme-sm font-medium text-gray-700">
        Password Saat Ini
        <input name="currentPassword" type="password" required minLength={8} autoComplete="current-password" className="tailadmin-input mt-2" />
      </label>
      <label className="text-theme-sm font-medium text-gray-700">
        Password Baru
        <input name="newPassword" type="password" required minLength={8} autoComplete="new-password" className="tailadmin-input mt-2" />
      </label>
      <button type="submit" disabled={isSubmitting} className="tailadmin-button-primary">
        {isSubmitting ? "Menyimpan..." : "Ubah Password"}
      </button>
    </form>
  );
}
