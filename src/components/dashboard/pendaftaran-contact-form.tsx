"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { requestJson } from "@/lib/api-json-client";

export function PendaftaranContactForm({ id, email, phone }: { id: string; email: string; phone: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      await requestJson(`/api/v1/admin/pendaftaran/${id}`, {
        method: "PATCH",
        body: {
          waliEmail: String(form.get("waliEmail") || ""),
          waliPhone: String(form.get("waliPhone") || ""),
        },
        fallbackMessage: "Kontak gagal disimpan",
      });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kontak gagal disimpan");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-warning-200 bg-warning-50/60 p-4">
      <p className="text-theme-sm font-semibold text-warning-800">Email wali belum diisi. Lengkapi sebelum menyetujui pendaftaran (diperlukan untuk akun wali).</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="waliEmail" type="email" defaultValue={email} placeholder="Email wali" aria-label="Email wali" className="tailadmin-input" />
        <input name="waliPhone" type="tel" defaultValue={phone} placeholder="Nomor WhatsApp" aria-label="Nomor WhatsApp" className="tailadmin-input" />
      </div>
      {error ? <p role="alert" className="text-theme-xs font-semibold text-error-700">{error}</p> : null}
      <button type="submit" disabled={pending} className="tailadmin-button-primary px-4 py-2 text-theme-xs">{pending ? "Menyimpan..." : "Simpan Kontak"}</button>
    </form>
  );
}
