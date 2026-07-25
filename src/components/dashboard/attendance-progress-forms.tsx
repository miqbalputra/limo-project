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

export function PresensiProgresForm({ sesiKelasId, students }: { sesiKelasId: string; students: Student[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);

    const presensiItems = students.map((student) => ({
      siswaId: student.id,
      status: String(data.get(`presence-${student.id}`) || "ALPA"),
      note: String(data.get(`presenceNote-${student.id}`) || ""),
    }));
    const progresItems = students.map((student) => ({
      siswaId: student.id,
      category: "umum",
      understandingScore: Number(data.get(`score-${student.id}`) || 3),
      publicNote: String(data.get(`publicNote-${student.id}`) || ""),
      internalNote: String(data.get(`internalNote-${student.id}`) || ""),
    }));

    try {
      await postJson("/api/v1/presensi", { sesiKelasId, items: presensiItems });
      await postJson("/api/v1/progres", { sesiKelasId, items: progresItems });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Data gagal disimpan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <p className="tailadmin-alert-error">{error}</p> : null}
      {students.map((student) => {
        const presensi = student.presensi?.[0];
        const progress = student.progresBelajar?.find((item) => item.category === "umum") ?? student.progresBelajar?.[0];

        return (
          <section key={student.id} className="tailadmin-card p-5">
            <h2 className="font-semibold text-gray-900">{student.name}</h2>
            <p className="text-theme-sm text-gray-500">{student.nomorInduk}</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="grid gap-3">
                <select name={`presence-${student.id}`} defaultValue={presensi?.status ?? "HADIR"} className="tailadmin-input">
                  <option value="HADIR">Hadir</option>
                  <option value="IZIN">Izin</option>
                  <option value="SAKIT">Sakit</option>
                  <option value="ALPA">Alpa</option>
                  <option value="TERLAMBAT">Terlambat</option>
                </select>
                <input name={`presenceNote-${student.id}`} defaultValue={presensi?.note ?? ""} placeholder="Catatan presensi" className="tailadmin-input" />
              </div>
              <div className="grid gap-3">
                <select name={`score-${student.id}`} defaultValue={String(progress?.understandingScore ?? 3)} className="tailadmin-input">
                  <option value="1">Pemahaman 1</option>
                  <option value="2">Pemahaman 2</option>
                  <option value="3">Pemahaman 3</option>
                  <option value="4">Pemahaman 4</option>
                  <option value="5">Pemahaman 5</option>
                </select>
                <input name={`publicNote-${student.id}`} defaultValue={progress?.publicNote ?? ""} placeholder="Catatan untuk wali" className="tailadmin-input" />
                <input name={`internalNote-${student.id}`} defaultValue={progress?.internalNote ?? ""} placeholder="Catatan internal" className="tailadmin-input" />
              </div>
            </div>
          </section>
        );
      })}
      <button disabled={isSubmitting || students.length === 0} className="tailadmin-button-primary">
        {isSubmitting ? "Menyimpan..." : "Simpan Presensi dan Progres"}
      </button>
    </form>
  );
}
