"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/api-json-client";

type GradeableItem = {
  id: string;
  question: string;
  weight: number;
  correct: boolean | null;
  manualScore: number | null;
};

export function QuizResponseGradeForm({ ujianId, responseId, items }: { ujianId: string; responseId: string; items: GradeableItem[] }) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, string>>(() => Object.fromEntries(items.map((item) => [item.id, item.manualScore === null ? "" : String(item.manualScore)])));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  if (items.length === 0) return null;

  async function save() {
    setError("");
    setNotice("");
    const answers = items
      .map((item) => ({ ujianSoalId: item.id, score: Number(scores[item.id]) }))
      .filter((entry) => scores[entry.ujianSoalId] !== "" && Number.isFinite(entry.score) && entry.score >= 0);

    if (answers.length === 0) {
      setError("Isi minimal satu skor manual sebelum menyimpan.");
      return;
    }

    setBusy(true);
    try {
      const result = await requestJson<{ item: { score: number | null; needsReview: boolean } }>(`/api/v1/kuis/${ujianId}/responses/${responseId}/grade`, {
        method: "PATCH",
        body: { answers },
        fallbackMessage: "Penilaian gagal disimpan",
      });
      setNotice(result.data.item.needsReview ? "Skor tersimpan. Masih ada soal yang perlu dinilai." : `Skor tersimpan. Total: ${result.data.item.score}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Penilaian gagal disimpan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tailadmin-card p-5">
      <h2 className="font-semibold text-gray-900">Penilaian manual</h2>
      <p className="mt-1 text-theme-xs text-gray-500">Beri skor untuk soal yang tidak dapat dinilai otomatis (esai, unggah berkas, atau opsi &quot;Lainnya&quot;). Skor maksimum mengikuti poin soal.</p>
      {error ? <p role="alert" className="mt-3 tailadmin-alert-error">{error}</p> : null}
      {notice ? <p role="status" className="mt-3 tailadmin-alert-success">{notice}</p> : null}
      <div className="mt-4 grid gap-3">
        {items.map((item, index) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-3">
            <div className="min-w-0">
              <p className="text-theme-sm font-semibold text-gray-800">Soal manual {index + 1} · maks {item.weight} poin</p>
              <p className="mt-1 line-clamp-2 text-theme-xs text-gray-600" dir="auto">{item.question}</p>
            </div>
            <label className="flex items-center gap-2 text-theme-xs font-semibold text-gray-600">
              Skor
              <input
                type="number"
                min={0}
                max={item.weight}
                step={0.5}
                value={scores[item.id] ?? ""}
                onChange={(event) => setScores((current) => ({ ...current, [item.id]: event.target.value }))}
                className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-theme-sm"
                aria-label={`Skor soal manual ${index + 1}`}
              />
            </label>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => void save()} disabled={busy} className="tailadmin-button-primary mt-4 px-5 py-2.5">{busy ? "Menyimpan..." : "Simpan penilaian"}</button>
    </section>
  );
}
