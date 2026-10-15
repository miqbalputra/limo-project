"use client";

import { useRouter } from "next/navigation";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { useAsyncAction } from "@/components/dashboard/use-async-action";
import { requestJson } from "@/lib/api-json-client";

export function RadarInterventionButton({ siswaId, disabled }: { siswaId: string; disabled?: boolean }) {
  const router = useRouter();
  const { isPending, pendingKey, run } = useAsyncAction();

  async function sendIntervention() {
    await run(
      siswaId,
      () => requestJson(`/api/v1/admin/radar/intervensi`, { method: "POST", body: { siswaId }, fallbackMessage: "Intervensi gagal dikirim" }),
      { fallbackMessage: "Intervensi gagal dikirim", successMessage: "Notifikasi intervensi terkirim ke Wali." },
    );
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={sendIntervention}
      disabled={disabled || (isPending && pendingKey === siswaId)}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-limo-blue-600 px-3 py-1.5 text-theme-xs font-semibold text-white transition-colors hover:bg-limo-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <DashboardIcon name="bell" className="size-4" />
      {isPending && pendingKey === siswaId ? "Mengirim..." : "Hubungi Wali"}
    </button>
  );
}
