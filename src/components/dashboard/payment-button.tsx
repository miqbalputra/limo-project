"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { MAYAR_PAYMENT_METHOD_LABELS, MAYAR_PAYMENT_METHODS } from "@/lib/mayar-payment-methods";

type PaymentResult = {
  mode: "redirect";
  provider: "mayar";
  paymentUrl: string | null;
  payment: null;
  invoiceId?: string;
  transactionId?: string;
};

export function PaymentButton({ tagihanId, disabled, initialPaymentUrl = null }: { tagihanId: string; disabled: boolean; initialPaymentUrl?: string | null }) {
  const [method, setMethod] = useState("all");
  const [error, setError] = useState("");
  const [result, setResult] = useState<PaymentResult | null>(initialPaymentUrl ? { mode: "redirect", provider: "mayar", paymentUrl: initialPaymentUrl, payment: null } : null);
  const [isPaid, setIsPaid] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!result?.paymentUrl || isPaid) return;

    let cancelled = false;
    const checkPaymentStatus = async () => {
      const response = await fetch(`/api/v1/tagihan/${tagihanId}`, { cache: "no-store" });
      if (!response.ok) {
        if (!cancelled) setStatusError("Status pembayaran belum dapat diperiksa. Coba lagi beberapa saat.");
        return;
      }
      if (cancelled) return;
      setStatusError("");
      const payload = await response.json().catch(() => null) as { data?: { item?: { status?: string } } } | null;
      if (!cancelled && payload?.data?.item?.status === "PAID") {
        setIsPaid(true);
      }
    };

    void checkPaymentStatus();
    const interval = window.setInterval(() => void checkPaymentStatus(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isPaid, result?.paymentUrl, tagihanId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setIsPaid(false);
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
        <label className="sr-only" htmlFor={`payment-method-${tagihanId}`}>Metode pembayaran Mayar</label>
        <select id={`payment-method-${tagihanId}`} value={method} onChange={(event) => setMethod(event.target.value)} disabled={disabled || isSubmitting} className="tailadmin-input py-2">
          <option value="all">Semua metode Mayar</option>
           {MAYAR_PAYMENT_METHODS.map((paymentMethod) => <option key={paymentMethod} value={paymentMethod}>{MAYAR_PAYMENT_METHOD_LABELS[paymentMethod]}</option>)}
        </select>
        <button type="submit" disabled={disabled || isSubmitting} className="tailadmin-button-primary justify-center px-4 py-2">
          {isSubmitting ? "Membuat..." : "Buat Instruksi Bayar"}
        </button>
      </div>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      {result?.paymentUrl ? <>
        <a href={result.paymentUrl} target="_blank" rel="noreferrer" className="tailadmin-button-outline w-full justify-center px-4 py-2">
          Buka Halaman Pembayaran Mayar
        </a>
        {isPaid ? <div role="status" aria-live="polite" className="rounded-xl border border-success-100 bg-success-50 p-4 text-theme-sm text-success-800"><p className="font-semibold">Pembayaran berhasil diterima.</p><p className="mt-1">Webhook Mayar sudah memverifikasi pembayaran tagihan ini.</p><Link href={`/wali/tagihan/success?tagihanId=${encodeURIComponent(tagihanId)}`} className="mt-3 inline-flex font-semibold text-success-700 underline">Lihat halaman pembayaran berhasil</Link></div> : <p role="status" className="text-theme-xs text-gray-500">Menunggu konfirmasi pembayaran dari Mayar. Halaman ini memeriksa status otomatis.</p>}
        {statusError ? <p role="status" className="text-theme-xs text-warning-700">{statusError}</p> : null}
      </> : null}
    </form>
  );
}
