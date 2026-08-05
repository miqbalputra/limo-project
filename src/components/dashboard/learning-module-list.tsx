import type { LearningModuleView } from "@/components/dashboard/learning-module-builder";

export function LearningModuleList({ modules, emptyMessage }: { modules: LearningModuleView[]; emptyMessage: string }) {
  if (modules.length === 0) {
    return <div className="tailadmin-card p-8 text-center text-theme-sm text-gray-500">{emptyMessage}</div>;
  }

  return (
    <div className="space-y-4">
      {modules.map((module, moduleIndex) => (
        <article key={module.id} className="tailadmin-card overflow-hidden">
          <div className="border-b border-gray-100 bg-gray-50/70 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">Modul {moduleIndex + 1}</p>
                <h2 className="mt-1 text-xl font-semibold text-gray-900">{module.title}</h2>
                <p className="mt-2 whitespace-pre-line text-theme-sm leading-6 text-gray-500">{module.description || "Belum ada deskripsi modul."}</p>
              </div>
              <span className="rounded-full bg-success-50 px-3 py-1 text-theme-xs font-semibold text-success-700">Tersedia</span>
            </div>
            {module.dueAt ? <p className="mt-3 text-theme-xs font-semibold text-warning-700">Batas modul: {formatDate(module.dueAt)}</p> : null}
          </div>
          <div className="divide-y divide-gray-100">
            {module.items.map((item, itemIndex) => (
              <div key={item.id} className="flex items-start gap-3 p-4 sm:gap-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-theme-xs font-semibold text-brand-600">{itemIndex + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600">{item.itemType}</span>{item.isRequired ? <span className="text-[10px] font-semibold text-warning-700">Wajib</span> : null}</div>
                  <p className="mt-2 break-words font-semibold text-gray-900">{item.title}</p>
                  <p className="mt-1 text-theme-xs text-gray-500">{item.targetPublished ? "Aktivitas tersedia" : "Aktivitas belum dipublikasikan"}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold">
                    {item.isLockedByPrerequisite ? <span className="rounded-full bg-warning-50 px-2 py-1 text-warning-700">Selesaikan prasyarat dahulu</span> : null}
                    {item.isScheduled ? <span className="rounded-full bg-brand-50 px-2 py-1 text-brand-700">Belum dibuka</span> : null}
                    {item.isExpired ? <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-600">Waktu belajar berakhir</span> : null}
                    {!item.isLockedByPrerequisite && !item.isScheduled && !item.isExpired && item.targetPublished ? <span className="rounded-full bg-success-50 px-2 py-1 text-success-700">Siap dipelajari</span> : null}
                  </div>
                  {item.availableFrom ? <p className="mt-2 text-[10px] text-gray-500">Mulai {formatDate(item.availableFrom)}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function formatDate(value: string | Date | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}
