"use client";

import { FormEvent, useState } from "react";

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
      const response = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: String(data.get("currentPassword") || ""),
          newPassword: String(data.get("newPassword") || ""),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error?.message || "Password gagal diubah");
      }

      form.reset();
      setSuccess("Password berhasil diubah dan session lain telah dicabut.");
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
