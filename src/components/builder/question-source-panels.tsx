"use client";

import { useState } from "react";
import { requestJson } from "@/lib/api-json-client";

type BankResult = { id: string; type: string; question: string };
type ImportSourceOption = { id: string; title: string };

export function BankSoalPicker({ formId, onError }: { formId: string; onError: (_message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<BankResult[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function search(value: string) {
    setBusy(true);
    onError("");
    try {
      const query = new URLSearchParams({ pageSize: "50" });
      if (value.trim()) query.set("search", value.trim());
      const result = await requestJson<{ items: BankResult[] }>(`/api/v1/bank-soal?${query.toString()}`, { fallbackMessage: "Gagal memuat bank soal" });
      setResults(result.data.items);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Gagal memuat bank soal");
    } finally {
      setBusy(false);
    }
  }

  function openPicker() {
    setOpen(true);
    setSelected([]);
    void search(term);
  }

  async function addSelected() {
    if (selected.length === 0) return;
    setBusy(true);
    onError("");
    try {
      await requestJson<{ added: number; skipped: number }>(`/api/v1/kuis/${formId}/questions`, { method: "POST", body: { bankSoalIds: selected }, fallbackMessage: "Gagal menambahkan soal" });
      window.location.reload();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Gagal menambahkan soal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tailadmin-card p-5">
      <h2 className="font-semibold text-gray-900">Ambil dari bank soal</h2>
      <p className="mt-1 text-theme-xs text-gray-500">Tambahkan soal yang sudah pernah Anda buat tanpa menyalin ulang.</p>
      <button type="button" onClick={openPicker} className="tailadmin-button-outline mt-3 px-4 py-2">Buka bank soal</button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="bank-picker-title" className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-5 shadow-theme-xl">
            <h3 id="bank-picker-title" className="text-lg font-semibold text-gray-900">Bank soal</h3>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Cari pertanyaan" aria-label="Cari bank soal" className="tailadmin-input sm:max-w-xs" />
              <button type="button" onClick={() => void search(term)} disabled={busy} className="tailadmin-button-outline px-3 py-2">{busy ? "Memuat..." : "Cari"}</button>
              <span className="text-theme-xs text-gray-500">{selected.length} dipilih</span>
            </div>
            <ul className="mt-3 flex-1 space-y-2 overflow-y-auto">
              {results.length === 0 ? <li className="text-theme-sm text-gray-500">Tidak ada soal ditemukan.</li> : null}
              {results.map((item) => (
                <li key={item.id} className="flex items-start gap-3 rounded-xl border border-gray-200 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={(event) => setSelected((current) => (event.target.checked ? [...current, item.id] : current.filter((value) => value !== item.id)))}
                    aria-label={`Pilih soal ${item.question.slice(0, 40)}`}
                    className="mt-1 accent-limo-blue-500"
                  />
                  <div className="min-w-0">
                    <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">{item.type}</p>
                    <p className="mt-0.5 line-clamp-2 text-theme-sm text-gray-700" dir="auto">{item.question}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className="tailadmin-button-outline px-4 py-2.5">Tutup</button>
              <button type="button" onClick={() => void addSelected()} disabled={busy || selected.length === 0} className="tailadmin-button-primary px-5 py-2.5">{busy ? "Menambahkan..." : "Tambahkan ke formulir"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export function ImportQuestions({ formId, options, onError }: { formId: string; options: ImportSourceOption[]; onError: (_message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [list, setList] = useState<{ id: string; question: string; type: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function loadSource(id: string) {
    if (!id) {
      setList([]);
      setSelected([]);
      return;
    }

    setBusy(true);
    onError("");
    try {
      const result = await requestJson<{ item: { questions: { id: string; question: string; type: string }[] } }>(`/api/v1/kuis/${id}`, { fallbackMessage: "Gagal memuat soal sumber" });
      setList(result.data.item.questions);
      setSelected(result.data.item.questions.map((question) => question.id));
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Gagal memuat soal sumber");
      setList([]);
      setSelected([]);
    } finally {
      setBusy(false);
    }
  }

  async function runImport(ids?: string[]) {
    if (!sourceId) return;
    onError("");
    setBusy(true);
    try {
      const payload = ids && ids.length > 0 ? { sourceUjianId: sourceId, questionIds: ids } : { sourceUjianId: sourceId };
      await requestJson(`/api/v1/kuis/${formId}/import-questions`, { method: "POST", body: payload, fallbackMessage: "Gagal mengimpor soal" });
      window.location.reload();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Gagal mengimpor soal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tailadmin-card p-5">
      <h2 className="font-semibold text-gray-900">Impor soal dari formulir lain</h2>
      <p className="mt-1 text-theme-xs text-gray-500">Pilih formulir sumber, lalu pilih soal mana yang ingin disalin atau salin semuanya.</p>
      <button type="button" onClick={() => { setOpen(true); setSourceId(""); setList([]); setSelected([]); }} className="tailadmin-button-outline mt-3 px-4 py-2">Buka impor soal</button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="import-questions-title" className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-5 shadow-theme-xl">
            <h3 id="import-questions-title" className="text-lg font-semibold text-gray-900">Impor soal</h3>
            <label className="mt-3 block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
              Formulir sumber
              <select value={sourceId} onChange={(event) => { setSourceId(event.target.value); void loadSource(event.target.value); }} aria-label="Pilih formulir sumber" className="mt-1 tailadmin-input">
                <option value="">Pilih formulir sumber</option>
                {options.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
              </select>
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-theme-xs text-gray-500">{busy ? "Memuat soal..." : `${selected.length} dari ${list.length} soal dipilih`}</span>
              {list.length > 0 ? (
                <button type="button" onClick={() => setSelected(selected.length === list.length ? [] : list.map((question) => question.id))} className="tailadmin-button-outline px-3 py-1.5 text-theme-xs">
                  {selected.length === list.length ? "Kosongkan pilihan" : "Pilih semua"}
                </button>
              ) : null}
            </div>
            <ul className="mt-3 flex-1 space-y-2 overflow-y-auto">
              {list.length === 0 && !busy && sourceId ? <li className="text-theme-sm text-gray-500">Formulir sumber belum memiliki soal.</li> : null}
              {list.map((item) => (
                <li key={item.id} className="flex items-start gap-3 rounded-xl border border-gray-200 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={(event) => setSelected((current) => (event.target.checked ? [...current, item.id] : current.filter((value) => value !== item.id)))}
                    aria-label={`Pilih soal ${item.question.slice(0, 40)}`}
                    className="mt-1 accent-limo-blue-500"
                  />
                  <div className="min-w-0">
                    <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">{item.type}</p>
                    <p className="mt-0.5 line-clamp-2 text-theme-sm text-gray-700" dir="auto">{item.question}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className="tailadmin-button-outline px-4 py-2.5">Tutup</button>
              <button type="button" onClick={() => void runImport()} disabled={busy || !sourceId} className="tailadmin-button-outline px-4 py-2.5">{busy ? "Mengimpor..." : "Impor semua soal"}</button>
              <button type="button" onClick={() => void runImport(selected)} disabled={busy || selected.length === 0} className="tailadmin-button-primary px-5 py-2.5">{busy ? "Mengimpor..." : "Impor soal terpilih"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
