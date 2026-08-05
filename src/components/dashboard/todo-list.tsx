import Link from "next/link";
import type { TodoItem } from "@/server/services/todo-service";
import { APP_TIME_ZONE } from "@/server/time/jakarta";

const dateFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: APP_TIME_ZONE });

export function TodoList({ items }: { items: TodoItem[] }) {
  if (items.length === 0) return <div className="tailadmin-card p-8 text-center"><p className="font-semibold text-gray-900">Semua aktivitas sudah tertangani</p><p className="mt-2 text-theme-sm text-gray-500">Tidak ada tindakan yang perlu dilakukan pada saat ini.</p></div>;
  return <div className="grid gap-3 lg:grid-cols-2">{items.map((item) => <article key={item.key} className="tailadmin-card p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">{item.kind.replaceAll("_", " ")}{item.childName ? ` / ${item.childName}` : ""}</p><h2 className="mt-1 break-words font-semibold text-gray-900">{item.title}</h2><p className="mt-1 text-theme-sm text-gray-500">{item.description}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.status === "OVERDUE" ? "bg-error-50 text-error-700" : item.priority === "HIGH" ? "bg-warning-50 text-warning-700" : "bg-gray-50 text-gray-600"}`}>{item.status === "OVERDUE" ? "Terlambat" : item.priority === "HIGH" ? "Prioritas" : "Terbuka"}</span></div>{item.dueAt ? <p className="mt-4 text-theme-xs text-gray-500">Tenggat: {dateFormatter.format(item.dueAt)}</p> : null}<Link href={item.href} className="mt-4 inline-block text-theme-xs font-semibold text-brand-600 hover:text-brand-700">Tindak lanjuti</Link></article>)}</div>;
}
