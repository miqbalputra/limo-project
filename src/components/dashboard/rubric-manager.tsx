"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/api-json-client";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { formatUiLabel } from "@/lib/ui-labels";
import { useAsyncAction } from "@/components/dashboard/use-async-action";

const rubricRequestFallback = "Perubahan rubrik gagal disimpan";

export type RubricOption = {
  id: string;
  title: string;
  description: string | null;
  scope: string;
  status: string;
  updatedAt: string;
  criteria: Array<{ id: string; name: string; maxScore: number; order: number; levels: Array<{ id: string; label: string; score: number; order: number }> }>;
};

type DraftLevel = { label: string; description: string; score: number; order: number };
type DraftCriterion = { name: string; description: string; maxScore: number; order: number; levels: DraftLevel[] };

const initialCriterion = (): DraftCriterion => ({ name: "", description: "", maxScore: 10, order: 0, levels: [{ label: "Belum berkembang", description: "", score: 0, order: 0 }, { label: "Sangat baik", description: "", score: 10, order: 1 }] });

export function RubricManager({ initialRubrics }: { initialRubrics: RubricOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState("PRIVATE");
  const [criteria, setCriteria] = useState<DraftCriterion[]>([initialCriterion()]);
  const { error, isPending: busy, run } = useAsyncAction();

  function updateCriterion(index: number, patch: Partial<DraftCriterion>) {
    setCriteria((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function updateLevel(criterionIndex: number, levelIndex: number, patch: Partial<DraftLevel>) {
    setCriteria((items) => items.map((item, itemIndex) => itemIndex === criterionIndex ? { ...item, levels: item.levels.map((level, currentIndex) => currentIndex === levelIndex ? { ...level, ...patch } : level) } : item));
  }

  async function createRubric() {
    await run(
      "create",
      () =>
        requestJson("/api/v1/guru/rubrik", {
        method: "POST",
        body: { title, description, scope, criteria },
        fallbackMessage: rubricRequestFallback,
        }),
      {
        fallbackMessage: "Rubrik gagal dibuat",
        onSuccess: () => {
          setTitle("");
          setDescription("");
          setScope("PRIVATE");
          setCriteria([initialCriterion()]);
          router.refresh();
        },
      },
    );
  }

  async function updateStatus(rubricId: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    await run(
      "update-status",
      () =>
        requestJson(`/api/v1/guru/rubrik/${rubricId}`, {
        method: "PATCH",
        body: { status },
        fallbackMessage: rubricRequestFallback,
        }),
      { fallbackMessage: "Status rubrik gagal diubah", onSuccess: () => router.refresh() },
    );
  }

  return (
    <section className="space-y-4">
      <div className="tailadmin-card grid gap-4 p-5">
        <div>
          <p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-500">Rubrik dapat digunakan ulang</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">Buat rubrik penilaian</h2>
          <p className="mt-1 text-theme-sm text-gray-500">Rubrik disimpan sebagai templat. Saat dipasang ke tugas, salinannya tidak berubah walaupun templat berikutnya diedit.</p>
        </div>
        {error ? <p className="tailadmin-alert-error">{error}</p> : null}
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem]">
          <input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={200} placeholder="Judul rubrik, misalnya Speaking A1" className="tailadmin-input" />
          <select value={scope} onChange={(event) => setScope(event.target.value)} className="tailadmin-input"><option value="PRIVATE">{formatUiLabel("PRIVATE")}</option><option value="CLASS">Kelas</option><option value="INSTITUTION">{formatUiLabel("INSTITUTION")}</option></select>
        </div>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={10000} placeholder="Deskripsi penggunaan rubrik (opsional)" className="tailadmin-input min-h-20" />
        <div className="space-y-3">
          {criteria.map((criterion, criterionIndex) => <div key={criterionIndex} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_7rem_auto]">
              <input value={criterion.name} onChange={(event) => updateCriterion(criterionIndex, { name: event.target.value })} placeholder={`Kriteria ${criterionIndex + 1}`} className="tailadmin-input bg-white" />
              <input value={criterion.maxScore} onChange={(event) => updateCriterion(criterionIndex, { maxScore: Number(event.target.value) || 0 })} type="number" min={1} max={1000} placeholder="Skor maks" className="tailadmin-input bg-white" />
              {criteria.length > 1 ? <button type="button" onClick={() => setCriteria((items) => items.filter((_, index) => index !== criterionIndex))} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Hapus</button> : <span />}
            </div>
            <textarea value={criterion.description} onChange={(event) => updateCriterion(criterionIndex, { description: event.target.value })} placeholder="Deskripsi kriteria" className="tailadmin-input mt-3 min-h-16 bg-white" />
            <div className="mt-3 space-y-2">
              {criterion.levels.map((level, levelIndex) => <div key={levelIndex} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_6rem_auto]">
                <input value={level.label} onChange={(event) => updateLevel(criterionIndex, levelIndex, { label: event.target.value })} placeholder="Level" className="tailadmin-input bg-white" />
                <input value={level.score} onChange={(event) => updateLevel(criterionIndex, levelIndex, { score: Number(event.target.value) || 0 })} type="number" min={0} max={1000} placeholder="Skor" className="tailadmin-input bg-white" />
                {criterion.levels.length > 1 ? <button type="button" onClick={() => updateCriterion(criterionIndex, { levels: criterion.levels.filter((_, index) => index !== levelIndex) })} className="text-theme-xs font-semibold text-error-600">Hapus level</button> : null}
              </div>)}
              <button type="button" onClick={() => updateCriterion(criterionIndex, { levels: [...criterion.levels, { label: "", description: "", score: 0, order: criterion.levels.length }] })} className="text-theme-xs font-semibold text-limo-blue-600">+ Tambah level</button>
            </div>
          </div>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setCriteria((items) => [...items, { ...initialCriterion(), order: items.length }])} className="tailadmin-button-outline px-4 py-2 text-theme-xs">+ Tambah kriteria</button>
          <button type="button" disabled={busy || !title.trim()} onClick={() => void createRubric()} className="tailadmin-button-primary px-4 py-2 text-theme-xs">{busy ? "Menyimpan..." : "Simpan Rubrik Draf"}</button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {initialRubrics.map((rubric) => <article key={rubric.id} className="tailadmin-card p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-500">{formatUiLabel(rubric.scope, rubric.scope === "CLASS" ? "Kelas" : "Tidak diketahui")}</p><h3 className="mt-1 font-semibold text-gray-900">{rubric.title}</h3></div><StatusBadge status={rubric.status} compact /></div>
          <p className="mt-2 text-theme-sm text-gray-500">{rubric.description || "Tanpa deskripsi"}</p>
          <p className="mt-3 text-theme-xs text-gray-500">{rubric.criteria.length} kriteria / {rubric.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0)} skor rubrik</p>
          <div className="mt-3 flex flex-wrap gap-2">{rubric.status !== "PUBLISHED" ? <button disabled={busy} onClick={() => void updateStatus(rubric.id, "PUBLISHED")} className="tailadmin-button-primary px-3 py-2 text-theme-xs">Terbitkan</button> : null}{rubric.status !== "ARCHIVED" ? <button disabled={busy} onClick={() => void updateStatus(rubric.id, "ARCHIVED")} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Arsipkan</button> : null}{rubric.status === "ARCHIVED" ? <button disabled={busy} onClick={() => void updateStatus(rubric.id, "DRAFT")} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Kembalikan Draf</button> : null}</div>
        </article>)}
      </div>
      {initialRubrics.length === 0 ? <div className="tailadmin-card p-5 text-theme-sm text-gray-500">Belum ada template rubrik. Buat satu untuk memasangnya pada tugas.</div> : null}
    </section>
  );
}
