"use client";

import type { QuizFormState } from "@/lib/quiz-builder";

export type BuilderSaveState = "idle" | "saving" | "saved" | "error";

type KelasOption = { id: string; name: string };

/**
 * Kartu kepala builder (pola Google Forms): status + toolbar aksi, lalu
 * judul, deskripsi, dan pemilih kelas.
 */
export function BuilderHeaderCard({
  status,
  saveState,
  canUndo,
  canRedo,
  formId,
  busy,
  form,
  kelasOptions,
  onPatch,
  onUndo,
  onRedo,
  onPreview,
  onDuplicate,
  onSave,
  onPublish,
}: {
  status: string;
  saveState: BuilderSaveState;
  canUndo: boolean;
  canRedo: boolean;
  formId: string;
  busy: boolean;
  form: QuizFormState;
  kelasOptions: KelasOption[];
  onPatch: (_patch: Partial<QuizFormState>) => void;
  onUndo: () => void;
  onRedo: () => void;
  onPreview: () => void;
  onDuplicate: () => void;
  onSave: () => void;
  onPublish: () => void;
}) {
  return (
    <section className="tailadmin-card space-y-3 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={`rounded-full px-3 py-1 text-theme-xs font-bold ${status === "PUBLISHED" ? "bg-success-50 text-success-700" : "bg-gray-100 text-gray-600"}`}>{status === "PUBLISHED" ? "Terbit" : "Draf"}</span>
        <div className="flex flex-wrap items-center gap-2">
          {saveState !== "idle" ? <span className={`text-theme-xs font-semibold ${saveState === "error" ? "text-error-600" : saveState === "saving" ? "text-warning-700" : "text-success-700"}`}>{saveState === "saving" ? "Menyimpan..." : saveState === "error" ? "Gagal menyimpan" : "Tersimpan"}</span> : null}
          <button type="button" onClick={onUndo} disabled={!canUndo} className="tailadmin-button-outline px-3 py-2 disabled:opacity-40" aria-label="Batalkan perubahan terakhir">Undo</button>
          <button type="button" onClick={onRedo} disabled={!canRedo} className="tailadmin-button-outline px-3 py-2 disabled:opacity-40" aria-label="Ulangi perubahan">Redo</button>
          <button type="button" onClick={onPreview} className="tailadmin-button-outline px-4 py-2">Pratinjau</button>
          {formId ? <a href={`/api/v1/kuis/${formId}/pdf`} target="_blank" rel="noreferrer" className="tailadmin-button-outline px-4 py-2">Cetak PDF</a> : null}
          {formId ? <a href={`/api/v1/kuis/${formId}/pdf?kunci=1`} target="_blank" rel="noreferrer" className="tailadmin-button-outline px-4 py-2">PDF + Kunci</a> : null}
          {formId ? <button type="button" onClick={onDuplicate} disabled={busy} className="tailadmin-button-outline px-4 py-2">Duplikat</button> : null}
          <button type="button" onClick={onSave} disabled={saveState === "saving"} className="tailadmin-button-outline px-4 py-2">Simpan</button>
          <button type="button" disabled={busy} onClick={onPublish} className="tailadmin-button-primary px-4 py-2">Publikasikan</button>
        </div>
      </div>
      <input
        value={form.title}
        onChange={(event) => onPatch({ title: event.target.value })}
        placeholder="Judul formulir"
        aria-label="Judul formulir"
        dir="auto"
        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-xl font-bold text-gray-900 outline-none focus:border-limo-blue-500 focus:ring-4 focus:ring-limo-blue-500/15"
      />
      <textarea
        value={form.description}
        onChange={(event) => onPatch({ description: event.target.value })}
        placeholder="Deskripsi / instruksi (opsional)"
        aria-label="Deskripsi formulir"
        dir="auto"
        rows={2}
        className="tailadmin-input"
      />
      <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Kelas
        <select value={form.kelasId} onChange={(event) => onPatch({ kelasId: event.target.value })} className="mt-2 tailadmin-input">
          <option value="">Pilih kelas</option>
          {kelasOptions.map((kelas) => <option key={kelas.id} value={kelas.id}>{kelas.name}</option>)}
        </select>
      </label>
    </section>
  );
}
