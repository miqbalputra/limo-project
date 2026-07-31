"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function AdminReportFilters({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams({ from: String(data.get("from") || from), to: String(data.get("to") || to) });
    router.push(`/admin/laporan?${params.toString()}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs sm:flex-row sm:items-end">
      <label className="grid min-w-0 flex-1 gap-1.5 text-theme-xs font-semibold text-gray-600">Dari<input name="from" type="date" defaultValue={from} className="tailadmin-input py-2.5" /></label>
      <label className="grid min-w-0 flex-1 gap-1.5 text-theme-xs font-semibold text-gray-600">Sampai<input name="to" type="date" defaultValue={to} className="tailadmin-input py-2.5" /></label>
      <button disabled={isLoading} className="tailadmin-button-primary shrink-0 px-4 py-2.5">{isLoading ? "Memuat..." : "Terapkan Periode"}</button>
    </form>
  );
}
