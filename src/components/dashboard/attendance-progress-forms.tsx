"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { formatUiLabel } from "@/lib/ui-labels";
import { requestJson } from "@/lib/api-json-client";

type Student = {
  id: string;
  name: string;
  nomorInduk: string;
  presensi?: { status: string; note: string | null }[];
  progresBelajar?: { understandingScore: number; publicNote: string | null; internalNote: string | null; category: string | null }[];
};

type Mode = "presensi" | "progres";

const PRESENCE_OPTIONS = [
  { value: "HADIR", label: "Hadir", selectedClass: "peer-checked:border-success-300 peer-checked:bg-success-50 peer-checked:text-success-700" },
  { value: "TERLAMBAT", label: "Terlambat", selectedClass: "peer-checked:border-warning-300 peer-checked:bg-warning-50 peer-checked:text-warning-700" },
  { value: "SAKIT", label: "Sakit", selectedClass: "peer-checked:border-limo-blue-300 peer-checked:bg-limo-blue-50 peer-checked:text-limo-blue-700" },
  { value: "IZIN", label: "Izin", selectedClass: "peer-checked:border-warning-300 peer-checked:bg-warning-50 peer-checked:text-warning-700" },
  { value: "ALPA", label: "Alfa", selectedClass: "peer-checked:border-error-300 peer-checked:bg-error-50 peer-checked:text-error-700" },
] as const;

async function postJson(path: string, body: unknown) {
  await requestJson(path, { method: "POST", body, fallbackMessage: "Data gagal disimpan" });
}

export function PresensiProgresForm({ sesiKelasId, students, mode, readOnly = false }: { sesiKelasId: string; students: Student[]; mode: Mode; readOnly?: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [category, setCategory] = useState("umum");
  const draftKey = `limo:guru:${mode}:${sesiKelasId}:draft`;
  const normalizedCategory = category.trim().toLowerCase() || "umum";

  useEffect(() => {
    if (readOnly) return;

    const rawDraft = window.localStorage.getItem(draftKey);
    if (!rawDraft || !formRef.current) return;

    try {
      const parsedDraft = JSON.parse(rawDraft) as unknown;
      const parsedObject = parsedDraft && typeof parsedDraft === "object" ? parsedDraft as Record<string, unknown> : null;
      const savedAt = typeof parsedObject?.savedAt === "number" ? parsedObject.savedAt : undefined;
      if (savedAt && Date.now() - savedAt > 7 * 24 * 60 * 60 * 1000) {
        window.localStorage.removeItem(draftKey);
        return;
      }
      const draft = parsedObject?.fields && typeof parsedObject.fields === "object"
        ? parsedObject.fields as Record<string, string>
        : parsedObject ?? {};
      for (const [name, value] of Object.entries(draft)) {
        if (typeof value !== "string") continue;
        const field = formRef.current.elements.namedItem(name);
        if (field instanceof RadioNodeList) {
          const radio = Array.from(field).find((item) => item instanceof HTMLInputElement && item.value === value);
          if (radio instanceof HTMLInputElement) radio.checked = true;
        } else if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
          field.value = value;
        }
        if (name === "category") window.queueMicrotask(() => setCategory(value));
      }
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, [draftKey, readOnly]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBulkMessage("");
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);

    const body = mode === "presensi"
      ? {
          sesiKelasId,
          items: students.map((student) => ({
            siswaId: student.id,
            status: String(data.get(`presence-${student.id}`) || ""),
            note: String(data.get(`presenceNote-${student.id}`) || ""),
          })),
        }
      : {
           sesiKelasId,
           items: students.map((student) => ({
              siswaId: student.id,
              category: String(data.get("category") || normalizedCategory).trim().toLowerCase() || "umum",
             understandingScore: Number(data.get(`score-${student.id}`) || 3),
             publicNote: String(data.get(`publicNote-${student.id}`) || ""),
             internalNote: String(data.get(`internalNote-${student.id}`) || ""),
          })),
        };

    try {
      await postJson(`/api/v1/${mode}`, body);
      window.localStorage.removeItem(draftKey);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Data gagal disimpan");
    } finally {
      setIsSubmitting(false);
    }
  }

  function markAllPresent() {
    formRef.current?.querySelectorAll<HTMLInputElement>('input[type="radio"][name^="presence-"][value="HADIR"]').forEach((radio) => {
      radio.checked = true;
    });
    saveDraft();
    setBulkMessage(`${students.length} siswa ditandai hadir. Periksa catatan lalu simpan presensi.`);
  }

  function saveDraft() {
    if (readOnly || !formRef.current) return;

    const draft = Object.fromEntries(
      Array.from(new FormData(formRef.current).entries())
        .filter(([name]) => !name.startsWith("internalNote-"))
        .map(([name, value]) => [name, typeof value === "string" ? value : ""]),
    );
    window.localStorage.setItem(draftKey, JSON.stringify({ savedAt: Date.now(), fields: draft }));
  }

  return (
    <form ref={formRef} id={`${mode}-form`} onSubmit={onSubmit} onInput={saveDraft} onChange={saveDraft} className="space-y-4">
      {error ? <p className="tailadmin-alert-error">{error}</p> : null}
      {readOnly ? <p className="rounded-xl border border-warning-100 bg-warning-50 px-4 py-3 text-theme-sm text-warning-800">Sesi ini sudah tidak dapat diubah karena statusnya bukan {formatUiLabel("DRAFT")}.</p> : null}
      {!readOnly ? <p className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-theme-xs text-gray-600">Draf tersimpan otomatis di perangkat ini dan dipulihkan saat halaman dibuka kembali.</p> : null}
        {mode === "progres" && !readOnly ? <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><label className="text-theme-sm font-semibold text-gray-800">Kategori progres<input name="category" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="umum, berbicara, tata bahasa" className="mt-2 tailadmin-input bg-white" /></label><p className="mt-1 text-theme-xs text-gray-500">Gunakan kategori yang konsisten agar lini masa progres lebih mudah dibaca.</p></div> : null}
        {mode === "presensi" && !readOnly && students.length > 0 ? <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-theme-sm font-semibold text-gray-800">Percepat input presensi</p><p className="mt-1 text-theme-xs text-gray-500">Tandai seluruh siswa hadir, lalu ubah siswa yang terlambat, izin, sakit, atau alpa.</p></div><button type="button" disabled={isSubmitting} onClick={markAllPresent} className="tailadmin-button-outline w-full px-3 py-2 sm:w-auto">Hadir Semua</button></div> : null}
      {bulkMessage ? <p role="status" className="rounded-xl border border-success-100 bg-success-50 px-4 py-3 text-theme-sm text-success-800">{bulkMessage}</p> : null}
      {students.map((student) => {
        const presensi = student.presensi?.[0];
        const progress = student.progresBelajar?.find((item) => item.category === normalizedCategory);

        return (
          <section key={mode === "progres" ? `${student.id}:${normalizedCategory}` : student.id} className="tailadmin-card p-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-limo-blue-50 text-theme-sm font-semibold text-limo-blue-600">{student.name.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-gray-900" title={student.name}>{student.name}</h2>
                <p className="text-theme-sm text-gray-500">{student.nomorInduk}</p>
              </div>
            </div>
            {mode === "presensi" ? (
              <div className="mt-4 grid gap-3">
                <fieldset aria-label={`Status presensi ${student.name}`}>
                  <legend className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">Status Presensi</legend>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {PRESENCE_OPTIONS.map((option) => (
                      <label key={option.value} className="cursor-pointer">
                        <input
                          type="radio"
                          name={`presence-${student.id}`}
                          value={option.value}
                          defaultChecked={presensi?.status === option.value}
                          required={!readOnly}
                          disabled={readOnly}
                          className="peer sr-only"
                        />
                        <span className={`flex min-h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-theme-sm font-semibold text-gray-600 transition peer-focus-visible:ring-3 peer-focus-visible:ring-limo-blue-500/10 ${option.selectedClass}`}>
                          {option.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <input disabled={readOnly} name={`presenceNote-${student.id}`} aria-label={`Catatan presensi ${student.name}`} defaultValue={presensi?.note ?? ""} placeholder="Catatan presensi (opsional)" className="tailadmin-input" />
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
