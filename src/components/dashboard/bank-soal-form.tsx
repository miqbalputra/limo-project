"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type KelasOption = { id: string; name: string };

export function BankSoalForm({ kelasOptions }: { kelasOptions: KelasOption[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);
    const type = String(data.get("type") || "PILIHAN_GANDA");
    const correctLabel = String(data.get("correctLabel") || "A");

    const options = ["A", "B", "C", "D"]
      .map((label) => ({
        label,
        content: String(data.get(`option${label}`) || ""),
        isCorrect: label === correctLabel,
      }))
      .filter((option) => option.content.length > 0);

    try {
      const response = await fetch("/api/v1/bank-soal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kelasId: String(data.get("kelasId") || ""),
          type,
          question: String(data.get("question") || ""),
          language: String(data.get("language") || ""),
          direction: String(data.get("direction") || ""),
          explanation: String(data.get("explanation") || ""),
          options: type === "PILIHAN_GANDA" ? options : [],
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(payload.error?.message || "Soal gagal disimpan");
      }

      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Soal gagal disimpan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="tailadmin-card grid gap-3 p-5">
      <h2 className="font-semibold text-gray-900">Tambah Bank Soal</h2>
      {error ? <p className="tailadmin-alert-error">{error}</p> : null}
      <select name="kelasId" className="tailadmin-input">
        <option value="">Umum / tidak terikat kelas</option>
        {kelasOptions.map((kelas) => <option key={kelas.id} value={kelas.id}>{kelas.name}</option>)}
      </select>
      <select name="type" className="tailadmin-input">
        <option value="PILIHAN_GANDA">Pilihan Ganda</option>
        <option value="ESAI">Esai</option>
      </select>
      <textarea name="question" required placeholder="Tulis soal" className="tailadmin-input min-h-28" />
      <div className="grid gap-3 sm:grid-cols-2">
        {(["A", "B", "C", "D"] as const).map((label) => (
          <input key={label} name={`option${label}`} placeholder={`Opsi ${label}`} className="tailadmin-input" />
        ))}
      </div>
      <select name="correctLabel" className="tailadmin-input">
        <option value="A">Jawaban benar A</option>
        <option value="B">Jawaban benar B</option>
        <option value="C">Jawaban benar C</option>
        <option value="D">Jawaban benar D</option>
      </select>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="language" placeholder="id/ar/en" className="tailadmin-input" />
        <select name="direction" className="tailadmin-input">
          <option value="">Auto</option>
          <option value="ltr">LTR</option>
          <option value="rtl">RTL Arab</option>
        </select>
      </div>
      <textarea name="explanation" placeholder="Pembahasan/catatan internal" className="tailadmin-input" />
      <button disabled={isSubmitting} className="tailadmin-button-primary">
        {isSubmitting ? "Menyimpan..." : "Simpan Soal"}
      </button>
    </form>
  );
}
