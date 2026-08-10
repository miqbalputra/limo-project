"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { getWaliChildIdFromLocation, WALI_ALL_CHILDREN_VALUE, withWaliChildContext } from "@/lib/wali-selector";

type ChildOption = { id: string; name: string; nomorInduk: string };

export function WaliChildSelector({ options }: { options: ChildOption[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const selectedId = getWaliChildIdFromLocation(pathname, searchParams);
  const selectedValue = selectedId && options.some((child) => child.id === selectedId) ? selectedId : WALI_ALL_CHILDREN_VALUE;
  const isAttemptActive = pathname.startsWith("/wali/tugas/attempt/");

  function onChange(value: string) {
    const childId = value === WALI_ALL_CHILDREN_VALUE ? null : value;
    const segments = pathname.split("/").filter(Boolean);
    const isProgressDetail = segments[0] === "wali" && segments[1] === "progres" && Boolean(segments[2]);
    const isTaskDetail = segments[0] === "wali" && segments[1] === "tugas" && Boolean(segments[2]) && segments[2] !== "attempt";
    const isTaskExam = isTaskDetail && segments.length > 3;
    const isPaymentSuccess = pathname === "/wali/tagihan/success";
    let destination = pathname;
    let destinationChildId = childId;
    let preservedSearchParams: Pick<URLSearchParams, "toString"> | undefined = searchParams;

    if (pathname === "/wali/kalender" && selectedValue !== value) {
      const nextSearchParams = new URLSearchParams(searchParams.toString());
      nextSearchParams.delete("classId");
      preservedSearchParams = nextSearchParams;
    }

    if (isProgressDetail) {
      destination = childId ? `/wali/progres/${childId}` : "/wali/progres";
      destinationChildId = null;
      preservedSearchParams = undefined;
    } else if (isTaskDetail && !isTaskExam) {
      destination = childId ? `/wali/tugas/${childId}` : "/wali/tugas";
      destinationChildId = null;
      preservedSearchParams = undefined;
    } else if (isTaskExam || isPaymentSuccess) {
      destination = isTaskExam ? "/wali/tugas" : "/wali/tagihan";
      preservedSearchParams = undefined;
    }

    startTransition(() => router.push(withWaliChildContext(destination, destinationChildId, preservedSearchParams)));
  }

  return (
    <div className="min-w-0">
      <label className="flex min-w-0 items-center gap-2">
        <span className="sr-only">Pilih anak</span>
        <select aria-label="Pilih anak" value={selectedValue} onChange={(event) => onChange(event.target.value)} disabled={isPending || isAttemptActive} aria-describedby={isAttemptActive ? "wali-child-selector-lock" : undefined} className="h-11 min-w-0 max-w-48 rounded-lg border border-gray-200 bg-white px-3 text-theme-xs font-semibold text-gray-700 shadow-theme-xs outline-none focus:border-limo-blue-300 focus:ring-3 focus:ring-limo-blue-500/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 sm:max-w-56">
          <option value={WALI_ALL_CHILDREN_VALUE}>Semua Anak</option>
          {options.map((child) => <option key={child.id} value={child.id}>{child.name} / {child.nomorInduk}</option>)}
        </select>
      </label>
      {isAttemptActive ? <p id="wali-child-selector-lock" className="sr-only">Pemilihan anak tidak tersedia di halaman ujian.</p> : null}
    </div>
  );
}
