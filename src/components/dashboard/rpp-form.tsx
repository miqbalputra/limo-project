"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ClassOption = { id: string; name: string };

export function RppForm({ classes }: { classes: ClassOption[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"FORM" | "FILE">("FORM");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/guru/rpp", { method: "POST", body: new FormData(event.currentTarget) });
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "RPP gagal disimpan");
      event.currentTarget.reset();
      setMode("FORM");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "RPP gagal disimpan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="tailadmin-card grid gap-3 p-5">
      <div><h2 className="font-semibold text-gray-900">Buat RPP</h2><p className="mt-1 text-theme-xs text-gray-500">Pilih isi rancangan langsung atau unggah file Word/PDF. RPP baru tersimpan sebagai draft.</p></div>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="kelasId" required aria-label="Kelas RPP" className="tailadmin-input"><option value="">Pilih kelas</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select name="mode" value={mode} onChange={(event) => setMode(event.target.value as "FORM" | "FILE")} aria-label="Mode RPP" className="tailadmin-input"><option value="FORM">Isi rancangan langsung</option><option value="FILE">Upload Word/PDF</option></select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="title" required placeholder="Judul RPP" className="tailadmin-input" />
        <input name="planDate" required type="date" aria-label="Tanggal RPP" className="tailadmin-input" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <input name="meetingNumber" type="number" min={1} placeholder="Pertemuan ke (opsional)" className="tailadmin-input" />
        <input name="topic" required placeholder="Materi/topik pembelajaran" className="tailadmin-input" />
        <select name="difficulty" defaultValue="Sedang" aria-label="Tingkat kesulitan" className="tailadmin-input"><option value="Mudah">Mudah</option><option value="Sedang">Sedang</option><option value="Sulit">Sulit</option></select>
      </div>
      {mode === "FORM" ? <>
        <textarea name="learningObjectives" required placeholder="Tujuan pembelajaran / kompetensi yang ingin dicapai" className="tailadmin-input min-h-24" />
        <textarea name="materials" required placeholder="Materi, sumber belajar, dan media" className="tailadmin-input min-h-24" />
        <textarea name="activities" required placeholder="Langkah kegiatan pembelajaran: pembukaan, inti, penutup" className="tailadmin-input min-h-28" />
        <textarea name="assessment" required placeholder="Asesmen: teknik, instrumen, kriteria, dan tindak lanjut" className="tailadmin-input min-h-24" />
      </> : <p className="rounded-xl bg-brand-50 p-4 text-theme-sm text-brand-800">Isi rancangan akan dibaca dari dokumen Word/PDF yang Anda unggah.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="durationMinutes" type="number" min={1} max={600} placeholder="Durasi (menit)" className="tailadmin-input" />
        <input name="notes" placeholder="Catatan tambahan (opsional)" className="tailadmin-input" />
      </div>
      {mode === "FILE" ? <label className="rounded-xl border border-brand-100 bg-brand-50/50 p-4 text-theme-sm font-semibold text-brand-800">Berkas RPP<input name="file" required type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="mt-2 block w-full text-theme-xs font-normal text-gray-600" /><span className="mt-1 block text-theme-xs font-normal text-brand-700">Format PDF, DOC, atau DOCX. Maksimal 20 MB.</span></label> : null}
      <button disabled={isSubmitting || classes.length === 0} className="tailadmin-button-primary">{isSubmitting ? "Menyimpan..." : "Simpan RPP sebagai Draft"}</button>
    </form>
  );
}
