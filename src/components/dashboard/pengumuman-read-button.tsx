"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/api-json-client";

export function PengumumanReadButton({ id, alreadyRead }: { id: string; alreadyRead: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">(alreadyRead ? "done" : "idle");
  const [error, setError] = useState("");

  if (state === "done") {
    return <span className="inline-flex items-center gap-1.5 rounded-xl bg-success-50 px-3 py-1.5 text-theme-xs font-semibold text-success-700">Dibaca</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={state === "saving"}
        onClick={async () => {
          setError("");
          setState("saving");
          try {
            await requestJson(`/api/v1/pengumuman/${id}/read`, { method: "POST", body: {}, fallbackMessage: "Gagal menandai sudah dibaca" });
            setState("done");
            router.refresh();
          } catch (caught) {
            setState("error");
            setError(caught instanceof Error ? caught.message : "Gagal menandai sudah dibaca");
          }
        }}
        className="tailadmin-button-outline px-3 py-1.5"
      >
        {state === "saving" ? "Menandai..." : "Tandai sudah dibaca"}
      </button>
      {state === "error" && error ? <span role="alert" className="text-theme-xs text-error-700">{error}</span> : null}
    </div>
  );
}
