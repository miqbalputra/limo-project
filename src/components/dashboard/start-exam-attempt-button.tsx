"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { withWaliChildContext } from "@/lib/wali-selector";
import { requestJson } from "@/lib/api-json-client";

export function StartExamAttemptButton({ siswaId, ujianId, label = "Mulai Kerjakan" }: { siswaId: string; ujianId: string; label?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  async function startAttempt() {
    setError("");
    setIsStarting(true);

    try {
      const response = await requestJson<{ attemptId?: string }>(`/api/v1/wali/tugas/${siswaId}/ujian/${ujianId}/attempt`, { method: "POST", fallbackMessage: "Ujian gagal dimulai" });
      if (!response.data.attemptId) throw new Error("Ujian gagal dimulai");

      router.push(withWaliChildContext(`/wali/tugas/attempt/${response.data.attemptId}`, siswaId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ujian gagal dimulai");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button type="button" onClick={() => void startAttempt()} disabled={isStarting} className="tailadmin-button-primary px-4 py-2">
        {isStarting ? "Membuka..." : label}
      </button>
      {error ? <p className="tailadmin-alert-error">{error}</p> : null}
    </div>
  );
}
