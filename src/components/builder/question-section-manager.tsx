"use client";

import { useState } from "react";
import type { QuizSection } from "@/lib/quiz-builder";

export function QuestionSectionManager({
  sections,
  onAdd,
  onPatch,
  onRemove,
  onMove,
}: {
  sections: QuizSection[];
  onAdd: () => void;
  onPatch: (_key: string, _patch: { title?: string; description?: string }) => void;
  onRemove: (_key: string) => void;
  onMove: (_from: number, _to: number) => void;
}) {
  const [dragKey, setDragKey] = useState<string | null>(null);

  return (
    <section className="tailadmin-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-gray-900">Bagian (section)</h2>
          <p className="mt-1 text-theme-xs text-gray-500">Pisahkan form menjadi beberapa halaman. Responden mengerjakan satu bagian per halaman.</p>
        </div>
        <button type="button" onClick={onAdd} className="tailadmin-button-outline px-3 py-2 text-theme-xs">+ Tambah bagian</button>
      </div>
      <div className="mt-3 grid gap-3">
        {sections.map((section, index) => (
          <div
            key={section.key}
            data-testid="builder-section-card"
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragKey) {
                const from = sections.findIndex((item) => item.key === dragKey);
                if (from !== -1) onMove(from, index);
              }
              setDragKey(null);
            }}
            className={`grid gap-2 rounded-xl border p-3 ${dragKey === section.key ? "border-dashed border-limo-blue-400 opacity-60" : "border-gray-200"}`}
          >
            <div className="flex items-center gap-2">
              <span
                draggable
                onDragStart={() => setDragKey(section.key)}
                onDragEnd={() => setDragKey(null)}
                role="button"
                tabIndex={0}
                aria-label={`Tarik untuk mengurutkan bagian ${index + 1}`}
                className="flex min-h-11 min-w-11 shrink-0 cursor-grab select-none items-center justify-center rounded-lg border border-gray-200 text-theme-xs text-gray-400 hover:bg-gray-50"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-4"><circle cx="9" cy="7" r="1.6" /><circle cx="15" cy="7" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="17" r="1.6" /><circle cx="15" cy="17" r="1.6" /></svg>
              </span>
              <span className="shrink-0 text-theme-xs font-bold text-gray-400">Bagian {index + 1}</span>
              <input value={section.title} onChange={(event) => onPatch(section.key, { title: event.target.value })} placeholder="Judul bagian" dir="auto" className="tailadmin-input" />
              <button type="button" onClick={() => onMove(index, index - 1)} disabled={index === 0} aria-label="Naikkan bagian" className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">↑</button>
              <button type="button" onClick={() => onMove(index, index + 1)} disabled={index === sections.length - 1} aria-label="Turunkan bagian" className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">↓</button>
              {sections.length > 1 ? (
                <button type="button" onClick={() => onRemove(section.key)} aria-label={`Hapus bagian ${index + 1}`} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-error-200 px-3 text-theme-xs text-error-600 hover:bg-error-50">Hapus</button>
              ) : null}
            </div>
            <input value={section.description} onChange={(event) => onPatch(section.key, { description: event.target.value })} placeholder="Deskripsi bagian (opsional)" dir="auto" className="tailadmin-input" />
          </div>
        ))}
      </div>
    </section>
  );
}
