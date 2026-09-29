"use client";

import { useRouter } from "next/navigation";
import { type FormEvent } from "react";
import { useAsyncAction } from "@/components/dashboard/use-async-action";
import { formatUiLabel } from "@/lib/ui-labels";
import { requestJson } from "@/lib/api-json-client";

export type AcademicYearValues = {
  id: string;
  label: string;
  semester: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

export function AcademicYearManager({ years }: { years: AcademicYearValues[] }) {
  const router = useRouter();
  const { error, isPending, run } = useAsyncAction();

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    await run(
      "create",
      () =>
        requestJson("/api/v1/admin/settings/academic-years", {
          method: "POST",
          body: {
            label: String(data.get("label") || ""),
            semester: String(data.get("semester") || "GANJIL"),
            startDate: String(data.get("startDate") || ""),
            endDate: String(data.get("endDate") || ""),
          },
          fallbackMessage: "Tahun ajaran gagal dibuat",
        }),
      {
        fallbackMessage: "Tahun ajaran gagal dibuat",
        successMessage: "Tahun ajaran dibuat.",
        onSuccess: () => {
          formElement.reset();
          router.refresh();
        },
      },
    );
  }

  async function activate(id: string) {
    await run(
      "activate",
      () => requestJson(`/api/v1/admin/settings/academic-years/${id}`, { method: "PATCH", body: { isActive: true }, fallbackMessage: "Tahun ajaran gagal diaktifkan" }),
      { fallbackMessage: "Tahun ajaran gagal diaktifkan", successMessage: "Tahun ajaran aktif diperbarui.", onSuccess: () => router.refresh() },
    );
  }

  return (
    <section className="space-y-4">
      <form onSubmit={create} className="tailadmin-card grid gap-3 p-5">
        <h2 className="font-semibold text-gray-900">Tahun Ajaran</h2>
        {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
        <div className="grid gap-3 sm:grid-cols-4">
          <input name="label" required placeholder="2026/2027" aria-label="Label tahun ajaran" className="tailadmin-input" />
          <select name="semester" aria-label="Semester" className="tailadmin-input">
            <option value="GANJIL">{formatUiLabel("GANJIL")}</option>
            <option value="GENAP">{formatUiLabel("GENAP")}</option>
          </select>
          <input name="startDate" type="date" required aria-label="Tanggal mulai" className="tailadmin-input" />
          <input name="endDate" type="date" required aria-label="Tanggal selesai" className="tailadmin-input" />
        </div>
        <button type="submit" disabled={isPending} className="tailadmin-button-primary w-fit px-4 py-2">{isPending ? "Menyimpan..." : "Tambah Tahun Ajaran"}</button>
      </form>
      <section className="tailadmin-card overflow-hidden">
        {years.length > 0 ? years.map((year) => (
          <article key={year.id} className="flex flex-col gap-3 border-b border-gray-100 p-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{year.label}</h3>
                {year.isActive ? <span className="rounded-full bg-success-50 px-2 py-1 text-[10px] font-semibold text-success-700">Aktif</span> : null}
              </div>
              <p className="mt-1 text-theme-sm text-gray-500">Semester {formatUiLabel(year.semester)} / {year.startDate} sampai {year.endDate}</p>
            </div>
            {!year.isActive ? <button type="button" disabled={isPending} onClick={() => void activate(year.id)} className="tailadmin-button-outline w-fit px-3 py-2 text-theme-xs">Jadikan aktif</button> : null}
          </article>
        )) : <p className="px-5 py-10 text-center text-theme-sm text-gray-500">Belum ada tahun ajaran. Tambahkan melalui formulir di atas.</p>}
      </section>
    </section>
  );
}
