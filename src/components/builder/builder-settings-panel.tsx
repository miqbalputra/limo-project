"use client";

import type { QuizFormState } from "@/lib/quiz-builder";

export const THEME_COLORS = [
  { value: "blue", label: "Biru", hex: "#465fff" },
  { value: "green", label: "Hijau", hex: "#12b76a" },
  { value: "purple", label: "Ungu", hex: "#7a5af8" },
  { value: "orange", label: "Oranye", hex: "#f79009" },
  { value: "red", label: "Merah", hex: "#f04438" },
  { value: "teal", label: "Teal", hex: "#15b79e" },
  { value: "slate", label: "Abu", hex: "#475467" },
] as const;

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (_value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-xl bg-gray-50 p-3 text-theme-sm text-gray-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-limo-blue-500" />
      {label}
    </label>
  );
}

export function BuilderSettingsPanel({
  form,
  onPatch,
  onUploadHeaderImage,
}: {
  form: QuizFormState;
  onPatch: (_patch: Partial<QuizFormState>) => void;
  onUploadHeaderImage: (_file: File) => void;
}) {
  return (
    <section className="tailadmin-card grid gap-4 p-5 sm:grid-cols-2">
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Jenis
        <select value={form.mode} onChange={(event) => onPatch({ mode: event.target.value })} className="mt-2 tailadmin-input">
          <option value="UJIAN">Ujian</option>
          <option value="LATIHAN">Latihan</option>
        </select>
      </label>
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Mode pengiriman
        <select value={form.deliveryMode} onChange={(event) => onPatch({ deliveryMode: event.target.value })} className="mt-2 tailadmin-input">
          <option value="ONLINE_VIA_WALI">Online via wali</option>
          <option value="ONLINE_VIA_SISWA">Online via siswa</option>
          <option value="BOTH">Online + input guru</option>
          <option value="TEACHER_ENTRY">Input guru saja</option>
        </select>
      </label>
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Durasi (menit)
        <input type="number" min={1} max={600} value={form.durationMinutes} onChange={(event) => onPatch({ durationMinutes: Number(event.target.value) || 1 })} className="mt-2 tailadmin-input" />
      </label>
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Maksimal percobaan
        <input type="number" min={1} max={5} value={form.maxAttempts} onChange={(event) => onPatch({ maxAttempts: Number(event.target.value) || 1 })} className="mt-2 tailadmin-input" />
      </label>
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        KKM / nilai lulus (0-100)
        <input type="number" min={0} max={100} value={form.passingScore} onChange={(event) => onPatch({ passingScore: event.target.value })} placeholder="Opsional" className="mt-2 tailadmin-input" />
      </label>
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Tanggal ujian
        <input type="date" value={form.examDate} onChange={(event) => onPatch({ examDate: event.target.value })} className="mt-2 tailadmin-input" />
      </label>
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Tersedia mulai
        <input type="date" value={form.availableFrom} onChange={(event) => onPatch({ availableFrom: event.target.value })} className="mt-2 tailadmin-input" />
      </label>
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Tersedia sampai
        <input type="date" value={form.availableUntil} onChange={(event) => onPatch({ availableUntil: event.target.value })} className="mt-2 tailadmin-input" />
      </label>
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Tampilan soal
        <select value={form.presentationMode} onChange={(event) => onPatch({ presentationMode: event.target.value })} className="mt-2 tailadmin-input">
          <option value="ALL">Semua soal per halaman</option>
          <option value="ONE_PER_PAGE">Satu soal per halaman</option>
        </select>
      </label>
      <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Rilis nilai
        <select value={form.releaseMode} onChange={(event) => onPatch({ releaseMode: event.target.value })} className="mt-2 tailadmin-input">
          <option value="IMMEDIATE">Langsung setelah submit</option>
          <option value="AFTER_REVIEW">Setelah guru merilis</option>
        </select>
      </label>
      <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
        <Toggle label="Acak urutan soal" checked={form.shuffleQuestions} onChange={(value) => onPatch({ shuffleQuestions: value })} />
        <Toggle label="Acak urutan opsi" checked={form.shuffleOptions} onChange={(value) => onPatch({ shuffleOptions: value })} />
        <Toggle label="Tampilkan skor langsung" checked={form.showScoreImmediately} onChange={(value) => onPatch({ showScoreImmediately: value })} />
        <Toggle label="Tampilkan kunci & pembahasan" checked={form.showAnswersAfterSubmit} onChange={(value) => onPatch({ showAnswersAfterSubmit: value })} />
        <Toggle label="Minta nama responden (tautan publik)" checked={form.collectRespondentName} onChange={(value) => onPatch({ collectRespondentName: value })} />
        <Toggle label="Tampilkan hasil ke wali" checked={form.showResultToWali} onChange={(value) => onPatch({ showResultToWali: value })} />
        <Toggle label="Tampilkan nilai ke siswa" checked={form.showResultToSiswa} onChange={(value) => onPatch({ showResultToSiswa: value })} />
        <Toggle label="Mode aman (deteksi pindah tab)" checked={form.secureMode} onChange={(value) => onPatch({ secureMode: value })} />
        <Toggle label="Kumpulkan email responden" checked={form.collectRespondentEmail} onChange={(value) => onPatch({ collectRespondentEmail: value })} />
        <Toggle label="Kirim salinan jawaban ke responden" checked={form.sendCopyToRespondent} onChange={(value) => onPatch({ sendCopyToRespondent: value })} />
        <Toggle label="Batasi 1 respons per email" checked={form.oneResponsePerEmail} onChange={(value) => onPatch({ oneResponsePerEmail: value })} />
        <Toggle label="Notifikasi guru saat ada respons" checked={form.notifyGuruOnResponse} onChange={(value) => onPatch({ notifyGuruOnResponse: value })} />
      </div>
      <div className="sm:col-span-2">
        <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Gambar header (opsional)</p>
        <p className="mt-1 text-theme-xs text-gray-400">Ditampilkan di bagian atas halaman publik kuis.</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {form.headerImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.headerImageUrl} alt="Gambar header" className="h-20 w-full max-w-xs rounded-xl object-cover ring-1 ring-gray-200" />
          ) : (
            <span className="grid h-20 w-full max-w-xs place-items-center rounded-xl bg-gray-50 text-theme-xs text-gray-400 ring-1 ring-gray-200">Belum ada gambar</span>
          )}
          <div className="flex items-center gap-2">
            <label className="tailadmin-button-outline cursor-pointer px-4 py-2 text-theme-xs focus-within:ring-2 focus-within:ring-limo-blue-500">
              {form.headerImageUrl ? "Ganti gambar" : "Unggah gambar"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onUploadHeaderImage(file); }} />
            </label>
            {form.headerImageUrl ? (
              <button type="button" onClick={() => onPatch({ headerImageUrl: "" })} className="text-theme-xs font-semibold text-error-600">Hapus gambar</button>
            ) : null}
          </div>
        </div>
      </div>
      <div className="sm:col-span-2">
        <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Tema warna</p>
        <p className="mt-1 text-theme-xs text-gray-400">Warna aksen untuk halaman publik kuis.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {THEME_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => onPatch({ themeColor: color.value })}
              aria-label={`Tema ${color.label}`}
              aria-pressed={form.themeColor === color.value}
              title={color.label}
              className={`size-9 rounded-full border-2 transition ${form.themeColor === color.value ? "border-gray-900 ring-2 ring-gray-200" : "border-white ring-1 ring-gray-200"}`}
              style={{ backgroundColor: color.hex }}
            />
          ))}
        </div>
      </div>
      <label className="sm:col-span-2 text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
        Pesan setelah dikirim (opsional)
        <input
          value={form.confirmationMessage}
          onChange={(event) => onPatch({ confirmationMessage: event.target.value })}
          placeholder="Contoh: Terima kasih, jawabanmu sudah tersimpan."
          aria-label="Pesan konfirmasi"
          dir="auto"
          className="mt-2 tailadmin-input"
        />
      </label>
    </section>
  );
}
