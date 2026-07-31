"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StartExamAttemptButton({ siswaId, ujianId, label = "Mulai Kerjakan" }: { siswaId: string; ujianId: string; label?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  async function startAttempt() {
    setError("");
    setIsStarting(true);

    try {
      const response = await fetch(`/api/v1/wali/tugas/${siswaId}/ujian/${ujianId}/attempt`, { method: "POST" });
      const payload = await response.json().catch(() => ({})) as { data?: { attemptId?: string }; error?: { message?: string } };

      if (!response.ok || !payload.data?.attemptId) {
        throw new Error(payload.error?.message || "Ujian gagal dimulai");
      }

      router.push(`/wali/tugas/attempt/${payload.data.attemptId}`);
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
