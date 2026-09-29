"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { requestJson } from "@/lib/api-json-client";
import { formatRupiah } from "@/lib/money";

type Option = { id: string; name: string };
type InvoiceGenerationInput = { period: string; dueDate: string; jenis: string; dryRun: boolean; amountOverride?: number; extraFee?: number };
type InvoiceGenerationResult = { created: number; skipped: number; failed: number; failures: string[]; dryRun: boolean };

async function postJson(path: string, body: Record<string, string | number | boolean>) {
  await requestJson(path, { method: "POST", body, fallbackMessage: "Data gagal diproses" });
}

export function TarifForm({ programs, kelas, siswa }: { programs: Option[]; kelas: Option[]; siswa: Option[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      await postJson("/api/v1/admin/tarif", {
        name: String(data.get("name") || ""),
        programId: String(data.get("programId") || ""),
        kelasId: String(data.get("kelasId") || ""),
        siswaId: String(data.get("siswaId") || ""),
        amount: Number(data.get("amount") || 0),
        effectiveFrom: String(data.get("effectiveFrom") || ""),
        effectiveTo: String(data.get("effectiveTo") || ""),
      });
      form.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tarif gagal disimpan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="tailadmin-card grid gap-3 p-5">
      <h2 className="font-semibold text-gray-900">Tambah Tarif</h2>
      <p className="text-theme-xs text-gray-500">Tarif khusus <strong>siswa</strong> mengalahkan tarif kelas, dan tarif kelas mengalahkan tarif program.</p>
      {error ? <p className="tailadmin-alert-error">{error}</p> : null}
      <input name="name" required placeholder="Nama tarif" className="tailadmin-input" />
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="programId" className="tailadmin-input">
          <option value="">Pilih program</option>
          {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
        </select>
        <select name="kelasId" className="tailadmin-input">
          <option value="">Opsional kelas spesifik</option>
          {kelas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      <select name="siswaId" aria-label="Siswa tarif" className="tailadmin-input">
        <option value="">Opsional siswa spesifik (khusus anak ini)</option>
        {siswa.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <input name="amount" required type="number" min={1} placeholder="Nominal" className="tailadmin-input" />
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="effectiveFrom" required type="date" className="tailadmin-input" />
        <input name="effectiveTo" type="date" className="tailadmin-input" />
      </div>
      <button disabled={isSubmitting} className="tailadmin-button-primary">
        {isSubmitting ? "Menyimpan..." : "Simpan Tarif"}
      </button>
    </form>
  );
}

export function GenerateInvoiceForm({ defaultPeriod, academicLabel }: { defaultPeriod?: string; academicLabel?: string | null } = {}) {
  const router = useRouter();
  const [preview, setPreview] = useState<{ input: InvoiceGenerationInput; result: InvoiceGenerationResult } | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  async function requestGeneration(input: InvoiceGenerationInput) {
    const response = await requestJson<InvoiceGenerationResult>("/api/v1/admin/tagihan/generate", { method: "POST", body: input, fallbackMessage: "Pembuatan tagihan gagal diproses" });
    return response.data;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amountOverrideRaw = String(data.get("amountOverride") || "").trim();
    const extraFeeRaw = String(data.get("extraFee") || "").trim();
    const input: InvoiceGenerationInput = {
      period: String(data.get("period") || ""),
      dueDate: String(data.get("dueDate") || ""),
      jenis: String(data.get("jenis") || "SPP"),
      dryRun: true,
      ...(amountOverrideRaw ? { amountOverride: Number(amountOverrideRaw) } : {}),
      ...(extraFeeRaw ? { extraFee: Number(extraFeeRaw) } : {}),
    };
    setError("");
    setSuccess("");
    setPreview(null);
    setIsSubmitting(true);

    try {
      const result = await requestGeneration(input);
      setPreview({ input, result });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pratinjau tagihan gagal diproses");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmGeneration() {
    if (!preview) return;

    setError("");
    setIsSubmitting(true);
    try {
      const result = await requestGeneration({ ...preview.input, dryRun: false });
      setIsConfirmOpen(false);
      setPreview(null);
      setSuccess(`${result.created} tagihan berhasil dibuat, ${result.skipped} dilewati, dan ${result.failed} gagal diproses.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pembuatan tagihan gagal diproses");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} onInput={() => { if (preview) setPreview(null); }} className="tailadmin-card grid gap-3 p-5">
        <div><h2 className="font-semibold text-gray-900">Buat Tagihan Bulanan</h2><p className="mt-1 text-theme-xs leading-5 text-gray-500">Langkah pertama selalu pratinjau. Tagihan baru dibuat setelah Anda meninjau hasil dan mengonfirmasi.</p>{academicLabel ? <p className="mt-1 text-theme-xs font-semibold text-limo-blue-700">Tahun ajaran aktif: {academicLabel}</p> : null}</div>
        {error && !isConfirmOpen ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
        {success ? <p role="status" className="rounded-xl border border-success-100 bg-success-50 px-4 py-3 text-theme-sm text-success-800">{success}</p> : null}
        <input name="period" required type="month" defaultValue={defaultPeriod} aria-label="Periode tagihan" className="tailadmin-input" />
        <input name="dueDate" required type="date" aria-label="Tanggal jatuh tempo" className="tailadmin-input" />
        <input name="jenis" defaultValue="SPP" aria-label="Jenis tagihan" className="tailadmin-input" />
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="amountOverride" type="number" min={1} aria-label="Nominal khusus" placeholder="Nominal khusus (opsional)" className="tailadmin-input" />
          <input name="extraFee" type="number" aria-label="Biaya tambahan" placeholder="Biaya tambahan (opsional, boleh minus)" className="tailadmin-input" />
        </div>
        <p className="text-theme-xs text-gray-500">Kosongkan keduanya untuk memakai tarif. Nominal khusus menggantikan tarif; biaya tambahan ditambahkan di atasnya (isi minus untuk potongan).</p>
        <button disabled={isSubmitting} className="tailadmin-button-primary">
          {isSubmitting ? "Meninjau..." : "Tinjau tagihan"}
        </button>
        {preview ? <section aria-live="polite" className="rounded-xl border border-limo-blue-100 bg-limo-blue-50 p-4"><p className="font-semibold text-limo-blue-800">Tinjau sebelum membuat tagihan</p><p className="mt-1 text-theme-sm text-limo-blue-700">Periode {preview.input.period} / {preview.input.jenis}. Tidak ada data yang diubah pada tahap ini.</p>{preview.input.amountOverride !== undefined || preview.input.extraFee ? <p className="mt-1 text-theme-sm font-semibold text-limo-blue-800">Penyesuaian: {preview.input.amountOverride !== undefined ? `nominal khusus ${formatRupiah(preview.input.amountOverride)}` : "memakai tarif"}{preview.input.extraFee ? ` ${preview.input.extraFee > 0 ? "ditambah" : "dikurangi"} ${formatRupiah(Math.abs(preview.input.extraFee))}` : ""}.</p> : null}<div className="mt-3 grid grid-cols-3 gap-2 text-center"><ReviewStat label="Siap dibuat" value={preview.result.created} /><ReviewStat label="Dilewati" value={preview.result.skipped} /><ReviewStat label="Perlu dicek" value={preview.result.failed} /></div>{preview.result.failures.length > 0 ? <ul className="mt-3 list-disc space-y-1 pl-5 text-theme-xs text-limo-blue-700">{preview.result.failures.slice(0, 5).map((failure) => <li key={failure}>{failure}</li>)}</ul> : null}{preview.result.created > 0 ? <button type="button" onClick={() => setIsConfirmOpen(true)} disabled={isSubmitting} className="mt-4 inline-flex rounded-lg bg-limo-blue-500 px-4 py-2.5 text-theme-sm font-semibold text-white hover:bg-limo-blue-600 disabled:cursor-not-allowed disabled:opacity-50">Buat {preview.result.created} tagihan</button> : <p className="mt-3 text-theme-xs text-limo-blue-700">Tidak ada tagihan baru yang dapat dibuat dari pratinjau ini.</p>}</section> : null}
      </form>
      <ConfirmDialog open={isConfirmOpen} title="Buat tagihan dari hasil tinjauan?" description={preview ? <>Sistem akan membuat hingga <strong>{preview.result.created} tagihan</strong> untuk periode {preview.input.period}. Proses ini mengirim notifikasi kepada Wali untuk tagihan baru.</> : ""} confirmLabel="Ya, buat tagihan" variant="destructive" isBusy={isSubmitting} error={error} onClose={() => { if (!isSubmitting) { setIsConfirmOpen(false); setError(""); } }} onConfirm={() => void confirmGeneration()} />
    </>
  );
}

function ReviewStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg bg-white/80 p-2"><p className="text-lg font-semibold text-gray-900">{value}</p><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p></div>;
}

export function ReconcilePaymentButton({ tagihanId, disabled }: { tagihanId: string; disabled: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function reconcile() {
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      setMessage("Alasan rekonsiliasi wajib diisi.");
      return;
    }

    setMessage("");
    setIsSubmitting(true);

    try {
      await postJson("/api/v1/admin/pembayaran/reconcile", { tagihanId, reason: normalizedReason });
      setIsConfirmOpen(false);
      setReason("");
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Rekonsiliasi gagal");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="mt-2">
        <button
          type="button"
          onClick={() => { setMessage(""); setIsConfirmOpen(true); }}
          disabled={disabled || isSubmitting}
          className="tailadmin-button-outline px-3 py-1 text-theme-xs"
        >
          {isSubmitting ? "Memproses..." : "Rekonsiliasi manual"}
        </button>
        {message && !isConfirmOpen ? <p className="mt-1 text-theme-xs text-error-700">{message}</p> : null}
      </div>
      <ConfirmDialog open={isConfirmOpen} title="Tandai tagihan lunas secara manual?" description="Pastikan pembayaran sudah diverifikasi. Tindakan ini akan mengubah status tagihan menjadi lunas." confirmLabel="Ya, tandai lunas" variant="status" isBusy={isSubmitting} error={message} onClose={() => { if (!isSubmitting) { setIsConfirmOpen(false); setMessage(""); } }} onConfirm={() => void reconcile()}>
        <label className="grid gap-1.5 text-theme-sm font-medium text-gray-700">
          Alasan rekonsiliasi
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} placeholder="Contoh: pembayaran tunai sudah diverifikasi oleh admin" className="tailadmin-input resize-y" />
        </label>
      </ConfirmDialog>
    </>
  );
}
