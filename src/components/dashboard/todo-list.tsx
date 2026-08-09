import Link from "next/link";
import type { TodoItem } from "@/server/services/todo-service";
import { APP_TIME_ZONE } from "@/server/time/jakarta";
import { formatUiLabel } from "@/lib/ui-labels";
import { StatusBadge } from "@/components/dashboard/status-badge";

const dateFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: APP_TIME_ZONE });

export function TodoList({ items }: { items: TodoItem[] }) {
  if (items.length === 0) return <div className="tailadmin-card p-8 text-center"><p className="font-semibold text-gray-900">Semua aktivitas sudah tertangani</p><p className="mt-2 text-theme-sm text-gray-500">Tidak ada tindakan yang perlu dilakukan pada saat ini.</p></div>;
  return <div className="grid gap-3 lg:grid-cols-2">{items.map((item) => <article key={item.key} className="tailadmin-card p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-500">{formatTodoKind(item.kind)}{item.childName ? ` / ${item.childName}` : ""}</p><h2 className="mt-1 break-words font-semibold text-gray-900">{item.title}</h2><p className="mt-1 text-theme-sm text-gray-500">{item.description}</p></div><StatusBadge status={item.status} compact suffix={item.priority === "HIGH" ? " / Prioritas" : undefined} /></div>{item.dueAt ? <p className="mt-4 text-theme-xs text-gray-500">Tenggat: {dateFormatter.format(item.dueAt)}</p> : null}<Link href={item.href} className="mt-4 inline-block text-theme-xs font-semibold text-limo-blue-600 hover:text-limo-blue-700">Tindak lanjuti</Link></article>)}</div>;
}

function formatTodoKind(kind: string) {
  return {
    ASSIGNMENT_REVISION: "Revisi tugas",
    ASSIGNMENT_SUBMISSION: "Pengumpulan tugas",
    ASSIGNMENT_DRAFT: "Draf tugas",
    MODULE_DRAFT: "Draf modul",
    MATERIAL_DRAFT: "Draf materi",
    SESSION_UNFINALIZED: "Sesi belum difinalkan",
    SUBMISSION_TO_GRADE: "Jawaban untuk dinilai",
    GRADEBOOK_PUBLISH: "Terbitkan buku nilai",
  }[kind] || formatUiLabel(kind, "Aktivitas");
}
