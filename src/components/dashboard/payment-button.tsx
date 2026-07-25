"use client";

import { FormEvent, useState } from "react";

type PaymentResult = {
  mode: "api" | "redirect";
  paymentUrl: string | null;
  payment: {
    payment_method: string;
    payment_number: string;
    total_payment?: number;
    expired_at?: string;
  } | null;
};

export function PaymentButton({ tagihanId, disabled }: { tagihanId: string; disabled: boolean }) {
  const [method, setMethod] = useState("qris");
  const [error, setError] = useState("");
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/v1/tagihan/${tagihanId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error?.message || "Instruksi pembayaran gagal dibuat");
      }

      setResult(payload.data as PaymentResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Instruksi pembayaran gagal dibuat");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <select value={method} onChange={(event) => setMethod(event.target.value)} disabled={disabled || isSubmitting} className="tailadmin-input py-2">
          <option value="qris">QRIS</option>
          <option value="bni_va">BNI Virtual Account</option>
          <option value="bri_va">BRI Virtual Account</option>
          <option value="permata_va">Permata Virtual Account</option>
          <option value="atm_bersama_va">ATM Bersama VA</option>
        </select>
        <button type="submit" disabled={disabled || isSubmitting} className="tailadmin-button-primary justify-center px-4 py-2">
          {isSubmitting ? "Membuat..." : "Buat Instruksi Bayar"}
        </button>
      </div>
      {error ? <p className="tailadmin-alert-error">{error}</p> : null}
      {result?.payment ? (
        <div className="rounded-xl border border-success-100 bg-success-50 p-3 text-theme-sm text-success-800">
          <p className="font-semibold">{result.payment.payment_method.toUpperCase()} siap digunakan</p>
          <p className="mt-1 break-all">Nomor/QR string: {result.payment.payment_number}</p>
          {result.payment.total_payment ? <p>Total bayar: Rp {result.payment.total_payment.toLocaleString("id-ID")}</p> : null}
          {result.payment.expired_at ? <p>Kadaluarsa: {new Date(result.payment.expired_at).toLocaleString("id-ID")}</p> : null}
        </div>
      ) : result?.paymentUrl ? (
        <a href={result.paymentUrl} target="_blank" rel="noreferrer" className="tailadmin-button-outline w-full justify-center px-4 py-2">
          Buka Halaman Pembayaran Pakasir
        </a>
      ) : null}
    </form>
  );
}
