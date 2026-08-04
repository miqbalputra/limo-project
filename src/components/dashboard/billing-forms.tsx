"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Option = { id: string; name: string };

async function postJson(path: string, body: Record<string, string | number | boolean>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(payload.error?.message || "Data gagal diproses");
  }
}

export function TarifForm({ programs, kelas }: { programs: Option[]; kelas: Option[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);

    try {
      await postJson("/api/v1/admin/tarif", {
        name: String(data.get("name") || ""),
        programId: String(data.get("programId") || ""),
        kelasId: String(data.get("kelasId") || ""),
        amount: Number(data.get("amount") || 0),
        effectiveFrom: String(data.get("effectiveFrom") || ""),
        effectiveTo: String(data.get("effectiveTo") || ""),
      });
      event.currentTarget.reset();
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

export function GenerateInvoiceForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/v1/admin/tagihan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: String(data.get("period") || ""),
          dueDate: String(data.get("dueDate") || ""),
          jenis: String(data.get("jenis") || "SPP"),
          dryRun: data.get("dryRun") === "on",
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Generate gagal");
      setMessage(`Created ${payload.data.created}, skipped ${payload.data.skipped}, failed ${payload.data.failed}`);
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Generate gagal");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="tailadmin-card grid gap-3 p-5">
      <h2 className="font-semibold text-gray-900">Generate Tagihan Bulanan</h2>
      {message ? <p className="text-theme-sm text-gray-600">{message}</p> : null}
      <input name="period" required placeholder="2026-07" className="tailadmin-input" />
      <input name="dueDate" required type="date" className="tailadmin-input" />
      <input name="jenis" defaultValue="SPP" className="tailadmin-input" />
      <label className="text-theme-sm text-gray-700"><input name="dryRun" type="checkbox" className="mr-2 accent-brand-500" />Dry run</label>
      <button disabled={isSubmitting} className="tailadmin-button-primary">
        {isSubmitting ? "Memproses..." : "Generate"}
      </button>
    </form>
  );
}

export function ReconcilePaymentButton({ tagihanId, disabled }: { tagihanId: string; disabled: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function reconcile() {
    const reason = window.prompt("Alasan rekonsiliasi manual");

    if (!reason) return;
    if (!window.confirm("Tandai tagihan ini lunas secara manual? Pastikan pembayaran sudah diverifikasi.")) return;

    setMessage("");
    setIsSubmitting(true);

    try {
      await postJson("/api/v1/admin/pembayaran/reconcile", { tagihanId, reason });
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Rekonsiliasi gagal");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={reconcile}
        disabled={disabled || isSubmitting}
        className="tailadmin-button-outline px-3 py-1 text-theme-xs"
      >
        {isSubmitting ? "Memproses..." : "Rekonsiliasi Manual"}
      </button>
      {message ? <p className="mt-1 text-theme-xs text-error-700">{message}</p> : null}
    </div>
  );
}
