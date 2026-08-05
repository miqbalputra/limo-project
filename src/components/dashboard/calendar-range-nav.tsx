import Link from "next/link";
import { APP_TIME_ZONE } from "@/server/time/jakarta";

const formatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: APP_TIME_ZONE });
const RANGE_MS = 35 * 24 * 60 * 60 * 1000;

function href(path: string, from: Date, to: Date) {
  return `${path}?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
}

export function CalendarRangeNav({ path, from, to }: { path: string; from: Date; to: Date }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-xs"><p className="text-theme-sm font-semibold text-gray-700">{formatter.format(from)} - {formatter.format(new Date(to.getTime() - 1))}</p><div className="flex flex-wrap gap-2"><Link href={href(path, new Date(from.getTime() - RANGE_MS), new Date(to.getTime() - RANGE_MS))} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Sebelumnya</Link><Link href={path} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Rentang default</Link><Link href={href(path, new Date(from.getTime() + RANGE_MS), new Date(to.getTime() + RANGE_MS))} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Berikutnya</Link></div></div>;
}
