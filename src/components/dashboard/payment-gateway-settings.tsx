"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { requestJson } from "@/lib/api-json-client";

type Provider = "mayar" | "pakasir";

type GatewaySetting = {
  provider: Provider;
  enabled: boolean;
  isPrimary: boolean;
  environment: string;
  merchantId: string;
  projectSlug: string;
  baseUrl: string;
  apiKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  source: string;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
  webhookUrl: string;
};

type FormState = {
  mayar: {
    enabled: boolean;
    environment: "sandbox" | "production";
    apiKey: string;
    merchantId: string;
    webhookSecret: string;
    baseUrl: string;
  };
  pakasir: {
    enabled: boolean;
    environment: string;
    apiKey: string;
    projectSlug: string;
    webhookSecret: string;
  };
  primaryProvider: Provider | null;
};

function initialForm(items: GatewaySetting[]): FormState {
  const mayar = items.find((item) => item.provider === "mayar");
  const pakasir = items.find((item) => item.provider === "pakasir");
  return {
    mayar: {
      enabled: mayar?.enabled ?? false,
      environment: mayar?.environment === "production" ? "production" : "sandbox",
      apiKey: "",
      merchantId: mayar?.merchantId ?? "",
      webhookSecret: "",
      baseUrl: mayar?.baseUrl ?? "",
    },
    pakasir: {
      enabled: pakasir?.enabled ?? false,
      environment: pakasir?.environment || "sandbox",
      apiKey: "",
      projectSlug: pakasir?.projectSlug ?? "",
      webhookSecret: "",
    },
    primaryProvider: items.find((item) => item.isPrimary)?.provider ?? null,
  };
}

export function PaymentGatewaySettings({ items }: { items: GatewaySetting[] }) {
  const [form, setForm] = useState<FormState>(() => initialForm(items));
  const [currentItems, setCurrentItems] = useState(items);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [testing, setTesting] = useState<Provider | null>(null);
  const [copied, setCopied] = useState<Provider | null>(null);

  function updateProvider(provider: Provider, field: string, value: string | boolean) {
    setForm((current) => ({ ...current, [provider]: { ...current[provider], [field]: value } } as FormState));
  }

  async function save() {
    setMessage("");
    setError("");
    setIsSaving(true);
    try {
      const response = await requestJson<{ items: GatewaySetting[] }>("/api/v1/admin/payment-gateways", { method: "PUT", body: form, fallbackMessage: "Pengaturan payment gateway gagal disimpan" });
      setCurrentItems(response.data.items);
      setForm(initialForm(response.data.items));
      setMessage("Pengaturan payment gateway berhasil disimpan.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pengaturan payment gateway gagal disimpan");
    } finally {
      setIsSaving(false);
    }
  }

  async function test(provider: Provider) {
    setMessage("");
    setError("");
    setTesting(provider);
    try {
      const response = await requestJson<{ message?: string }>(`/api/v1/admin/payment-gateways/${provider}/test`, { method: "POST", body: {}, fallbackMessage: "Uji koneksi gagal" });
      setMessage(response.data.message || `Koneksi ${provider} berhasil diverifikasi.`);
      setCurrentItems((current) => current.map((item) => item.provider === provider ? { ...item, lastTestStatus: "SUCCESS", lastTestMessage: response.data.message || "Berhasil" } : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Uji koneksi gagal");
    } finally {
      setTesting(null);
    }
  }

  async function copyWebhook(provider: Provider) {
    try {
      const response = await requestJson<{ url: string }>(`/api/v1/admin/payment-gateways/${provider}/webhook-url`, { method: "POST", body: {}, fallbackMessage: "URL webhook gagal dibuat" });
      await navigator.clipboard.writeText(response.data.url);
      setCopied(provider);
      window.setTimeout(() => setCopied((current) => current === provider ? null : current), 1600);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "URL webhook gagal disalin");
    }
  }

  const mayar = currentItems.find((item) => item.provider === "mayar");
  const pakasir = currentItems.find((item) => item.provider === "pakasir");

  return (
    <div className="space-y-6">
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      {message ? <p role="status" className="tailadmin-alert-success">{message}</p> : null}
      <section className="tailadmin-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-theme-xs font-semibold uppercase tracking-[0.16em] text-limo-blue-700">Pilihan pembayaran</p>
            <h2 className="mt-1 text-lg font-semibold text-gray-900">Provider yang ditawarkan ke Wali</h2>
            <p className="mt-1 max-w-2xl text-theme-sm leading-6 text-gray-500">Aktifkan satu atau dua provider. Provider utama akan terpilih otomatis, tetapi Wali tetap dapat memilih provider lain jika keduanya aktif.</p>
          </div>
          <label className="block min-w-56 text-theme-sm font-medium text-gray-700">
            Provider utama
            <select value={form.primaryProvider || ""} onChange={(event) => setForm((current) => ({ ...current, primaryProvider: (event.target.value || null) as Provider | null }))} className="tailadmin-input mt-2">
              <option value="">Otomatis</option>
              <option value="mayar" disabled={!form.mayar.enabled}>Mayar</option>
              <option value="pakasir" disabled={!form.pakasir.enabled}>Pakasir</option>
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <GatewayCard provider="mayar" item={mayar} enabled={form.mayar.enabled} onEnabledChange={(value) => updateProvider("mayar", "enabled", value)} onTest={() => void test("mayar")} isTesting={testing === "mayar"} onCopy={() => void copyWebhook("mayar")} copied={copied === "mayar"}>
          <label className="text-theme-sm font-medium text-gray-700">Environment<select value={form.mayar.environment} onChange={(event) => updateProvider("mayar", "environment", event.target.value)} className="tailadmin-input mt-2"><option value="sandbox">Sandbox</option><option value="production">Production</option></select></label>
          <label className="text-theme-sm font-medium text-gray-700">API key<input type="password" value={form.mayar.apiKey} onChange={(event) => updateProvider("mayar", "apiKey", event.target.value)} placeholder={mayar?.apiKeyConfigured ? "Tersimpan, kosongkan jika tidak diubah" : "Masukkan API key Mayar"} autoComplete="new-password" className="tailadmin-input mt-2" /></label>
          <label className="text-theme-sm font-medium text-gray-700">Merchant ID<input value={form.mayar.merchantId} onChange={(event) => updateProvider("mayar", "merchantId", event.target.value)} placeholder="Merchant/user ID Mayar" className="tailadmin-input mt-2" /></label>
          <label className="text-theme-sm font-medium text-gray-700">Webhook secret<input type="password" value={form.mayar.webhookSecret} onChange={(event) => updateProvider("mayar", "webhookSecret", event.target.value)} placeholder={mayar?.webhookSecretConfigured ? "Tersimpan, kosongkan jika tidak diubah" : "Secret webhook Mayar"} autoComplete="new-password" className="tailadmin-input mt-2" /></label>
          <label className="text-theme-sm font-medium text-gray-700">Base URL <span className="font-normal text-gray-400">(opsional)</span><input value={form.mayar.baseUrl} onChange={(event) => updateProvider("mayar", "baseUrl", event.target.value)} placeholder="Otomatis sesuai environment" className="tailadmin-input mt-2" /></label>
        </GatewayCard>

        <GatewayCard provider="pakasir" item={pakasir} enabled={form.pakasir.enabled} onEnabledChange={(value) => updateProvider("pakasir", "enabled", value)} onTest={() => void test("pakasir")} isTesting={testing === "pakasir"} onCopy={() => void copyWebhook("pakasir")} copied={copied === "pakasir"}>
          <label className="text-theme-sm font-medium text-gray-700">Project slug<input value={form.pakasir.projectSlug} onChange={(event) => updateProvider("pakasir", "projectSlug", event.target.value)} placeholder="Slug proyek Pakasir" className="tailadmin-input mt-2" /></label>
          <label className="text-theme-sm font-medium text-gray-700">API key<input type="password" value={form.pakasir.apiKey} onChange={(event) => updateProvider("pakasir", "apiKey", event.target.value)} placeholder={pakasir?.apiKeyConfigured ? "Tersimpan, kosongkan jika tidak diubah" : "Masukkan API key Pakasir"} autoComplete="new-password" className="tailadmin-input mt-2" /></label>
          <label className="text-theme-sm font-medium text-gray-700">Webhook secret LIMO<input type="password" value={form.pakasir.webhookSecret} onChange={(event) => updateProvider("pakasir", "webhookSecret", event.target.value)} placeholder={pakasir?.webhookSecretConfigured ? "Tersimpan, kosongkan jika tidak diubah" : "Buat secret khusus untuk URL webhook"} autoComplete="new-password" className="tailadmin-input mt-2" /></label>
          <p className="rounded-xl bg-gray-50 p-3 text-theme-xs leading-5 text-gray-500">Pakasir menggunakan hosted checkout. Pilihan semua metode atau QRIS akan muncul saat Wali membuat instruksi pembayaran.</p>
        </GatewayCard>
      </div>

      <section className="tailadmin-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Simpan konfigurasi</h2>
            <p className="mt-1 text-theme-sm leading-6 text-gray-500">API key dan secret disimpan terenkripsi. Setelah menyimpan, uji koneksi lalu pasang URL webhook pada dashboard provider masing-masing.</p>
          </div>
          <button type="button" onClick={() => void save()} disabled={isSaving} className="tailadmin-button-primary px-5 py-2.5">{isSaving ? "Menyimpan..." : "Simpan Pengaturan"}</button>
        </div>
      </section>
    </div>
  );
}

function GatewayCard({ provider, item, enabled, onEnabledChange, onTest, isTesting, onCopy, copied, children }: { provider: Provider; item?: GatewaySetting; enabled: boolean; onEnabledChange: (_value: boolean) => void; onTest: () => void; isTesting: boolean; onCopy: () => void; copied: boolean; children: ReactNode }) {
  const label = provider === "mayar" ? "Mayar" : "Pakasir";
  return (
    <section className="tailadmin-card overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 sm:p-6">
        <div><p className="text-theme-xs font-semibold uppercase tracking-[0.16em] text-limo-blue-700">Payment gateway</p><h2 className="mt-1 text-xl font-semibold text-gray-900">{label}</h2><p className="mt-1 text-theme-sm text-gray-500">{item?.source === "environment" ? "Menggunakan konfigurasi environment lama." : item?.apiKeyConfigured ? "Kredensial sudah tersimpan." : "Belum dikonfigurasi."}</p></div>
        <label className="flex items-center gap-2 text-theme-sm font-semibold text-gray-700"><input type="checkbox" checked={enabled} onChange={(event) => onEnabledChange(event.target.checked)} className="size-4 rounded border-gray-300 text-limo-blue-600" /> Aktif</label>
      </div>
      <div className="grid gap-4 p-5 sm:p-6">{children}</div>
      <div className="border-t border-gray-100 bg-gray-50 p-5 sm:p-6">
        <p className="text-theme-xs font-semibold text-gray-700">Webhook provider</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input readOnly value={item?.webhookSecretConfigured ? item.webhookUrl : "URL akan tersedia setelah webhook secret disimpan"} className="tailadmin-input min-w-0 flex-1 bg-white text-[11px]" /><button type="button" onClick={onCopy} disabled={!item?.webhookSecretConfigured} className="tailadmin-button-outline shrink-0 px-3 py-2">{copied ? "Tersalin" : "Salin URL"}</button></div>
        <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" onClick={onTest} disabled={isTesting || !item?.apiKeyConfigured} className="tailadmin-button-outline px-3 py-2">{isTesting ? "Menguji..." : "Uji koneksi"}</button>{item?.lastTestStatus === "SUCCESS" ? <span className="text-theme-xs font-semibold text-success-700">{item.lastTestMessage || "Koneksi berhasil"}</span> : null}</div>
      </div>
    </section>
  );
}
