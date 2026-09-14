"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";

type RegistrationSummary = {
  kode: string;
  programName: string;
  participantName: string;
  participantType?: string;
  status: string;
  isWaitingList?: boolean;
};

const STORAGE_KEY = "limo:pendaftaran-result";

const stages = [
  { title: "Pendaftaran Diterima", desc: "Data pendaftaran berhasil kami terima." },
  { title: "Assessment / Konsultasi Awal", desc: "Tim LIMO menghubungi Anda untuk assessment singkat." },
  { title: "Penempatan Kelas", desc: "Peserta ditempatkan sesuai level dan kebutuhan belajar." },
  { title: "Pembayaran", desc: "Informasi tagihan dan metode pembayaran dikirimkan." },
  { title: "Enrollment Dikonfirmasi", desc: "Peserta resmi terdaftar dan siap memulai kelas." },
];

function subscribeStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getStorageSnapshot() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot() {
  return null;
}

export function PendaftaranSuccess() {
  const raw = useSyncExternalStore(subscribeStorage, getStorageSnapshot, getServerSnapshot);
  const summary = useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RegistrationSummary;
    } catch {
      return null;
    }
  }, [raw]);

  return (
    <div className="min-h-screen bg-gray-25">
      <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="tailadmin-card p-6 sm:p-10">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-success-50">
            <svg viewBox="0 0 24 24" className="size-8 text-success-600" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <h1 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-gray-900">Pendaftaran Berhasil!</h1>
          <p className="mt-3 text-center text-lg text-gray-600">
            Terima kasih telah mendaftar di LIMO. Data pendaftaran Anda telah berhasil kami terima.
          </p>

          {summary ? (
            <dl className="mt-8 space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-theme-sm text-gray-500">Nomor Pendaftaran</dt>
                <dd className="text-xl font-extrabold tracking-widest text-limo-blue-700">{summary.kode}</dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3">
                <dt className="text-theme-sm text-gray-500">Program</dt>
                <dd className="text-theme-sm font-bold text-gray-900">{summary.programName || "-"}</dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3">
                <dt className="text-theme-sm text-gray-500">Peserta</dt>
                <dd className="text-theme-sm font-bold text-gray-900">{summary.participantName || "-"}</dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3">
                <dt className="text-theme-sm text-gray-500">Status</dt>
                <dd className="inline-flex items-center gap-1.5 rounded-full border border-success-200 bg-success-50 px-3 py-1 text-theme-xs font-bold text-success-700">
                  {summary.isWaitingList ? "Waiting List" : "Pendaftaran Diterima"}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="mt-8 rounded-2xl border border-warning-200 bg-warning-50 p-5 text-center text-theme-sm text-warning-800">
              <p className="font-semibold">Detail pendaftaran tidak ditemukan di sesi ini.</p>
              <p className="mt-1">Nomor pendaftaran dikirim ke WhatsApp/email Anda. Gunakan halaman cek status untuk melihat data pendaftaran.</p>
            </div>
          )}

          {summary ? (
            <p className="mt-6 text-center text-theme-sm text-gray-600">
              Tim LIMO akan meninjau data pendaftaran dan menghubungi Anda untuk proses selanjutnya.
            </p>
          ) : null}

          <section className="mt-8">
            <h2 className="text-lg font-extrabold tracking-tight text-gray-900">Tahapan Selanjutnya</h2>
            <ol className="mt-4 space-y-2">
              {stages.map((stage, index) => (
                <li key={stage.title} className="flex items-start gap-3">
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full text-theme-xs font-extrabold ${index === 0 ? "bg-success-600 text-white" : "bg-gray-100 text-gray-500"}`}>{index + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-theme-sm font-bold text-gray-800">{stage.title}</span>
                    <span className="mt-0.5 block text-theme-xs text-gray-500">{stage.desc}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <div className="mt-9 flex flex-col gap-2 sm:flex-row">
            <Link href="/status-pendaftaran" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-limo-blue-600 px-5 py-3 text-theme-sm font-bold text-white hover:bg-limo-blue-700">Cek Status Pendaftaran</Link>
            <Link href="/" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-gray-300 px-5 py-3 text-theme-sm font-bold text-gray-700 hover:bg-gray-50">Kembali ke Beranda</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
