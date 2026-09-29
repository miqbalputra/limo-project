"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useConfirmDialog } from "@/components/dashboard/use-confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { requestJson } from "@/lib/api-json-client";

type Option = { id: string; name: string };

export type TarifRow = {
  id: string;
  name: string;
  amount: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  programId: string | null;
  kelasId: string | null;
  siswaId: string | null;
};

export function TarifActions({ tarif, programs, kelas, siswa }: { tarif: TarifRow; programs: Option[]; kelas: Option[]; siswa: Option[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { confirm, dialog } = useConfirmDialog();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    setIsSubmitting(true);

    try {
      await requestJson(`/api/v1/admin/tarif/${tarif.id}`, {
        method: "PATCH",
        body: {
          name: String(data.get("name") || ""),
          programId: String(data.get("programId") || ""),
          kelasId: String(data.get("kelasId") || ""),
          siswaId: String(data.get("siswaId") || ""),
          amount: Number(data.get("amount") || 0),
          effectiveFrom: String(data.get("effectiveFrom") || ""),
          effectiveTo: String(data.get("effectiveTo") || ""),
        },
        fallbackMessage: "Tarif gagal diperbarui",
      });
      toast.success("Tarif berhasil diperbarui.");
      setEditing(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tarif gagal diperbarui");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleActive(nextActive: boolean) {
    const confirmed = await confirm({
      title: nextActive ? "Pulihkan tarif ini?" : "Arsipkan tarif ini?",
      description: nextActive
        ? "Tarif akan dipakai kembali saat tagihan bulanan dibuat."
        : "Tarif tidak lagi dipakai saat tagihan bulanan dibuat. Riwayatnya tetap tersimpan dan bisa dipulihkan.",
      confirmLabel: nextActive ? "Ya, pulihkan" : "Ya, arsipkan",
      variant: nextActive ? "status" : "destructive",
    });
    if (!confirmed) return;

    setError("");
    setIsSubmitting(true);
    try {
      await requestJson(nextActive ? `/api/v1/admin/tarif/${tarif.id}/restore` : `/api/v1/admin/tarif/${tarif.id}`, {
        method: nextActive ? "POST" : "DELETE",
        fallbackMessage: "Status tarif gagal diubah",
      });
      toast.success(nextActive ? "Tarif dipulihkan." : "Tarif diarsipkan.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status tarif gagal diubah");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (editing) {
    return (
      <div className="mt-3">
        <form onSubmit={submit} className="grid gap-2 rounded-xl border border-limo-blue-100 bg-limo-blue-50/40 p-3">
          <input name="name" required defaultValue={tarif.name} aria-label="Nama tarif" className="tailadmin-input min-h-11" />
          <div className="grid gap-2 sm:grid-cols-2">
            <select name="programId" defaultValue={tarif.programId || ""} aria-label="Program tarif" className="tailadmin-input min-h-11">
              <option value="">Tanpa program</option>
              {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
            </select>
            <select name="kelasId" defaultValue={tarif.kelasId || ""} aria-label="Kelas tarif" className="tailadmin-input min-h-11">
              <option value="">Tanpa kelas</option>
              {kelas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <input name="amount" required type="number" min={1} defaultValue={tarif.amount} aria-label="Nominal tarif" className="tailadmin-input min-h-11" />
          <select name="siswaId" defaultValue={tarif.siswaId || ""} aria-label="Siswa tarif" className="tailadmin-input min-h-11">
            <option value="">Tanpa siswa (berlaku per program/kelas)</option>
            {siswa.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="effectiveFrom" required type="date" defaultValue={tarif.effectiveFrom} aria-label="Berlaku dari" className="tailadmin-input min-h-11" />
            <input name="effectiveTo" type="date" defaultValue={tarif.effectiveTo ?? ""} aria-label="Berlaku sampai" className="tailadmin-input min-h-11" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={isSubmitting} className="tailadmin-button-primary min-h-11 px-3 py-2">{isSubmitting ? "Menyimpan..." : "Simpan perubahan"}</button>
            <button type="button" disabled={isSubmitting} onClick={() => { setEditing(false); setError(""); }} className="tailadmin-button-outline min-h-11 px-3 py-2">Batal</button>
          </div>
        </form>
        {error ? <p role="alert" className="mt-2 text-theme-xs text-error-700">{error}</p> : null}
        {dialog}
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setError(""); setEditing(true); }} className="tailadmin-button-outline min-h-11 px-3 py-2 text-theme-xs">Ubah</button>
        {tarif.isActive ? (
          <button type="button" disabled={isSubmitting} onClick={() => void toggleActive(false)} className="tailadmin-button-outline min-h-11 px-3 py-2 text-theme-xs text-error-700">Arsipkan</button>
        ) : (
          <button type="button" disabled={isSubmitting} onClick={() => void toggleActive(true)} className="tailadmin-button-primary min-h-11 px-3 py-2 text-theme-xs">Pulihkan</button>
        )}
      </div>
      {error ? <p role="alert" className="mt-2 text-theme-xs text-error-700">{error}</p> : null}
      {dialog}
    </div>
  );
}
