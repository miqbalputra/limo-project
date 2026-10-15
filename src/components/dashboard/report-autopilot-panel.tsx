"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { useAsyncAction } from "@/components/dashboard/use-async-action";
import { requestJson } from "@/lib/api-json-client";

type AutopilotStatus = {
  period: string;
  totalStudents: number;
  draftCount: number;
  publishedCount: number;
  missingCount: number;
};

export function ReportAutopilotPanel({ status }: { status: AutopilotStatus }) {
  const router = useRouter();
  const [period, setPeriod] = useState(status.period);
  const [lastNotice, setLastNotice] = useState<string | null>(null);
  const { isPending, pendingKey, run } = useAsyncAction();

  async function generate(dryRun: boolean) {
    const result = await run<{ created: number; skipped: number; failed: number; dryRun: boolean }>(
      dryRun ? "dry" : "run",
      () =>
        requestJson<{ created: number; skipped: number; failed: number; dryRun: boolean }>(`/api/v1/admin/reports/autopilot`, {
          method: "POST",
          body: { period, dryRun },
          fallbackMessage: "Generator laporan gagal dijalankan",
        }).then((response) => response.data),
      { fallbackMessage: "Generator laporan gagal dijalankan" },
    );
    if (result) {
      const mode = result.dryRun ? "Simulasi" : "Generate";
      setLastNotice(`${mode}: ${result.created} draft dibuat, ${result.skipped} dilewati${result.failed > 0 ? `, ${result.failed} gagal` : ""}.`);
    }
    router.refresh();
  }

  return (
    <div className="tailadmin-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-gray-900"><DashboardIcon name="audit" className="size-5 text-limo-blue-700" />Generator Laporan Bulanan Otomatis</h2>
          <p className="mt-1 text-theme-xs text-gray-500">Sistem membuat draf laporan bulanan untuk seluruh siswa aktif dari data presensi, nilai, dan progres. Guru tinggal memeriksa, melengkapi, dan menerbitkan — wali otomatis menerima notifikasi.</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-theme-xs font-semibold text-gray-500" htmlFor="autopilot-period">Periode</label>
          <input id="autopilot-period" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-theme-sm" />
          <button type="button" onClick={() => generate(true)} disabled={isPending} className="tailadmin-button-outline gap-1.5 disabled:opacity-50">
            {pendingKey === "dry" ? "Memeriksa..." : "Simulasi"}
          </button>
          <button type="button" onClick={() => generate(false)} disabled={isPending} className="tailadmin-button-primary gap-1.5 disabled:opacity-50">
            <DashboardIcon name="audit" className="size-4" />
            {pendingKey === "run" ? "Menjalankan..." : "Generate Draf"}
          </button>
        </div>
      </div>

      {lastNotice ? <p className="mt-3 rounded-lg bg-limo-blue-50 px-3 py-2 text-theme-xs font-medium text-limo-blue-800">{lastNotice}</p> : null}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Siswa aktif" value={status.totalStudents} />
        <Metric label="Draf tersedia" value={status.draftCount} tone="text-limo-blue-700" />
        <Metric label="Terbit" value={status.publishedCount} tone="text-success-700" />
        <Metric label="Belum ada laporan" value={status.missingCount} tone={status.missingCount > 0 ? "text-warning-700" : "text-gray-700"} />
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "text-gray-900" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2.5">
      <p className={`text-lg font-semibold ${tone}`}>{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  );
}
