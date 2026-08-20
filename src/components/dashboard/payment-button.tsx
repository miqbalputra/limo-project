"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { MAYAR_PAYMENT_METHOD_LABELS, MAYAR_PAYMENT_METHODS } from "@/lib/mayar-payment-methods";
import { requestJson } from "@/lib/api-json-client";

type PaymentProvider = "mayar" | "pakasir";

type PaymentResult = {
  mode: "redirect";
  provider: PaymentProvider;
  paymentUrl: string | null;
  payment: null;
  invoiceId?: string;
  transactionId?: string;
};

const PAKASIR_PAYMENT_METHODS = [
  { value: "all", label: "Semua metode Pakasir" },
  { value: "qris", label: "QRIS saja" },
] as const;

export function PaymentButton({ tagihanId, disabled, initialPaymentUrl = null, initialPaymentProvider = null, availableProviders = ["mayar"] }: { tagihanId: string; disabled: boolean; initialPaymentUrl?: string | null; initialPaymentProvider?: PaymentProvider | null; availableProviders?: PaymentProvider[] }) {
  const [provider, setProvider] = useState<PaymentProvider>(initialPaymentProvider || availableProviders[0] || "mayar");
  const [method, setMethod] = useState("all");
  const [error, setError] = useState("");
  const [result, setResult] = useState<PaymentResult | null>(initialPaymentUrl ? { mode: "redirect", provider: initialPaymentProvider || availableProviders[0] || "mayar", paymentUrl: initialPaymentUrl, payment: null } : null);
  const [isPaid, setIsPaid] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!result?.paymentUrl || isPaid) return;

    let cancelled = false;
    const checkPaymentStatus = async () => {
      try {
        const response = await requestJson<{ item?: { status?: string } }>(`/api/v1/tagihan/${tagihanId}`, { cache: "no-store", fallbackMessage: "Status pembayaran belum dapat diperiksa" });
        if (cancelled) return;
        setStatusError("");
        if (response.data.item?.status === "PAID") setIsPaid(true);
      } catch {
        if (!cancelled) setStatusError("Status pembayaran belum dapat diperiksa. Coba lagi beberapa saat.");
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
      const response = await requestJson<PaymentResult>(`/api/v1/tagihan/${tagihanId}/payment`, {
        method: "POST",
        body: { provider, method },
        fallbackMessage: "Instruksi pembayaran gagal dibuat",
      });
      setResult(response.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Instruksi pembayaran gagal dibuat");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        {availableProviders.length > 1 ? <label className="sr-only" htmlFor={`payment-provider-${tagihanId}`}>Provider pembayaran</label> : null}
        {availableProviders.length > 1 ? <select id={`payment-provider-${tagihanId}`} value={provider} onChange={(event) => { const nextProvider = event.target.value as PaymentProvider; setProvider(nextProvider); setMethod("all"); setResult(null); }} disabled={disabled || isSubmitting} className="tailadmin-input py-2"><option value="mayar">Mayar</option><option value="pakasir">Pakasir</option></select> : null}
        <label className="sr-only" htmlFor={`payment-method-${tagihanId}`}>Metode pembayaran {provider === "mayar" ? "Mayar" : "Pakasir"}</label>
        <select id={`payment-method-${tagihanId}`} value={method} onChange={(event) => setMethod(event.target.value)} disabled={disabled || isSubmitting} className="tailadmin-input py-2">
          {provider === "mayar" ? <><option value="all">Semua metode Mayar</option>{MAYAR_PAYMENT_METHODS.map((paymentMethod) => <option key={paymentMethod} value={paymentMethod}>{MAYAR_PAYMENT_METHOD_LABELS[paymentMethod]}</option>)}</> : PAKASIR_PAYMENT_METHODS.map((paymentMethod) => <option key={paymentMethod.value} value={paymentMethod.value}>{paymentMethod.label}</option>)}
        </select>
        <button type="submit" disabled={disabled || isSubmitting} className="tailadmin-button-primary justify-center px-4 py-2">
          {isSubmitting ? "Membuat..." : "Buat Instruksi Bayar"}
        </button>
      </div>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      {result?.paymentUrl ? <>
        <a href={result.paymentUrl} target="_blank" rel="noreferrer" className="tailadmin-button-outline w-full justify-center px-4 py-2">
          Buka Halaman Pembayaran {result.provider === "mayar" ? "Mayar" : "Pakasir"}
        </a>
        {isPaid ? <div role="status" aria-live="polite" className="rounded-xl border border-success-100 bg-success-50 p-4 text-theme-sm text-success-800"><p className="font-semibold">Pembayaran berhasil diterima.</p><p className="mt-1">Webhook {result.provider === "mayar" ? "Mayar" : "Pakasir"} sudah memverifikasi pembayaran tagihan ini.</p><Link href={`/wali/tagihan/success?tagihanId=${encodeURIComponent(tagihanId)}`} className="mt-3 inline-flex font-semibold text-success-700 underline">Lihat halaman pembayaran berhasil</Link></div> : <p role="status" className="text-theme-xs text-gray-500">Menunggu konfirmasi pembayaran dari {result.provider === "mayar" ? "Mayar" : "Pakasir"}. Halaman ini memeriksa status otomatis.</p>}
        {statusError ? <p role="status" className="text-theme-xs text-warning-700">{statusError}</p> : null}
      </> : null}
    </form>
  );
}
