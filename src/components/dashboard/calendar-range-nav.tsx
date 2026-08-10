"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { WALI_CHILD_QUERY_PARAM } from "@/lib/wali-selector";
import { APP_TIME_ZONE, formatJakartaPeriod } from "@/server/time/jakarta";

const monthFormatter = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: APP_TIME_ZONE });
const dayFormatter = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: APP_TIME_ZONE });

type ClassOption = { id: string; name: string };

function monthDate(month: string) {
  return new Date(`${month}-01T00:00:00+07:00`);
}

function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const total = year * 12 + monthNumber - 1 + offset;
  const nextYear = Math.floor(total / 12);
  return `${nextYear}-${String((total % 12) + 1).padStart(2, "0")}`;
}

function href(path: string, month: string, classId?: string, childId?: string | null) {
  const params = new URLSearchParams({ month });
  if (classId) params.set("classId", classId);
  if (childId) params.set(WALI_CHILD_QUERY_PARAM, childId);
  return `${path}?${params.toString()}`;
}

export function CalendarRangeNav({ path, from, to, month, classId, childId, classes = [] }: { path: string; from: Date; to: Date; month: string; classId?: string; childId?: string | null; classes?: ClassOption[] }) {
  const router = useRouter();
  const monthLabel = monthFormatter.format(monthDate(month));
  const selectedClass = classes.find((item) => item.id === classId)?.name;
  const rangeLabel = `${dayFormatter.format(from)} - ${dayFormatter.format(new Date(to.getTime() - 1))}`;

  return (
    <section className="tailadmin-card overflow-hidden" aria-label="Kontrol kalender">
      <div className="flex flex-col gap-5 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-theme-xs font-semibold uppercase tracking-[0.18em] text-limo-blue-700">Kalender agenda</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-limo-blue-50 px-2.5 py-1 text-[10px] font-semibold text-limo-blue-700">
              <span className="size-1.5 rounded-full bg-limo-blue-500" aria-hidden="true" />
              {selectedClass || "Semua kelas"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-2xl font-semibold capitalize tracking-tight text-gray-900">{monthLabel}</h2>
            <span className="text-theme-xs text-gray-500">{rangeLabel}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex min-w-0 items-center gap-2 text-theme-xs font-semibold text-gray-600">
            <span className="whitespace-nowrap">Pilih kelas</span>
            <select aria-label="Pilih kelas kalender" value={classId || ""} onChange={(event) => router.push(href(path, month, event.target.value || undefined, childId))} className="tailadmin-input min-w-0 py-2 text-theme-xs sm:min-w-48">
              <option value="">Semua kelas</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>

          <div className="flex items-center justify-between gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 sm:justify-start" aria-label="Navigasi bulan">
            <Link aria-label="Bulan sebelumnya" href={href(path, shiftMonth(month, -1), classId, childId)} className="grid size-11 place-items-center rounded-lg text-gray-500 transition hover:bg-white hover:text-gray-900 hover:shadow-theme-xs">
              <ChevronIcon direction="left" />
            </Link>
            <Link href={href(path, formatJakartaPeriod(), classId, childId)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-white px-3 py-2 text-theme-xs font-semibold text-gray-700 shadow-theme-xs">Bulan ini</Link>
            <Link aria-label="Bulan berikutnya" href={href(path, shiftMonth(month, 1), classId, childId)} className="grid size-11 place-items-center rounded-lg text-gray-500 transition hover:bg-white hover:text-gray-900 hover:shadow-theme-xs">
              <ChevronIcon direction="right" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={direction === "left" ? "m12.5 15-5-5 5-5" : "m7.5 5 5 5-5 5"} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
