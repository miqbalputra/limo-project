"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirmDialog } from "@/components/dashboard/use-confirm-dialog";
import { requestJson } from "@/lib/api-json-client";

type UserAccountActionsProps = {
  userId: string;
  active: boolean;
  archived: boolean;
  lastLoginAt: string | null;
  isSelf: boolean;
  manageable: boolean;
};

export function UserAccountActions({ userId, active, archived, lastLoginAt, isSelf, manageable }: UserAccountActionsProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [link, setLink] = useState<{ label: string; url: string } | null>(null);
  const { confirm, dialog } = useConfirmDialog();

  const basePath = `/api/v1/admin/users/${userId}`;

  async function request(path: string, method: string, body?: unknown) {
    setError("");
    setLink(null);
    setIsSubmitting(true);

    try {
      const { data } = await requestJson<{ resetUrl?: string; activationUrl?: string }>(path, {
        method,
        body,
        fallbackMessage: "Aksi akun gagal",
      });

      if (data?.activationUrl) {
        setLink({ label: "Link aktivasi sementara", url: data.activationUrl });
      } else if (data?.resetUrl) {
        setLink({ label: "Link reset password sementara", url: data.resetUrl });
      }

      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aksi akun gagal");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmRequest(message: string, path: string, method: string, body?: unknown, variant: "status" | "destructive" = "status") {
    if (await confirm({ title: "Konfirmasi akun pengguna", description: message, confirmLabel: "Ya, lanjutkan", variant })) {
      void request(path, method, body);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {archived ? (
          <button type="button" disabled={isSubmitting} onClick={() => void confirmRequest("Pulihkan akun ini? Akses login akan diaktifkan kembali.", `${basePath}/restore`, "POST")} className="tailadmin-button-primary px-3 py-2">Pulihkan akun</button>
        ) : (
          <>
            {!isSelf ? <button type="button" disabled={isSubmitting} onClick={() => void confirmRequest(active ? "Nonaktifkan akun ini? Sesi aktif akan dicabut." : "Aktifkan akun ini?", `${basePath}/status`, "PATCH", { status: active ? "INACTIVE" : "ACTIVE" })} className="tailadmin-button-outline px-3 py-2">{active ? "Nonaktifkan" : "Aktifkan"}</button> : null}
            <button type="button" disabled={isSubmitting} onClick={() => void confirmRequest("Cabut semua sesi pengguna ini? Pengguna harus login ulang.", `${basePath}/sessions/revoke`, "POST")} className="tailadmin-button-outline px-3 py-2">Cabut sesi</button>
            {lastLoginAt ? (
              <button type="button" disabled={isSubmitting} onClick={() => void request(`${basePath}/reset-password`, "POST")} className="tailadmin-button-outline px-3 py-2">Kirim link reset password</button>
            ) : (
              <button type="button" disabled={isSubmitting} onClick={() => void request(`${basePath}/kirim-aktivasi`, "POST")} className="tailadmin-button-outline px-3 py-2">Kirim ulang aktivasi</button>
            )}
            {manageable && !isSelf ? <button type="button" disabled={isSubmitting} onClick={() => void confirmRequest("Arsipkan akun ini? Akun hilang dari daftar aktif dan seluruh sesinya dicabut.", basePath, "DELETE", undefined, "destructive")} className="tailadmin-button-outline px-3 py-2 text-error-700">Arsipkan</button> : null}
          </>
        )}
      </div>
      {link ? (
        <div className="mt-3 rounded-xl border border-warning-100 bg-warning-50 p-3 text-theme-xs text-warning-800">
          <p className="font-semibold">{link.label}</p>
          <a href={link.url} className="mt-1 block break-all underline">{link.url}</a>
          <p className="mt-1">Link ini berlaku terbatas. Jangan masukkan password ke link atau log.</p>
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-3 tailadmin-alert-error">{error}</p> : null}
      {dialog}
    </div>
  );
}
