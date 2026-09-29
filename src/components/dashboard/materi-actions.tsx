"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useConfirmDialog } from "@/components/dashboard/use-confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { formatUiLabel } from "@/lib/ui-labels";
import { requestJson } from "@/lib/api-json-client";

type SesiOption = { id: string; label: string };

export type MateriSesiOption = SesiOption;

export type MateriEditValues = {
  id: string;
  title: string;
  type: string;
  status: string;
  content: string;
  videoUrl: string;
  language: string;
  direction: string;
  order: number;
  sesiKelasId: string;
};

export function MateriActions({ materi, sesiOptions }: { materi: MateriEditValues; sesiOptions: SesiOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirmDialog();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/v1/guru/materi/${materi.id}`, {
        method: "PUT",
        body: {
          title: String(data.get("title") || ""),
          type: String(data.get("type") || "TEXT"),
          sesiKelasId: String(data.get("sesiKelasId") || ""),
          content: String(data.get("content") || ""),
          videoUrl: String(data.get("videoUrl") || ""),
          language: String(data.get("language") || ""),
          direction: String(data.get("direction") || ""),
          status: String(data.get("status") || "DRAFT"),
          order: Number(data.get("order") || 0),
        },
        fallbackMessage: "Materi gagal diperbarui",
      });
      toast.success("Materi diperbarui.");
      setEditing(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Materi gagal diperbarui");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!(await confirm({ title: "Hapus materi?", description: "Materi dihapus permanen bila tidak memiliki berkas terlampir. Jika ada berkas, gunakan Arsipkan.", confirmLabel: "Ya, hapus", variant: "destructive" }))) return;
    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/v1/guru/materi/${materi.id}`, { method: "DELETE", fallbackMessage: "Materi gagal dihapus" });
      toast.success("Materi dihapus.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Materi gagal dihapus");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={save} className="mt-3 grid gap-2 rounded-xl border border-limo-blue-100 bg-limo-blue-50/40 p-3">
        <input name="title" required defaultValue={materi.title} aria-label="Judul materi" className="tailadmin-input" />
        <div className="grid gap-2 sm:grid-cols-2">
          <select name="type" defaultValue={materi.type} aria-label="Tipe materi" className="tailadmin-input">
            <option value="TEXT">{formatUiLabel("TEXT")}</option>
            <option value="PDF">{formatUiLabel("PDF")}</option>
            <option value="IMAGE">{formatUiLabel("IMAGE")}</option>
            <option value="VIDEO_LINK">{formatUiLabel("VIDEO_LINK")}</option>
          </select>
          <select name="sesiKelasId" defaultValue={materi.sesiKelasId} aria-label="Sesi materi" className="tailadmin-input">
            <option value="">Tanpa sesi spesifik</option>
            {sesiOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </div>
        <textarea name="content" defaultValue={materi.content} aria-label="Konten materi" className="tailadmin-input min-h-24" />
        <input name="videoUrl" dir="ltr" defaultValue={materi.videoUrl} aria-label="URL video" placeholder="https://..." className="tailadmin-input" />
        <div className="grid gap-2 sm:grid-cols-3">
          <input name="language" defaultValue={materi.language} aria-label="Bahasa materi" dir="auto" placeholder="id/ar/en" className="tailadmin-input" />
          <select name="direction" defaultValue={materi.direction} aria-label="Arah materi" className="tailadmin-input">
            <option value="">Otomatis</option>
            <option value="ltr">LTR</option>
            <option value="rtl">RTL Arab</option>
          </select>
          <select name="status" defaultValue={materi.status === "ARCHIVED" ? "DRAFT" : materi.status} aria-label="Status materi" className="tailadmin-input">
            <option value="DRAFT">{formatUiLabel("DRAFT")}</option>
            <option value="PUBLISHED">{formatUiLabel("PUBLISHED")}</option>
          </select>
        </div>
        <input name="order" type="number" min={0} defaultValue={materi.order} aria-label="Urutan materi" className="tailadmin-input" />
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="tailadmin-button-primary px-3 py-2 text-theme-xs">{busy ? "Menyimpan..." : "Simpan perubahan"}</button>
          <button type="button" disabled={busy} onClick={() => { setEditing(false); setError(""); }} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Batal</button>
        </div>
        {error ? <p role="alert" className="text-theme-xs text-error-700">{error}</p> : null}
      </form>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => { setError(""); setEditing(true); }} className="tailadmin-button-outline px-3 py-1.5 text-theme-xs">Ubah</button>
      <button type="button" disabled={busy} onClick={() => void remove()} className="inline-flex rounded-lg bg-error-50 px-3 py-1.5 text-theme-xs font-semibold text-error-700 hover:bg-error-100">Hapus</button>
      {error ? <p role="alert" className="w-full text-theme-xs text-error-700">{error}</p> : null}
      {dialog}
    </div>
  );
}
