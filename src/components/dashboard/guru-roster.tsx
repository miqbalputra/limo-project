"use client";

import { useState } from "react";
import Link from "next/link";

export type GuruRosterRow = {
  id: string;
  name: string;
  nomorInduk: string;
  hadir: number;
  totalPresensi: number;
  attendanceRate: number | null;
  averageProgress: number | null;
  averageScore: number | null;
};

export function GuruRoster({ kelasId, rows }: { kelasId: string; rows: GuruRosterRow[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRows = normalizedQuery
    ? rows.filter((row) => `${row.name} ${row.nomorInduk}`.toLowerCase().includes(normalizedQuery))
    : rows;

  return (
    <section className="tailadmin-card p-5" aria-labelledby="guru-roster-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="guru-roster-title" className="font-semibold text-gray-900">Roster Siswa</h2>
          <p className="mt-1 text-theme-sm text-gray-500">Ringkasan siswa aktif pada kelas ini. Data tetap dibatasi oleh kelas Guru.</p>
        </div>
        <label className="w-full sm:max-w-xs">
          <span className="sr-only">Cari siswa berdasarkan nama atau nomor induk</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama atau nomor induk"
            className="tailadmin-input"
            type="search"
          />
        </label>
      </div>

      <p className="mt-4 text-theme-xs text-gray-500" aria-live="polite">Menampilkan {filteredRows.length} dari {rows.length} siswa aktif</p>

      {filteredRows.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {filteredRows.map((row) => (
            <article key={row.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-theme-sm font-semibold text-brand-600">{row.name.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-gray-900" title={row.name}><Link href={`/guru/kelas/${kelasId}/ringkasan?siswaId=${encodeURIComponent(row.id)}`} className="hover:text-brand-600">{row.name}</Link></h3>
                  <p className="text-theme-sm text-gray-500">{row.nomorInduk}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <RosterMetric label="Presensi" value={row.attendanceRate === null ? "-" : `${Math.round(row.attendanceRate)}%`} helper={`${row.hadir}/${row.totalPresensi}`} />
                <RosterMetric label="Progres" value={row.averageProgress === null ? "-" : row.averageProgress.toFixed(1)} helper="skala 1-5" />
                <RosterMetric label="Nilai" value={row.averageScore === null ? "-" : row.averageScore.toFixed(1)} helper="skala 0-100" />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-xl bg-gray-50 px-4 py-6 text-center text-theme-sm text-gray-500">Siswa tidak ditemukan.</p>
      )}
    </section>
  );
}

function RosterMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div className="min-w-0 rounded-xl bg-white p-3 shadow-theme-xs"><p className="truncate text-lg font-semibold text-gray-900">{value}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p><p className="mt-1 truncate text-[10px] text-gray-400">{helper}</p></div>;
}
