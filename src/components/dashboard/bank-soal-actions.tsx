"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirmDialog } from "@/components/dashboard/use-confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { requestJson } from "@/lib/api-json-client";

export function BankSoalActions({ id, archived = false }: { id: string; archived?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const { confirm, dialog } = useConfirmDialog();

  async function run(key: string, action: () => Promise<unknown>, message: string) {
    setBusy(key);
    setError("");
    try {
      await action();
      toast.success(message);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aksi gagal diproses");
    } finally {
      setBusy("");
    }
  }

  async function duplicate() {
    await run("duplicate", () => requestJson(`/api/v1/bank-soal/${id}/duplicate`, { method: "POST", fallbackMessage: "Soal gagal diduplikat" }), "Soal berhasil diduplikat.");
  }

  async function archive() {
    if (!(await confirm({ title: "Arsipkan soal?", description: "Soal disembunyikan dari bank soal tetapi tidak dihapus. Bisa dipulihkan kapan saja.", confirmLabel: "Ya, arsipkan", variant: "destructive" }))) return;
    await run("archive", () => requestJson(`/api/v1/bank-soal/${id}/archive`, { method: "POST", fallbackMessage: "Soal gagal diarsipkan" }), "Soal diarsipkan.");
  }

  async function restore() {
    await run("restore", () => requestJson(`/api/v1/bank-soal/${id}/restore`, { method: "POST", fallbackMessage: "Soal gagal dipulihkan" }), "Soal dipulihkan.");
  }

  async function remove() {
    if (!(await confirm({ title: "Hapus soal?", description: "Soal dihapus permanen hanya bila belum dipakai ujian. Jika sudah dipakai, gunakan arsip.", confirmLabel: "Ya, hapus", variant: "destructive" }))) return;
    await run("delete", () => requestJson(`/api/v1/bank-soal/${id}`, { method: "DELETE", fallbackMessage: "Soal gagal dihapus" }), "Soal dihapus.");
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={`/guru/bank-soal/${id}/edit`} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Ubah</Link>
        <button type="button" disabled={Boolean(busy)} onClick={() => void duplicate()} className="tailadmin-button-outline px-3 py-2 text-theme-xs">{busy === "duplicate" ? "Memproses..." : "Duplikat"}</button>
        {archived ? (
          <button type="button" disabled={Boolean(busy)} onClick={() => void restore()} className="tailadmin-button-primary px-3 py-2 text-theme-xs">Pulihkan</button>
        ) : (
          <button type="button" disabled={Boolean(busy)} onClick={() => void archive()} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Arsipkan</button>
        )}
        <button type="button" disabled={Boolean(busy)} onClick={() => void remove()} className="inline-flex rounded-lg bg-error-50 px-3 py-2 text-theme-xs font-semibold text-error-700 hover:bg-error-100">Hapus</button>
        {error ? <p role="alert" className="w-full text-theme-xs text-error-700">{error}</p> : null}
      </div>
      {dialog}
    </>
  );
}
