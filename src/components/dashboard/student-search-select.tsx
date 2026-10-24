"use client";

import { useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/api-json-client";

type Option = { id: string; name: string };

type SiswaSearchResult = {
  items: Option[];
  pagination?: { total: number };
};

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const SEARCH_PAGE_SIZE = 50;

export function StudentSearchSelect({
  name,
  options,
  totalOptions,
  defaultValue = "",
  selectedLabel,
  emptyLabel,
  ariaLabel,
}: {
  name: string;
  options: Option[];
  totalOptions?: number;
  defaultValue?: string;
  selectedLabel?: string | null;
  emptyLabel: string;
  ariaLabel: string;
}) {
  const [selectedId, setSelectedId] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Option[] | null>(null);
  const [matchedTotal, setMatchedTotal] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      return;
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsSearching(true);
      setSearchError("");

      requestJson<SiswaSearchResult>(
        `/api/v1/admin/siswa?search=${encodeURIComponent(trimmed)}&pageSize=${SEARCH_PAGE_SIZE}`,
        { fallbackMessage: "Pencarian siswa gagal", signal: controller.signal },
      )
        .then((response) => {
          setResults(response.data.items);
          setMatchedTotal(response.data.pagination?.total ?? response.data.items.length);
        })
        .catch((caught) => {
          if (controller.signal.aborted || (caught instanceof DOMException && caught.name === "AbortError")) return;
          setSearchError("Pencarian gagal — menampilkan daftar awal.");
          setResults(null);
          setMatchedTotal(null);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [query]);

  function onQueryChange(nextQuery: string) {
    setQuery(nextQuery);

    if (nextQuery.trim().length < MIN_QUERY_LENGTH) {
      abortRef.current?.abort();
      setResults(null);
      setMatchedTotal(null);
      setSearchError("");
      setIsSearching(false);
    }
  }

  const visibleOptions = results ?? options;
  const merged = selectedId && !visibleOptions.some((item) => item.id === selectedId)
    ? [{ id: selectedId, name: selectedLabel || "Siswa terpilih" }, ...visibleOptions]
    : visibleOptions;
  const baselineTotal = matchedTotal ?? totalOptions ?? options.length;

  return (
    <div className="grid gap-1.5">
      <input
        type="search"
        inputMode="search"
        autoComplete="off"
        aria-label={`Cari ${ariaLabel.toLowerCase()} (nama atau nomor induk)`}
        placeholder="Ketik nama / NIS untuk mencari"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        className="tailadmin-input"
      />
      <select
        name={name}
        aria-label={ariaLabel}
        value={selectedId}
        onChange={(event) => setSelectedId(event.target.value)}
        className="tailadmin-input"
      >
        <option value="">{emptyLabel}</option>
        {merged.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <p aria-live="polite" className="min-h-4 text-theme-xs text-gray-400">
        {isSearching ? "Mencari siswa…" : searchError || (baselineTotal > visibleOptions.length ? `Menampilkan ${visibleOptions.length} dari ${baselineTotal} siswa — persempit lewat pencarian.` : "")}
      </p>
    </div>
  );
}
