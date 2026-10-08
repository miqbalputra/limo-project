"use client";

import { useMemo, useState } from "react";
import { LocalizedContent } from "@/components/localized-content";
import { pairLeftAnchor, pairRightAnchor } from "@/lib/quiz-builder";

export type MatchingPair = { left: string; right: string; leftMediaUrl: string | null; rightMediaUrl: string | null };

function shuffledIndices(count: number, seed: string): number[] {
  const indices = Array.from({ length: count }, (_, index) => index);
  if (count < 2) return indices;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let state = hash >>> 0;
  const nextRandom = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

export function MatchingInput({
  pairs,
  value,
  onChangeValue,
  language,
  seed,
}: {
  pairs: MatchingPair[];
  value: Record<string, unknown> | undefined;
  onChangeValue: (_next: Record<string, string>) => void;
  language: string | null;
  seed: string;
}) {
  const [selectedRight, setSelectedRight] = useState<number | null>(null);
  const [dragRight, setDragRight] = useState<number | null>(null);
  const [dragOverLeft, setDragOverLeft] = useState<number | null>(null);
  const shuffledOrder = useMemo(() => shuffledIndices(pairs.length, seed), [pairs.length, seed]);

  if (pairs.length === 0) return null;

  const assigned = (leftIndex: number): number | null => {
    const stored = value?.[pairLeftAnchor(pairs[leftIndex]?.left ?? "", leftIndex)];
    if (typeof stored !== "string" || !stored) return null;
    const found = pairs.findIndex((pair, index) => pairRightAnchor(pair.right, index) === stored);
    return found === -1 ? null : found;
  };

  const assign = (leftIndex: number, rightIndex: number) => {
    const anchor = pairLeftAnchor(pairs[leftIndex]?.left ?? "", leftIndex);
    const right = pairRightAnchor(pairs[rightIndex]?.right ?? "", rightIndex);
    onChangeValue({ ...(value as Record<string, string>), [anchor]: right });
  };

  const clear = (leftIndex: number) => {
    const anchor = pairLeftAnchor(pairs[leftIndex]?.left ?? "", leftIndex);
    const next = { ...(value as Record<string, string>) };
    delete next[anchor];
    onChangeValue(next);
  };

  const toggleSelect = (rightIndex: number) => {
    setSelectedRight((current) => (current === rightIndex ? null : rightIndex));
  };

  const resolveRight = (rightIndex: number) => {
    const pair = pairs[rightIndex];
    if (!pair) return null;
    return { mediaUrl: pair.rightMediaUrl, text: pair.right };
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid content-start gap-3">
        {pairs.map((pair, leftIndex) => {
          const matchedIndex = assigned(leftIndex);
          const matched = matchedIndex === null ? null : resolveRight(matchedIndex);
          const highlighted = dragOverLeft === leftIndex;
          return (
            <div
              key={leftIndex}
              onDragOver={(event) => {
                if (dragRight === null) return;
                event.preventDefault();
                setDragOverLeft(leftIndex);
              }}
              onDragLeave={() => setDragOverLeft((current) => (current === leftIndex ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                if (dragRight !== null) assign(leftIndex, dragRight);
                setDragRight(null);
                setDragOverLeft(null);
              }}
              className={`rounded-xl border p-3 transition ${highlighted ? "border-limo-blue-400 bg-limo-blue-50" : "border-gray-200 bg-white"}`}
            >
              <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">Soal {leftIndex + 1}</p>
              <div className="mt-1.5 flex items-center gap-2">
                {pair.leftMediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pair.leftMediaUrl} alt={`Soal ${leftIndex + 1}`} className="max-h-20 rounded-lg object-contain ring-1 ring-gray-100" />
                ) : null}
                {pair.left ? <LocalizedContent text={pair.left} language={language} direction="auto" className="min-w-0 flex-1 text-theme-sm text-gray-800">{pair.left}</LocalizedContent> : null}
                {!pair.left && !pair.leftMediaUrl ? <span className="text-theme-sm text-gray-400">(kosong)</span> : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (selectedRight !== null) {
                    assign(leftIndex, selectedRight);
                    setSelectedRight(null);
                  }
                }}
                disabled={selectedRight === null}
                aria-label={`Jodoh untuk soal ${leftIndex + 1}${matched ? ", sudah dipasangkan" : ", belum dipasangkan"}`}
                className={`mt-2 flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-start text-theme-sm transition ${matched ? "border-solid border-gray-200 bg-gray-50 text-gray-700" : "border-gray-300 text-gray-400"} ${selectedRight !== null ? "cursor-pointer hover:border-limo-blue-400 hover:bg-limo-blue-50" : "cursor-default"}`}
              >
                {matched ? (
                  <>
                    {matched.mediaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={matched.mediaUrl} alt={`Jodoh soal ${leftIndex + 1}`} className="max-h-12 rounded object-contain ring-1 ring-gray-100" />
                    ) : null}
                    {matched.text ? <LocalizedContent text={matched.text} language={language} direction="auto" className="min-w-0 flex-1">{matched.text}</LocalizedContent> : null}
                    {!matched.text && !matched.mediaUrl ? <span>(kosong)</span> : null}
                  </>
                ) : (
                  <span>{selectedRight !== null ? "Klik untuk memasangkan jodoh terpilih" : "Tarik kartu jodoh ke sini"}</span>
                )}
              </button>
              {matched ? (
                <button type="button" onClick={() => clear(leftIndex)} className="mt-1.5 text-theme-xs font-semibold text-red-500 hover:underline">
                  Hapus pasangan
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="grid content-start gap-3 sm:border-s sm:border-gray-100 sm:ps-4">
        {shuffledOrder.map((rightIndex, displayIndex) => {
          const pair = pairs[rightIndex];
          const selected = selectedRight === rightIndex;
          return (
            <div
              key={rightIndex}
              draggable
              onDragStart={(event) => {
                setDragRight(rightIndex);
                event.dataTransfer.setData("text/plain", String(rightIndex));
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                setDragRight(null);
                setDragOverLeft(null);
              }}
              onClick={() => toggleSelect(rightIndex)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleSelect(rightIndex);
                }
              }}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={`Jodoh ${displayIndex + 1}. Tekan untuk memilih, lalu tekan kartu soal tujuan.`}
              className={`cursor-grab rounded-xl p-3 ring-1 transition active:cursor-grabbing ${selected ? "bg-limo-blue-50 ring-limo-blue-400" : dragRight === rightIndex ? "bg-gray-50 ring-gray-300 opacity-60" : "bg-gray-50 ring-gray-200 hover:ring-gray-300"}`}
            >
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-theme-xs font-bold text-gray-600 ring-1 ring-gray-200">{displayIndex + 1}</span>
                {pair.rightMediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pair.rightMediaUrl} alt={`Jodoh ${displayIndex + 1}`} className="max-h-20 rounded-lg object-contain ring-1 ring-gray-100" />
                ) : null}
                {pair.right ? <LocalizedContent text={pair.right} language={language} direction="auto" className="min-w-0 flex-1 text-theme-sm text-gray-700">{pair.right}</LocalizedContent> : null}
                {!pair.right && !pair.rightMediaUrl ? <span className="text-theme-sm text-gray-400">(kosong)</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SequenceInput({
  items,
  value,
  onChangeValue,
  seed,
}: {
  items: string[];
  value: unknown;
  onChangeValue: (_next: string[]) => void;
  seed: string;
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const shuffledOrder = useMemo(() => shuffledIndices(items.length, `${seed}-pool`), [items.length, seed]);
  const given = Array.isArray(value) ? items.map((_, index) => (typeof value[index] === "string" ? String(value[index]) : "")) : items.map(() => "");

  if (items.length === 0) return null;

  const setAt = (index: number, item: string) => {
    const next = [...given];
    next[index] = item;
    onChangeValue(next);
  };

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return;
    const next = [...given];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChangeValue(next);
  };

  return (
    <div className="grid gap-2">
      {items.map((_, index) => (
        <div
          key={index}
          draggable
          onDragStart={() => setDragFrom(index)}
          onDragEnd={() => {
            setDragFrom(null);
            setDragOverIndex(null);
          }}
          onDragOver={(event) => {
            if (dragFrom === null) return;
            event.preventDefault();
            setDragOverIndex(index);
          }}
          onDragLeave={() => setDragOverIndex((current) => (current === index ? null : current))}
          onDrop={(event) => {
            event.preventDefault();
            if (dragFrom !== null) move(dragFrom, index);
            setDragFrom(null);
            setDragOverIndex(null);
          }}
          className={`flex items-center gap-2 rounded-lg border p-1 transition ${dragOverIndex === index ? "border-limo-blue-400 bg-limo-blue-50" : dragFrom === index ? "border-gray-300 opacity-60" : "border-transparent"}`}
        >
          <span
            aria-hidden="true"
            title="Tarik untuk mengurutkan"
            className="grid size-7 shrink-0 cursor-grab place-items-center rounded-full bg-gray-100 text-theme-xs font-bold text-gray-600 active:cursor-grabbing"
          >
            {index + 1}
          </span>
          <select
            value={given[index] ?? ""}
            onChange={(event) => setAt(index, event.target.value)}
            aria-label={`Posisi ${index + 1}`}
            className="tailadmin-input min-w-0 flex-1"
          >
            <option value="">Pilih urutan</option>
            {shuffledOrder.map((choiceIndex) => (
              <option key={choiceIndex} value={items[choiceIndex]}>{items[choiceIndex] || `Item ${choiceIndex + 1}`}</option>
            ))}
          </select>
          <div className="flex shrink-0 flex-col">
            <button
              type="button"
              onClick={() => move(index, index - 1)}
              disabled={index === 0}
              aria-label={`Naikkan posisi ${index + 1}`}
              className="rounded px-1 text-theme-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => move(index, index + 1)}
              disabled={index === items.length - 1}
              aria-label={`Turunkan posisi ${index + 1}`}
              className="rounded px-1 text-theme-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
            >
              ▼
            </button>
          </div>
        </div>
      ))}
      <p className="text-theme-xs text-gray-500">Tarik nomor untuk menukar urutan, atau pakai tombol ▲▼.</p>
    </div>
  );
}
