"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DateValue = string | Date | null;
export type Category = { id: string; name: string; weight: number; dropLowestCount: number; status: string; itemCount: number };
export type Item = { id: string; categoryId: string; categoryName: string; sourceType: string; sourceId: string | null; title: string; order: number; maxScore: number; weightOverride: number | null; isExtraCredit: boolean; status: string; dueAt: DateValue };
type RowItem = { id: string; title: string; sourceType: string; sourceId: string | null; maxScore: number; normalizedScore: number | null; rawScore: number | null; status: string; isLate: boolean; feedbackSummary: string | null; isExtraCredit: boolean };
export type Row = { student: { id: string; name: string; nomorInduk: string }; categories: Array<{ id: string; name: string; weight: number; score: number | null; incomplete: boolean; items: RowItem[] }>; calculatedScore: number | null; letterGrade: string | null; completionStatus: string; finalGrade: { status: string; publishedScore: unknown } | null };
export type GradebookData = { categories: Category[]; items: Item[]; rows: Row[]; weightTotal: number };
export type Source = { id: string; title: string; maxScore: number; dueAt: DateValue; status: string };

async function requestJson(path: string, options: RequestInit = {}) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
  const payload = (await response.json().catch(() => ({}))) as { data?: unknown; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || "Perubahan gradebook gagal disimpan");
  return payload.data;
}

export function GradebookManager({ classId, initialData, assignments, exams }: { classId: string; initialData: GradebookData; assignments: Source[]; exams: Source[] }) {
  const router = useRouter();
  const [categoryName, setCategoryName] = useState("");
  const [categoryWeight, setCategoryWeight] = useState("25");
  const [categoryDrop, setCategoryDrop] = useState("0");
  const [itemCategory, setItemCategory] = useState(initialData.categories[0]?.id || "");
  const [itemType, setItemType] = useState("MANUAL");
  const [itemSourceId, setItemSourceId] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemMaxScore, setItemMaxScore] = useState("100");
  const [itemWeight, setItemWeight] = useState("");
  const [itemExtraCredit, setItemExtraCredit] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const sourceOptions = itemType === "ASSIGNMENT" ? assignments : itemType === "EXAM" ? exams : [];
  const visibleRows = initialData.rows.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(initialData.rows.length / pageSize));

  function selectedSource() {
    return sourceOptions.find((source) => source.id === itemSourceId);
  }

  function selectSource(sourceId: string) {
    setItemSourceId(sourceId);
    const source = sourceOptions.find((candidate) => candidate.id === sourceId);
    if (source) {
      setItemTitle(source.title);
      setItemMaxScore(String(source.maxScore));
    }
  }

  async function createCategory() {
    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/v1/guru/kelas/${classId}/gradebook/categories`, { method: "POST", body: JSON.stringify({ name: categoryName, weight: Number(categoryWeight), dropLowestCount: Number(categoryDrop), order: initialData.categories.length }) });
      setCategoryName("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kategori gagal dibuat");
    } finally {
      setBusy(false);
    }
  }

  async function createItem() {
    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/v1/guru/kelas/${classId}/gradebook/items`, { method: "POST", body: JSON.stringify({ categoryId: itemCategory, sourceType: itemType, sourceId: itemSourceId, title: itemTitle, maxScore: Number(itemMaxScore), weightOverride: itemWeight ? Number(itemWeight) : undefined, isExtraCredit: itemExtraCredit, order: initialData.items.filter((item) => item.categoryId === itemCategory).length, confirmPublishedChange: false }) });
      setItemTitle("");
      setItemSourceId("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Item gradebook gagal dibuat");
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(path: string, status: string, label: string) {
    if (!window.confirm(`${label} gradebook?`)) return;
    setBusy(true);
    setError("");
    try {
      await requestJson(path, { method: "PATCH", body: JSON.stringify({ status, confirmPublishedChange: true }) });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status gradebook gagal diubah");
    } finally {
      setBusy(false);
    }
  }

  async function syncItem(itemId: string) {
    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/v1/guru/gradebook/items/${itemId}/sync`, { method: "POST" });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sinkronisasi gagal");
    } finally {
      setBusy(false);
    }
  }

  async function publishFinal() {
    if (!window.confirm("Publikasikan nilai akhir untuk semua siswa yang lengkap?")) return;
    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/v1/guru/kelas/${classId}/gradebook/publish`, { method: "POST", body: JSON.stringify({ correctionReason }) });
      setCorrectionReason("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nilai akhir gagal dipublikasikan");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-6">
    {error ? <p className="tailadmin-alert-error">{error}</p> : null}
    <section className="grid gap-4 xl:grid-cols-2">
      <div className="tailadmin-card grid gap-3 p-5"><div><p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">Konfigurasi bobot</p><h2 className="mt-1 text-lg font-semibold text-gray-900">Tambah kategori</h2></div><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem]"><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Tugas / Ujian / Speaking" className="tailadmin-input" /><input value={categoryWeight} onChange={(event) => setCategoryWeight(event.target.value)} type="number" min={0.01} max={100} step="0.01" placeholder="Bobot %" className="tailadmin-input" /><input value={categoryDrop} onChange={(event) => setCategoryDrop(event.target.value)} type="number" min={0} max={20} placeholder="Drop lowest" className="tailadmin-input" /></div><button type="button" disabled={busy || !categoryName.trim()} onClick={() => void createCategory()} className="tailadmin-button-primary w-fit px-4 py-2 text-theme-xs">Simpan Kategori Draft</button></div>
      <div className="tailadmin-card grid gap-3 p-5"><div><p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">Sumber nilai</p><h2 className="mt-1 text-lg font-semibold text-gray-900">Tambah grade item</h2></div><div className="grid gap-3 sm:grid-cols-2"><select value={itemCategory} onChange={(event) => setItemCategory(event.target.value)} className="tailadmin-input"><option value="">Pilih kategori</option>{initialData.categories.map((category) => <option key={category.id} value={category.id}>{category.name} / {category.weight}%</option>)}</select><select value={itemType} onChange={(event) => { setItemType(event.target.value); setItemSourceId(""); }} className="tailadmin-input"><option value="MANUAL">Manual</option><option value="ASSIGNMENT">Assignment</option><option value="EXAM">Ujian</option><option value="QUIZ">Quiz (belum tersedia)</option></select></div>{itemType !== "MANUAL" ? <select value={itemSourceId} onChange={(event) => selectSource(event.target.value)} className="tailadmin-input"><option value="">Pilih sumber</option>{sourceOptions.map((source) => <option key={source.id} value={source.id}>{source.title} / {source.status}</option>)}</select> : null}<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem]"><input value={itemTitle} onChange={(event) => setItemTitle(event.target.value)} placeholder="Judul item" className="tailadmin-input" /><input value={itemMaxScore} onChange={(event) => setItemMaxScore(event.target.value)} type="number" min={0.01} step="0.01" placeholder="Nilai maks" className="tailadmin-input" /><input value={itemWeight} onChange={(event) => setItemWeight(event.target.value)} type="number" min={0} max={100} step="0.01" placeholder="Bobot item" className="tailadmin-input" /></div><label className="flex items-center gap-2 text-theme-sm text-gray-600"><input type="checkbox" checked={itemExtraCredit} onChange={(event) => setItemExtraCredit(event.target.checked)} /> Extra credit</label><button type="button" disabled={busy || !itemCategory || !itemTitle.trim()} onClick={() => void createItem()} className="tailadmin-button-primary w-fit px-4 py-2 text-theme-xs">Simpan Item Draft</button>{itemType !== "MANUAL" && selectedSource() ? <p className="text-theme-xs text-gray-500">Sumber akan disinkronkan setelah item dipublikasikan.</p> : null}</div>
    </section>

    <section className="tailadmin-card p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">Gradebook</p><h2 className="mt-1 text-lg font-semibold text-gray-900">Kategori dan item</h2><p className="mt-1 text-theme-sm text-gray-500">Total bobot aktif: <strong>{initialData.weightTotal}%</strong>. Publish final membutuhkan tepat 100% dan seluruh komponen selesai atau EXEMPT.</p></div><div className="flex flex-wrap gap-2"><input value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="Alasan koreksi (opsional)" className="tailadmin-input" /><button type="button" disabled={busy || initialData.weightTotal < 99.99 || initialData.weightTotal > 100.01} onClick={() => void publishFinal()} className="tailadmin-button-primary px-3 py-2 text-theme-xs">Publish Nilai Akhir</button></div></div><div className="mt-4 space-y-3">{initialData.categories.map((category) => <div key={category.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-gray-900">{category.name}</p><p className="text-theme-xs text-gray-500">Bobot {category.weight}% / drop lowest {category.dropLowestCount} / {category.itemCount} item</p></div><div className="flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusClass(category.status)}`}>{category.status}</span>{category.status !== "PUBLISHED" ? <button disabled={busy} onClick={() => void updateStatus(`/api/v1/guru/gradebook/categories/${category.id}`, "PUBLISHED", "Publish kategori")} className="tailadmin-button-primary px-3 py-1.5 text-theme-xs">Publish</button> : <button disabled={busy} onClick={() => void updateStatus(`/api/v1/guru/gradebook/categories/${category.id}`, "ARCHIVED", "Arsipkan kategori")} className="tailadmin-button-outline px-3 py-1.5 text-theme-xs">Arsipkan</button>}</div></div><div className="mt-3 grid gap-2 md:grid-cols-2">{initialData.items.filter((item) => item.categoryId === category.id).map((item) => <div key={item.id} className="rounded-xl bg-white p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-theme-sm font-semibold text-gray-800">{item.title}</p><p className="text-theme-xs text-gray-500">{item.sourceType} / Maks {item.maxScore}{item.weightOverride !== null ? ` / Bobot ${item.weightOverride}%` : " / Bobot rata"}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass(item.status)}`}>{item.status}</span></div><div className="mt-2 flex flex-wrap gap-2">{item.status === "DRAFT" ? <button disabled={busy || category.status !== "PUBLISHED"} onClick={() => void updateStatus(`/api/v1/guru/gradebook/items/${item.id}`, "PUBLISHED", "Publish item")} className="tailadmin-button-primary px-2.5 py-1.5 text-[11px]">Publish</button> : <button disabled={busy} onClick={() => void updateStatus(`/api/v1/guru/gradebook/items/${item.id}`, "LOCKED", "Lock item")} className="tailadmin-button-outline px-2.5 py-1.5 text-[11px]">Lock</button>}{item.sourceId ? <button disabled={busy} onClick={() => void syncItem(item.id)} className="tailadmin-button-outline px-2.5 py-1.5 text-[11px]">Sync sumber</button> : null}</div></div>)}</div></div>)}</div></section>

    <section className="tailadmin-card overflow-hidden"><div className="flex flex-col gap-2 p-5 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-semibold text-gray-900">Tabel nilai siswa</h2><p className="mt-1 text-theme-sm text-gray-500">MISSING berbeda dari skor 0. Entry manual dapat diedit pada item MANUAL yang published.</p></div><p className="text-theme-xs text-gray-500">{initialData.rows.length} siswa / halaman {page} dari {totalPages}</p></div><div className="overflow-x-auto"><table className="min-w-full text-left text-theme-sm"><thead className="border-y border-gray-100 bg-gray-50 text-theme-xs uppercase tracking-wide text-gray-500"><tr><th className="whitespace-nowrap px-4 py-3">Siswa</th>{initialData.items.filter((item) => item.status !== "DRAFT").map((item) => <th key={item.id} className="min-w-36 whitespace-nowrap px-4 py-3">{item.title}</th>)}<th className="whitespace-nowrap px-4 py-3">Nilai akhir</th></tr></thead><tbody className="divide-y divide-gray-100">{visibleRows.map((row) => <tr key={row.student.id}><td className="whitespace-nowrap px-4 py-4"><p className="font-semibold text-gray-900">{row.student.name}</p><p className="text-theme-xs text-gray-500">{row.student.nomorInduk}</p></td>{initialData.items.filter((item) => item.status !== "DRAFT").map((item) => <td key={item.id} className="px-4 py-4 align-top"><ManualEntryCell classId={classId} item={item} row={row} onSaved={() => router.refresh()} /></td>)}<td className="whitespace-nowrap px-4 py-4"><p className="font-semibold text-gray-900">{row.calculatedScore ?? "-"} / {row.letterGrade || "-"}</p><p className={`text-theme-xs ${row.completionStatus === "COMPLETE" ? "text-success-600" : "text-warning-600"}`}>{row.completionStatus}</p></td></tr>)}</tbody></table></div><div className="flex items-center justify-between gap-3 border-t border-gray-100 p-4"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Sebelumnya</button><button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Berikutnya</button></div></section>
  </div>;
}

function ManualEntryCell({ item, row, onSaved }: { classId: string; item: Item; row: Row; onSaved: () => void }) {
  const result = row.categories.flatMap((category) => category.items).find((candidate) => candidate.id === item.id);
  const [editing, setEditing] = useState(false);
  const [score, setScore] = useState(result?.rawScore?.toString() || "");
  const [status, setStatus] = useState(result?.status || "MISSING");
  const [error, setError] = useState("");
  if (!result) return <span className="text-theme-xs text-gray-400">-</span>;
  if (editing && item.sourceType === "MANUAL") return <div className="grid gap-2"><input value={score} onChange={(event) => setScore(event.target.value)} type="number" min={0} max={item.maxScore} className="tailadmin-input w-24" /><select value={status} onChange={(event) => setStatus(event.target.value)} className="tailadmin-input text-[11px]"><option value="GRADED">GRADED</option><option value="EXEMPT">EXEMPT</option><option value="REMEDIAL">REMEDIAL</option><option value="MISSING">MISSING</option></select><div className="flex gap-1"><button onClick={async () => { setError(""); try { const response = await fetch(`/api/v1/guru/gradebook/items/${item.id}/entries`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: row.student.id, rawScore: score ? Number(score) : undefined, status }) }); if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: { message?: string } }; throw new Error(payload.error?.message || "Entry gagal disimpan"); } setEditing(false); onSaved(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Entry gagal disimpan"); } }} className="tailadmin-button-primary px-2 py-1 text-[11px]">Simpan</button><button onClick={() => setEditing(false)} className="tailadmin-button-outline px-2 py-1 text-[11px]">Batal</button></div>{error ? <span className="text-[11px] text-error-600">{error}</span> : null}</div>;
  return <button type="button" onClick={() => item.sourceType === "MANUAL" && setEditing(true)} className={`text-left ${item.sourceType === "MANUAL" ? "cursor-pointer" : "cursor-default"}`}><p className="font-semibold text-gray-800">{result.normalizedScore ?? "-"}</p><p className="text-[11px] text-gray-500">{result.status}{result.isLate ? " / late" : ""}</p></button>;
}

function statusClass(status: string) {
  return { DRAFT: "bg-gray-100 text-gray-700", PUBLISHED: "bg-success-50 text-success-700", LOCKED: "bg-brand-50 text-brand-700", ARCHIVED: "bg-error-50 text-error-700" }[status] || "bg-gray-100 text-gray-700";
}
