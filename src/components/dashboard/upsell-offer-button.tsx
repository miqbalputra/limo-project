"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { useAsyncAction } from "@/components/dashboard/use-async-action";
import { requestJson } from "@/lib/api-json-client";

export function UpsellOfferButton({ siswaId, kelasId, disabled }: { siswaId: string; kelasId: string; disabled?: boolean }) {
  const router = useRouter();
  const { isPending, pendingKey, run } = useAsyncAction();

  async function sendOffer() {
    const result = await run<{ notificationsCreated: number }>(
      siswaId,
      () =>
        requestJson<{ notificationsCreated: number }>(`/api/v1/admin/upsell/tawarkan`, {
          method: "POST",
          body: { siswaId, kelasId },
          fallbackMessage: "Tawaran gagal dikirim",
        }).then((response) => response.data),
      { fallbackMessage: "Tawaran gagal dikirim", successMessage: "Tawaran kenaikan level terkirim ke Wali." },
    );
    if (result) {
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={sendOffer}
      disabled={disabled || (isPending && pendingKey === siswaId)}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-limo-blue-600 px-3 py-1.5 text-theme-xs font-semibold text-white transition-colors hover:bg-limo-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <DashboardIcon name="bell" className="size-4" />
      {isPending && pendingKey === siswaId ? "Mengirim..." : "Tawarkan ke Wali"}
    </button>
  );
}
