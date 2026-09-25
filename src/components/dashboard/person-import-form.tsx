"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { requestJson } from "@/lib/api-json-client";

type PersonKind = "guru" | "wali";

type ImportRowStatus = "CREATE" | "RESTORE" | "SKIP" | "ERROR";

type ImportRow = {
  row: number;
  name: string;
  email: string;
  status: ImportRowStatus;
  message: string;
};

type ImportResult = {
  dryRun: boolean;
  created: number;
  restored: number;
  skipped: number;
  errors: number;
  results: ImportRow[];
};

const statusClass: Record<ImportRowStatus, string> = {
  CREATE: "bg-success-50 text-success-700",
  RESTORE: "bg-warning-50 text-warning-700",
  SKIP: "bg-gray-100 text-gray-600",
  ERROR: "bg-error-50 text-error-700",
};

const statusLabel: Record<ImportRowStatus, string> = {
  CREATE: "Akun baru",
  RESTORE: "Pulihkan arsip",
  SKIP: "Dilewati",
  ERROR: "Gagal",
};

export function PersonImportForm({ kind }: { kind: PersonKind }) {
  const label = kind === "guru" ? "Guru" : "Wali";
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function run(dryRun: boolean) {
    setError("");
    setIsSubmitting(true);

    try {
      const { data } = await requestJson<ImportResult>(`/api/v1/admin/${kind}/impor`, {
        method: "POST",
        body: { csv, dryRun },
        fallbackMessage: "Impor gagal diproses",
      });
      setResult(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impor gagal diproses");
    } finally {
      setIsSubmitting(false);
    }
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCsv(String(reader.result || ""));
      setResult(null);
    };
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const blob = new Blob(["name,email,phone,address\r\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `template-impor-${kind}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <section className="tailadmin-card grid gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">Impor Akun {label}</h2>
            <p className="mt-1 text-theme-sm text-gray-500">Unggah atau tempel CSV dengan kolom <code>name,email,phone,address</code>. Baris tanpa nama dan email valid akan dilaporkan.</p>
          </div>
          <button type="button" onClick={downloadTemplate} className="tailadmin-button-outline px-3 py-2">Unduh template</button>
        </div>
        {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
        <label className="grid gap-1">
          <span className="text-theme-xs font-medium text-gray-600">Berkas CSV</span>
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="tailadmin-input" />
        </label>
        <label className="grid gap-1">
          <span className="text-theme-xs font-medium text-gray-600">Isi CSV</span>
          <textarea value={csv} onChange={(event) => { setCsv(event.target.value); setResult(null); }} aria-label="Isi CSV" placeholder={"name,email,phone,address\nAhmad,ahmad@example.com,08123,Jakarta"} className="tailadmin-input min-h-40 font-mono text-theme-xs" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={isSubmitting || csv.trim().length === 0} onClick={() => void run(true)} className="tailadmin-button-outline px-4 py-2.5">{isSubmitting ? "Memproses..." : "Pratinjau"}</button>
          <button type="button" disabled={isSubmitting || csv.trim().length === 0} onClick={() => void run(false)} className="tailadmin-button-primary px-4 py-2.5">{isSubmitting ? "Mengimpor..." : "Impor sekarang"}</button>
        </div>
      </section>

      {result ? (
        <section className="tailadmin-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-900">{result.dryRun ? "Hasil pratinjau" : "Hasil impor"}</h2>
            <p className="text-theme-xs text-gray-500">{result.created} dibuat · {result.restored} dipulihkan · {result.skipped} dilewati · {result.errors} gagal</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-theme-sm">
              <thead className="bg-gray-50 text-theme-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Baris</th>
                  <th className="px-4 py-3 text-left">Nama</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.results.map((row) => (
                  <tr key={`${row.row}-${row.email}`}>
                    <td className="px-4 py-3 text-gray-500">{row.row}</td>
                    <td className="px-4 py-3 text-gray-800">{row.name || "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{row.email || "-"}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-theme-xs font-semibold ${statusClass[row.status]}`}>{statusLabel[row.status]}</span></td>
                    <td className="px-4 py-3 text-gray-500">{row.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.dryRun ? <p className="border-t border-gray-100 px-5 py-3 text-theme-xs text-gray-500">Ini baru pratinjau. Tekan &quot;Impor sekarang&quot; untuk menyimpan.</p> : null}
        </section>
      ) : null}
    </div>
  );
}
