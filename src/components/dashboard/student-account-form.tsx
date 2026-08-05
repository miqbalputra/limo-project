"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Account = {
  id: string;
  loginIdentifier: string;
  contactEmail: string | null;
  status: "PENDING" | "ACTIVE" | "INACTIVE";
  activatedAt: Date | null;
  lastLoginAt: Date | null;
  user: { email: string; status: "ACTIVE" | "INACTIVE" };
} | null;

export function StudentAccountForm({ studentId, studentName, defaultIdentifier, account }: { studentId: string; studentName: string; defaultIdentifier: string; account: Account }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [activationUrl, setActivationUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function request(path: string, options: RequestInit) {
    const response = await fetch(path, options);
    const payload = await response.json().catch(() => ({})) as { data?: { activationUrl?: string }; error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message || "Aksi akun siswa gagal");
    if (payload.data?.activationUrl) setActivationUrl(payload.data.activationUrl);
    router.refresh();
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    try {
      await request(`/api/v1/admin/siswa/${studentId}/akun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(formData.get("email") || ""), loginIdentifier: String(formData.get("loginIdentifier") || "") }),
      });
      event.currentTarget.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Akun siswa gagal dibuat");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendActivation() {
    setError("");
    setIsSubmitting(true);
    try {
      await request(`/api/v1/admin/siswa/${studentId}/akun/kirim-aktivasi`, { method: "POST" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aktivasi gagal dikirim ulang");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateStatus(status: "ACTIVE" | "INACTIVE") {
    setError("");
    setIsSubmitting(true);
    try {
      await request(`/api/v1/admin/siswa/${studentId}/akun/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status akun gagal diubah");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="tailadmin-card p-5">
      <div>
        <h2 className="font-semibold text-gray-900">Akun Siswa</h2>
        <p className="mt-1 text-theme-xs text-gray-500">Buat akses portal untuk {studentName}. Password tidak dibuat atau ditampilkan oleh Admin.</p>
      </div>
      {error ? <p role="alert" className="mt-4 tailadmin-alert-error">{error}</p> : null}
      {!account ? (
        <form onSubmit={createAccount} className="mt-4 space-y-3">
          <input name="email" type="email" placeholder="Email siswa (opsional)" className="tailadmin-input" />
          <input name="loginIdentifier" defaultValue={defaultIdentifier} required placeholder="Nomor induk / identifier login" className="tailadmin-input" />
          <button disabled={isSubmitting} className="tailadmin-button-primary w-full">{isSubmitting ? "Membuat..." : "Buat Akun Siswa"}</button>
        </form>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-gray-50 p-3 text-theme-sm">
            <p className="font-semibold text-gray-800">Identifier: {account.loginIdentifier}</p>
            <p className="mt-1 text-theme-xs text-gray-500">Kontak: {account.contactEmail || "Tidak ada email, gunakan identifier"}</p>
            <p className="mt-1 text-theme-xs text-gray-500">Status: {account.status}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {account.status === "PENDING" ? <button type="button" onClick={resendActivation} disabled={isSubmitting} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Kirim Ulang Aktivasi</button> : null}
            {account.status === "INACTIVE" ? <button type="button" onClick={() => updateStatus("ACTIVE")} disabled={isSubmitting} className="tailadmin-button-primary px-3 py-2 text-theme-xs">Aktifkan</button> : null}
            {account.status === "ACTIVE" ? <button type="button" onClick={() => updateStatus("INACTIVE")} disabled={isSubmitting} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Nonaktifkan</button> : null}
          </div>
        </div>
      )}
      {activationUrl ? <div className="mt-4 rounded-xl border border-warning-100 bg-warning-50 p-3 text-theme-xs text-warning-800"><p className="font-semibold">Link aktivasi sementara</p><a href={activationUrl} className="mt-1 block break-all underline">{activationUrl}</a><p className="mt-1">Link ini berlaku terbatas. Jangan masukkan password ke link atau log.</p></div> : null}
    </section>
  );
}
