"use client";

import { useEffect, useState } from "react";
import { requestJson } from "@/lib/api-json-client";
import type { QuizFormState } from "@/lib/quiz-builder";
import type { PreflightItem } from "@/components/forms-builder/form-state";

const THEME_COLORS = [
  { value: "blue", label: "Biru", hex: "#465fff" },
  { value: "green", label: "Hijau", hex: "#12b76a" },
  { value: "purple", label: "Ungu", hex: "#7a5af8" },
  { value: "orange", label: "Oranye", hex: "#f79009" },
  { value: "red", label: "Merah", hex: "#f04438" },
  { value: "teal", label: "Teal", hex: "#15b79e" },
  { value: "slate", label: "Abu", hex: "#475467" },
] as const;

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-gray-950/40" role="presentation">
      <aside role="dialog" aria-modal="true" aria-label={title} className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white p-6 shadow-theme-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-9 place-items-center rounded-full text-gray-400 hover:bg-gray-100">✕</button>
        </div>
        <div className="mt-4 grid gap-4 pb-6">{children}</div>
      </aside>
    </div>
  );
}

export function SettingsSheet({ form, kelasOptions, onPatch, onUploadHeaderImage, onClose }: {
  form: QuizFormState;
  kelasOptions: { id: string; name: string }[];
  onPatch: (_patch: Partial<QuizFormState>) => void;
  onUploadHeaderImage: (_file: File) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"umum" | "kuis" | "respons" | "lanjutan">("umum");

  return (
    <Sheet title="Pengaturan formulir" onClose={onClose}>
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {([["umum", "Umum"], ["kuis", "Kuis"], ["respons", "Respons"], ["lanjutan", "Lanjutan"]] as const).map(([value, label]) => (
          <button key={value} type="button" onClick={() => setTab(value)} aria-pressed={tab === value} className={`flex-1 rounded-lg px-3 py-1.5 text-theme-xs font-semibold ${tab === value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>{label}</button>
        ))}
      </div>

      {tab === "umum" ? (
        <div className="grid gap-4">
          <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Kelas (opsional — kosongkan untuk formulir publik tanpa kelas)
            <select value={form.kelasId} onChange={(event) => onPatch({ kelasId: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none">
              <option value="">Tanpa kelas — tautan publik</option>
              {kelasOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Mode pengiriman
            <select value={form.deliveryMode} onChange={(event) => onPatch({ deliveryMode: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none">
              <option value="ONLINE_VIA_WALI">Online via wali</option>
              <option value="ONLINE_VIA_SISWA">Online via siswa</option>
              <option value="BOTH">Online + input guru</option>
              <option value="TEACHER_ENTRY">Input guru saja</option>
            </select>
            {!form.kelasId && form.deliveryMode !== "TEACHER_ENTRY" ? <span className="mt-1 block text-theme-xs font-normal normal-case text-warning-600">Tanpa kelas, formulir hanya bisa dikirim lewat tautan publik.</span> : null}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
              Durasi (menit)
              <input type="number" min={1} max={600} value={form.durationMinutes} onChange={(event) => onPatch({ durationMinutes: Number(event.target.value) || 1 })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
            </label>
            <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
              Maks. percobaan
              <input type="number" min={1} max={5} value={form.maxAttempts} onChange={(event) => onPatch({ maxAttempts: Number(event.target.value) || 1 })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
            </label>
            <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
              Tanggal ujian (opsional)
              <input type="date" value={form.examDate} onChange={(event) => onPatch({ examDate: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
            </label>
            <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
              Tampilan soal
              <select value={form.presentationMode} onChange={(event) => onPatch({ presentationMode: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none">
                <option value="ALL">Semua soal sekaligus</option>
                <option value="ONE_PER_PAGE">Satu soal per halaman</option>
              </select>
            </label>
            <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
              Tersedia mulai (opsional)
              <input type="date" value={form.availableFrom} onChange={(event) => onPatch({ availableFrom: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
            </label>
            <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
              Tersedia sampai (opsional)
              <input type="date" value={form.availableUntil} onChange={(event) => onPatch({ availableUntil: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
            </label>
          </div>
        </div>
      ) : null}

      {tab === "kuis" ? (
        <div className="grid gap-4">
          <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            KKM / nilai lulus (0-100, opsional)
            <input type="number" min={0} max={100} value={form.passingScore} onChange={(event) => onPatch({ passingScore: event.target.value })} placeholder="Tanpa KKM" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
          </label>
          <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Rilis nilai
            <select value={form.releaseMode} onChange={(event) => onPatch({ releaseMode: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none">
              <option value="IMMEDIATE">Langsung setelah submit</option>
              <option value="AFTER_REVIEW">Setelah guru merilis</option>
            </select>
          </label>
          <div className="grid gap-2">
            {([
              ["showScoreImmediately", "Tampilkan skor langsung"],
              ["showAnswersAfterSubmit", "Tampilkan kunci & pembahasan"],
              ["showResultToWali", "Tampilkan hasil ke wali"],
              ["showResultToSiswa", "Tampilkan nilai ke siswa"],
              ["secureMode", "Mode aman (deteksi pindah tab)"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-xl bg-gray-50 p-3 text-theme-sm text-gray-700">
                <input type="checkbox" checked={form[key]} onChange={(event) => onPatch({ [key]: event.target.checked } as Partial<QuizFormState>)} className="accent-limo-blue-500" />
                {label}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "respons" ? (
        <div className="grid gap-2">
          {([
            ["collectRespondentName", "Minta nama responden (tautan publik)"],
            ["collectRespondentEmail", "Kumpulkan email responden"],
            ["sendCopyToRespondent", "Kirim salinan jawaban ke responden"],
            ["oneResponsePerEmail", "Batasi 1 respons per email"],
            ["notifyGuruOnResponse", "Notifikasi guru saat ada respons"],
            ["shuffleQuestions", "Acak urutan soal"],
            ["shuffleOptions", "Acak urutan opsi (global)"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-xl bg-gray-50 p-3 text-theme-sm text-gray-700">
              <input type="checkbox" checked={form[key]} onChange={(event) => onPatch({ [key]: event.target.checked } as Partial<QuizFormState>)} className="accent-limo-blue-500" />
              {label}
            </label>
          ))}
          <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Pesan setelah dikirim (opsional)
            <input value={form.confirmationMessage} onChange={(event) => onPatch({ confirmationMessage: event.target.value })} placeholder="Contoh: Terima kasih, jawabanmu sudah tersimpan." aria-label="Pesan konfirmasi" dir="auto" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
          </label>
        </div>
      ) : null}

      {tab === "lanjutan" ? (
        <div className="grid gap-4">
          <div>
            <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Tema warna halaman publik</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {THEME_COLORS.map((color) => (
                <button key={color.value} type="button" onClick={() => onPatch({ themeColor: color.value })} aria-label={`Tema ${color.label}`} aria-pressed={form.themeColor === color.value} title={color.label} className={`size-9 rounded-full border-2 transition ${form.themeColor === color.value ? "border-gray-900 ring-2 ring-gray-200" : "border-white ring-1 ring-gray-200"}`} style={{ backgroundColor: color.hex }} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Gambar header (opsional)</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {form.headerImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.headerImageUrl} alt="Gambar header" className="h-20 w-full max-w-xs rounded-xl object-cover ring-1 ring-gray-200" />
              ) : (
                <span className="grid h-20 w-full max-w-xs place-items-center rounded-xl bg-gray-50 text-theme-xs text-gray-400 ring-1 ring-gray-200">Belum ada gambar</span>
              )}
              <label className="tailadmin-button-outline cursor-pointer px-4 py-2 text-theme-xs">
                {form.headerImageUrl ? "Ganti gambar" : "Unggah gambar"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onUploadHeaderImage(file); }} />
              </label>
              {form.headerImageUrl ? <button type="button" onClick={() => onPatch({ headerImageUrl: "" })} className="text-theme-xs font-semibold text-error-600">Hapus gambar</button> : null}
            </div>
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}

export function PreflightSheet({ preflight, busy, onPublish, onClose }: {
  preflight: PreflightItem;
  busy: boolean;
  onPublish: () => void;
  onClose: () => void;
}) {
  const blocked = preflight.missingAnswerKeys.length > 0 || preflight.classGateWarning;

  return (
    <Sheet title="Verifikasi formulir" onClose={onClose}>
      {blocked ? (
        <div className="rounded-2xl border border-error-200 bg-error-50 p-4" role="alert">
          <p className="text-theme-sm font-semibold text-error-700">Formulir belum siap dikirim</p>
          {preflight.classGateWarning ? <p className="mt-2 text-theme-sm text-error-700">Formulir tanpa kelas hanya bisa dikirim lewat tautan publik — ubah &quot;Mode pengiriman&quot; menjadi &quot;Input guru saja&quot; atau pilih kelas.</p> : null}
          {preflight.missingAnswerKeys.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 ps-5 text-theme-sm text-error-700">
              {preflight.missingAnswerKeys.map((message) => <li key={message}>{message}</li>)}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-success-200 bg-success-50 p-4" role="status">
          <p className="text-theme-sm font-semibold text-success-700">Semua kunci jawaban terpasang ✓</p>
          <p className="mt-1 text-theme-sm text-success-700">{preflight.objectiveQuestions} soal objektif ({preflight.coveragePercent}% bobot) dinilai otomatis; {preflight.manualQuestions} soal dinilai manual.</p>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 p-4">
        <p className="text-theme-sm font-semibold text-gray-800">Ringkasan verifikasi</p>
        <ul className="mt-2 grid gap-1.5 text-theme-sm text-gray-600">
          <li>Soal objektif (auto-nilai): <strong>{preflight.objectiveQuestions}</strong></li>
          <li>Soal manual (rubrik/koreksi): <strong>{preflight.manualQuestions}</strong></li>
          <li>Cakupan penilaian otomatis: <strong>{preflight.coveragePercent}%</strong> bobot</li>
          <li>Status formulir: {preflight.status === "PUBLISHED" ? "sudah terpublikasi" : "masih draf"}</li>
        </ul>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="tailadmin-button-outline px-4 py-2.5">Tutup</button>
        <button type="button" onClick={onPublish} disabled={blocked || busy} className="tailadmin-button-primary px-5 py-2.5 disabled:opacity-40">{busy ? "Mempublikasikan..." : preflight.status === "PUBLISHED" ? "Formulir sudah aktif" : "Publikasikan sekarang"}</button>
      </div>
    </Sheet>
  );
}

export function ShareSheet({ ujianId, shareToken, title, onClose }: { ujianId?: string; shareToken: string | null; title: string; onClose: () => void }) {
  const [token, setToken] = useState(shareToken ?? "");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (token || !ujianId) return;
    requestJson<{ token: string; url: string }>(`/api/v1/ujian/${ujianId}/share`, { method: "POST", body: {}, fallbackMessage: "Gagal membuat tautan publik" })
      .then((result) => {
        if (active) setToken(result.data.token);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Gagal membuat tautan publik");
      });
    return () => {
      active = false;
    };
  }, [token, ujianId]);

  const link = token ? `${typeof window !== "undefined" ? window.location.origin : ""}/kuis/${token}` : "";

  return (
    <Sheet title="Formulir siap dikirim" onClose={onClose}>
      <p className="text-theme-sm text-gray-600">Bagikan tautan publik berikut. Responden mengisi tanpa login, nilai objektif terhitung otomatis.</p>
      {error ? <p className="tailadmin-alert-error" role="alert">{error}</p> : null}
      <div className="rounded-2xl border border-gray-200 p-4">
        <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Tautan publik</p>
        <div className="mt-2 flex items-center gap-2">
          <input readOnly value={link || "Menyiapkan tautan..."} aria-label="Tautan publik formulir" className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-theme-sm text-gray-700" />
          {link ? (
            <button type="button" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); }} className="tailadmin-button-primary shrink-0 px-4 py-2">{copied ? "Tersalin" : "Salin"}</button>
          ) : null}
        </div>
        <p className="mt-2 text-theme-xs text-gray-500">Judul formulir: {title}</p>
      </div>
    </Sheet>
  );
}

export function BankSoalSheet({ formId, onBeforeReload, onClose }: { formId: string; onBeforeReload: () => Promise<boolean>; onClose: () => void }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<{ id: string; type: string; question: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function search() {
    setBusy(true);
    setError("");
    try {
      const query = new URLSearchParams({ pageSize: "50" });
      if (term.trim()) query.set("search", term.trim());
      const result = await requestJson<{ items: { id: string; type: string; question: string }[] }>(`/api/v1/bank-soal?${query.toString()}`, { fallbackMessage: "Gagal memuat bank soal" });
      setResults(result.data.items);
      setLoaded(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memuat bank soal");
    } finally {
      setBusy(false);
    }
  }

  async function addSelected() {
    if (selected.length === 0) return;
    setBusy(true);
    setError("");
    try {
      // Simpan perubahan pending DULU agar PATCH full-replace tidak menimpa soal
      // yang baru ditambahkan dari pustaka, lalu muat ulang.
      await onBeforeReload();
      await requestJson<{ added: number; skipped: number }>(`/api/v1/kuis/${formId}/questions`, { method: "POST", body: { bankSoalIds: selected }, fallbackMessage: "Gagal menambahkan soal" });
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menambahkan soal");
      setBusy(false);
    }
  }

  return (
    <Sheet title="Ambil dari pustaka soal" onClose={onClose}>
      <p className="text-theme-sm text-gray-600">Tambahkan soal yang pernah Anda buat tanpa menyalin ulang.</p>
      <div className="flex gap-2">
        <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Cari pertanyaan" aria-label="Cari bank soal" className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none" />
        <button type="button" onClick={() => void search()} disabled={busy} className="tailadmin-button-outline shrink-0 px-4 py-2">{busy ? "..." : "Cari"}</button>
      </div>
      {error ? <p className="tailadmin-alert-error" role="alert">{error}</p> : null}
      <ul className="grid max-h-80 gap-2 overflow-y-auto">
        {results.map((item) => (
          <li key={item.id} className="flex items-start gap-3 rounded-xl border border-gray-200 px-3 py-2">
            <input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => setSelected((current) => (event.target.checked ? [...current, item.id] : current.filter((value) => value !== item.id)))} aria-label={`Pilih soal ${item.question.slice(0, 40)}`} className="mt-1 accent-limo-blue-500" />
            <div className="min-w-0">
              <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">{item.type}</p>
              <p className="mt-0.5 line-clamp-2 text-theme-sm text-gray-700" dir="auto">{item.question}</p>
            </div>
          </li>
        ))}
        {loaded && results.length === 0 ? <li className="text-theme-sm text-gray-500">Tidak ada soal ditemukan.</li> : null}
      </ul>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="tailadmin-button-outline px-4 py-2.5">Tutup</button>
        <button type="button" onClick={() => void addSelected()} disabled={busy || selected.length === 0} className="tailadmin-button-primary px-5 py-2.5 disabled:opacity-40">{busy ? "Menambahkan..." : `Tambahkan (${selected.length})`}</button>
      </div>
    </Sheet>
  );
}

export function ImportSheet({ formId, options, onBeforeReload, onClose }: { formId: string; options: { id: string; title: string }[]; onBeforeReload: () => Promise<boolean>; onClose: () => void }) {
  const [sourceId, setSourceId] = useState("");
  const [list, setList] = useState<{ id: string; question: string; type: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadSource(id: string) {
    setSourceId(id);
    setList([]);
    setSelected([]);
    if (!id) return;
    setBusy(true);
    setError("");
    try {
      const result = await requestJson<{ item: { questions: { id: string; question: string; type: string }[] } }>(`/api/v1/kuis/${id}`, { fallbackMessage: "Gagal memuat soal sumber" });
      setList(result.data.item.questions);
      setSelected(result.data.item.questions.map((question) => question.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memuat soal sumber");
    } finally {
      setBusy(false);
    }
  }

  async function runImport(ids?: string[]) {
    if (!sourceId) return;
    setBusy(true);
    setError("");
    try {
      // Simpan perubahan pending DULU agar PATCH full-replace tidak menimpa soal
      // yang baru diimpor, lalu muat ulang.
      await onBeforeReload();
      const payload = ids && ids.length > 0 ? { sourceUjianId: sourceId, questionIds: ids } : { sourceUjianId: sourceId };
      await requestJson(`/api/v1/kuis/${formId}/import-questions`, { method: "POST", body: payload, fallbackMessage: "Gagal mengimpor soal" });
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mengimpor soal");
      setBusy(false);
    }
  }

  return (
    <Sheet title="Impor soal dari formulir lain" onClose={onClose}>
      <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Formulir sumber
        <select value={sourceId} onChange={(event) => void loadSource(event.target.value)} aria-label="Pilih formulir sumber" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-theme-sm focus:border-limo-blue-500 focus:outline-none">
          <option value="">Pilih formulir sumber</option>
          {options.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
        </select>
      </label>
      {error ? <p className="tailadmin-alert-error" role="alert">{error}</p> : null}
      <p className="text-theme-xs text-gray-500">{busy ? "Memuat soal..." : `${selected.length} dari ${list.length} soal dipilih`}</p>
      <ul className="grid max-h-80 gap-2 overflow-y-auto">
        {list.map((item) => (
          <li key={item.id} className="flex items-start gap-3 rounded-xl border border-gray-200 px-3 py-2">
            <input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => setSelected((current) => (event.target.checked ? [...current, item.id] : current.filter((value) => value !== item.id)))} aria-label={`Pilih soal ${item.question.slice(0, 40)}`} className="mt-1 accent-limo-blue-500" />
            <div className="min-w-0">
              <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">{item.type}</p>
              <p className="mt-0.5 line-clamp-2 text-theme-sm text-gray-700" dir="auto">{item.question}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} className="tailadmin-button-outline px-4 py-2.5">Tutup</button>
        <button type="button" onClick={() => void runImport()} disabled={busy || !sourceId} className="tailadmin-button-outline px-4 py-2.5 disabled:opacity-40">Impor semua soal</button>
        <button type="button" onClick={() => void runImport(selected)} disabled={busy || selected.length === 0} className="tailadmin-button-primary px-5 py-2.5 disabled:opacity-40">Impor terpilih</button>
      </div>
    </Sheet>
  );
}
