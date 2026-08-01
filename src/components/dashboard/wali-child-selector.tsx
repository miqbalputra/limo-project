"use client";

import { useRouter } from "next/navigation";
import { WALI_ALL_CHILDREN_VALUE, WALI_SELECTED_CHILD_COOKIE } from "@/lib/wali-selector";

type ChildOption = { id: string; name: string; nomorInduk: string };

export function WaliChildSelector({ options, selectedId }: { options: ChildOption[]; selectedId: string | null }) {
  const router = useRouter();

  function onChange(value: string) {
    document.cookie = `${WALI_SELECTED_CHILD_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=2592000; SameSite=Lax`;
    router.refresh();
  }

  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="sr-only">Pilih anak</span>
      <select aria-label="Pilih anak" value={selectedId || WALI_ALL_CHILDREN_VALUE} onChange={(event) => onChange(event.target.value)} className="h-10 min-w-0 max-w-48 rounded-lg border border-gray-200 bg-white px-3 text-theme-xs font-semibold text-gray-700 shadow-theme-xs outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 sm:max-w-56">
        <option value={WALI_ALL_CHILDREN_VALUE}>Semua Anak</option>
        {options.map((child) => <option key={child.id} value={child.id}>{child.name} / {child.nomorInduk}</option>)}
      </select>
    </label>
  );
}
