"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Student = {
  id: string;
  name: string;
  nomorInduk: string;
  presensi?: { status: string; note: string | null }[];
  progresBelajar?: { understandingScore: number; publicNote: string | null; internalNote: string | null; category: string | null }[];
};

type Mode = "presensi" | "progres";

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(payload.error?.message || "Data gagal disimpan");
  }
}

export function PresensiProgresForm({ sesiKelasId, students, mode, readOnly = false }: { sesiKelasId: string; students: Student[]; mode: Mode; readOnly?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);

    const body = mode === "presensi"
      ? {
          sesiKelasId,
          items: students.map((student) => ({
            siswaId: student.id,
            status: String(data.get(`presence-${student.id}`) || "ALPA"),
            note: String(data.get(`presenceNote-${student.id}`) || ""),
          })),
        }
      : {
          sesiKelasId,
          items: students.map((student) => ({
            siswaId: student.id,
            category: "umum",
            understandingScore: Number(data.get(`score-${student.id}`) || 3),
            publicNote: String(data.get(`publicNote-${student.id}`) || ""),
            internalNote: String(data.get(`internalNote-${student.id}`) || ""),
          })),
        };

    try {
      await postJson(`/api/v1/${mode}`, body);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Data gagal disimpan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form id={`${mode}-form`} onSubmit={onSubmit} className="space-y-4">
      {error ? <p className="tailadmin-alert-error">{error}</p> : null}
      {readOnly ? <p className="rounded-xl border border-warning-100 bg-warning-50 px-4 py-3 text-theme-sm text-warning-800">Sesi ini sudah tidak dapat diubah karena statusnya bukan DRAFT.</p> : null}
      {students.map((student) => {
        const presensi = student.presensi?.[0];
        const progress = student.progresBelajar?.find((item) => item.category === "umum") ?? student.progresBelajar?.[0];

        return (
          <section key={student.id} className="tailadmin-card p-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-theme-sm font-semibold text-brand-600">{student.name.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-gray-900" title={student.name}>{student.name}</h2>
                <p className="text-theme-sm text-gray-500">{student.nomorInduk}</p>
              </div>
            </div>
            {mode === "presensi" ? (
              <div className="mt-4 grid gap-3">
                <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">Presensi</p>
                <select disabled={readOnly} name={`presence-${student.id}`} aria-label={`Status presensi ${student.name}`} defaultValue={presensi?.status ?? "HADIR"} className="tailadmin-input">
                  <option value="HADIR">Hadir</option>
                  <option value="IZIN">Izin</option>
                  <option value="SAKIT">Sakit</option>
                  <option value="ALPA">Alpa</option>
                  <option value="TERLAMBAT">Terlambat</option>
                </select>
                <input disabled={readOnly} name={`presenceNote-${student.id}`} aria-label={`Catatan presensi ${student.name}`} defaultValue={presensi?.note ?? ""} placeholder="Catatan presensi" className="tailadmin-input" />
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">Progres Belajar</p>
                <select disabled={readOnly} name={`score-${student.id}`} aria-label={`Skor pemahaman ${student.name}`} defaultValue={String(progress?.understandingScore ?? 3)} className="tailadmin-input">
                  <option value="1">Pemahaman 1</option>
                  <option value="2">Pemahaman 2</option>
                  <option value="3">Pemahaman 3</option>
                  <option value="4">Pemahaman 4</option>
                  <option value="5">Pemahaman 5</option>
                </select>
                <input disabled={readOnly} name={`publicNote-${student.id}`} aria-label={`Catatan untuk wali ${student.name}`} defaultValue={progress?.publicNote ?? ""} placeholder="Catatan untuk wali" className="tailadmin-input" />
                <input disabled={readOnly} name={`internalNote-${student.id}`} aria-label={`Catatan internal ${student.name}`} defaultValue={progress?.internalNote ?? ""} placeholder="Catatan internal" className="tailadmin-input" />
              </div>
            )}
          </section>
        );
      })}
      {!readOnly ? <button disabled={isSubmitting || students.length === 0} className="tailadmin-button-primary">
        {isSubmitting ? "Menyimpan..." : mode === "presensi" ? "Simpan Presensi" : "Simpan Progres"}
      </button> : null}
    </form>
  );
}
