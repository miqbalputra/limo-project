"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { requestJson } from "@/lib/api-json-client";
import { formatRupiah } from "@/lib/money";

async function sendJson(path: string, method: "POST" | "PATCH" | "DELETE", body?: Record<string, unknown>) {
  return requestJson(path, { method, body, fallbackMessage: "Data voucher gagal diproses" });
}

export function VoucherForm({ programs, kelas }: { programs: { id: string; name: string }[]; kelas: { id: string; name: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body: Record<string, unknown> = {
      code: String(data.get("code") || ""),
      description: String(data.get("description") || ""),
      discountType: String(data.get("discountType") || "PERCENT"),
      discountValue: Number(data.get("discountValue") || 0),
      programId: String(data.get("programId") || ""),
      kelasId: String(data.get("kelasId") || ""),
    };
    const minAmount = Number(data.get("minAmount") || 0);
    if (minAmount > 0) body.minAmount = minAmount;
    const maxUses = Number(data.get("maxUses") || 0);
    if (maxUses > 0) body.maxUses = maxUses;
    const validFrom = String(data.get("validFrom") || "");
    if (validFrom) body.validFrom = validFrom;
    const validUntil = String(data.get("validUntil") || "");
    if (validUntil) body.validUntil = validUntil;

    setError("");
    setSuccess("");
    setIsSubmitting(true);
    try {
      await sendJson("/api/v1/admin/voucher", "POST", body);
      form.reset();
      setSuccess("Voucher berhasil dibuat.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Voucher gagal disimpan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="tailadmin-card grid gap-3 p-5">
      <div>
        <h2 className="font-semibold text-gray-900">Tambah Voucher</h2>
        <p className="mt-1 text-theme-xs leading-5 text-gray-500">Voucher dapat dipakai Wali saat melunasi tagihan yang belum dibayar.</p>
      </div>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      {success ? <p role="status" className="rounded-xl border border-success-100 bg-success-50 px-4 py-3 text-theme-sm text-success-800">{success}</p> : null}
      <input name="code" required placeholder="Kode voucher (mis. AWAL25)" className="tailadmin-input uppercase" />
      <input name="description" placeholder="Keterangan (opsional)" className="tailadmin-input" />
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="programId" aria-label="Cakupan program" className="tailadmin-input">
          <option value="">Semua program</option>
          {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
        </select>
        <select name="kelasId" aria-label="Cakupan kelas" className="tailadmin-input">
          <option value="">Semua kelas</option>
          {kelas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="discountType" className="tailadmin-input" aria-label="Jenis diskon">
          <option value="PERCENT">Persen (%)</option>
          <option value="FIXED">Nominal (Rp)</option>
        </select>
        <input name="discountValue" required type="number" min={1} step="any" placeholder="Nilai diskon" className="tailadmin-input" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="minAmount" type="number" min={0} placeholder="Minimal tagihan (opsional)" className="tailadmin-input" />
        <input name="maxUses" type="number" min={1} placeholder="Kuota pemakaian (opsional)" className="tailadmin-input" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-theme-xs font-medium text-gray-500">Berlaku dari<input name="validFrom" type="date" className="tailadmin-input mt-1" /></label>
        <label className="grid gap-1 text-theme-xs font-medium text-gray-500">Berlaku sampai<input name="validUntil" type="date" className="tailadmin-input mt-1" /></label>
      </div>
      <button disabled={isSubmitting} className="tailadmin-button-primary">{isSubmitting ? "Menyimpan..." : "Simpan Voucher"}</button>
    </form>
  );
}

export function VoucherToggleButton({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setError("");
    setIsSubmitting(true);
    try {
      await sendJson(`/api/v1/admin/voucher/${id}`, "PATCH", { isActive: !isActive });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status voucher gagal diubah");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => void toggle()} disabled={isSubmitting} className="tailadmin-button-outline px-3 py-1 text-theme-xs">
        {isSubmitting ? "Memproses..." : isActive ? "Arsipkan" : "Aktifkan"}
      </button>
      {error ? <p className="mt-1 text-theme-xs text-error-700">{error}</p> : null}
    </div>
  );
}

export function VoucherApplyForm({ tagihanId, subtotal, discountAmount, voucherCode, disabled }: { tagihanId: string; subtotal: number | null; discountAmount: number; voucherCode: string | null; disabled: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.trim();
    if (!normalized) {
      setError("Kode voucher wajib diisi.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await sendJson(`/api/v1/tagihan/${tagihanId}/voucher`, "POST", { code: normalized });
      setCode("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Voucher gagal dipakai");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function remove() {
    setError("");
    setIsSubmitting(true);
    try {
      await sendJson(`/api/v1/tagihan/${tagihanId}/voucher`, "DELETE");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Voucher gagal dilepas");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (voucherCode) {
    return (
      <div className="mt-3 rounded-xl border border-success-100 bg-success-50 p-3 text-theme-xs text-success-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Voucher {voucherCode} diterapkan</p>
          <span className="font-semibold">- {formatRupiah(discountAmount)}</span>
        </div>
        {subtotal !== null ? <p className="mt-1">Harga normal {formatRupiah(subtotal)}</p> : null}
        {error ? <p className="mt-1 text-error-700">{error}</p> : null}
        {!disabled ? (
          <button type="button" onClick={() => void remove()} disabled={isSubmitting} className="mt-2 font-semibold text-error-700 underline disabled:opacity-50">
            {isSubmitting ? "Memproses..." : "Lepas voucher"}
          </button>
        ) : null}
      </div>
    );
  }

  if (disabled) return null;

  return (
    <form onSubmit={apply} className="mt-3">
      <label className="grid gap-1 text-theme-xs font-medium text-gray-500">
        Punya kode voucher?
        <span className="flex flex-wrap gap-2">
          <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Masukkan kode" className="tailadmin-input min-w-0 flex-1 py-2 uppercase" maxLength={32} />
          <button type="submit" disabled={isSubmitting} className="tailadmin-button-outline shrink-0 px-3 py-2 text-theme-xs">{isSubmitting ? "..." : "Pakai"}</button>
        </span>
      </label>
      {error ? <p className="mt-1 text-theme-xs text-error-700">{error}</p> : null}
    </form>
  );
}
