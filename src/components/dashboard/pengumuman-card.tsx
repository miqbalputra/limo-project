import type { ReactNode } from "react";
import { formatUiLabel, getUiToneClass } from "@/lib/ui-labels";

export type PengumumanRow = {
  id: string;
  title: string;
  content: string;
  priority: string;
  audience: string;
  status: string;
  publishAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  kelasId: string | null;
  kelas: { id: string; name: string } | null;
  readCount?: number;
  isRead: boolean;
  scheduled?: boolean;
  expired?: boolean;
  childNames?: string[];
};

function formatDate(value: Date | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
}

export function PengumumanCard({ item, actions }: { item: PengumumanRow; actions?: ReactNode }) {
  const scheduled = item.scheduled ?? false;
  const expired = item.expired ?? false;

  return (
    <article className="tailadmin-card min-w-0 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-700">{item.kelas ? item.kelas.name : "Semua kelas"}{item.childNames && item.childNames.length > 0 ? ` / ${item.childNames.join(", ")}` : ""}</p>
          <h2 className="mt-1 break-words text-lg font-semibold text-gray-900">{item.title}</h2>
          <p className="mt-1 text-theme-xs text-gray-500">Diterbitkan {formatDate(item.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-theme-xs font-semibold ${getUiToneClass(item.priority)}`}>{formatUiLabel(item.priority, "Normal")}</span>
          <span className="rounded-full bg-gray-50 px-3 py-1 text-theme-xs font-semibold text-gray-600">{formatUiLabel(item.audience, "Semua")}</span>
          <span className={`rounded-full px-3 py-1 text-theme-xs font-semibold ${getUiToneClass(scheduled ? "SCHEDULED" : expired ? "EXPIRED" : item.status)}`}>
            {scheduled ? "Terjadwal" : expired ? "Berakhir" : formatUiLabel(item.status)}
          </span>
        </div>
      </div>

      <p className="mt-4 whitespace-pre-line rounded-2xl bg-gray-50 p-4 text-theme-sm leading-7 text-gray-700">{item.content}</p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-theme-xs text-gray-500">
          {item.publishAt ? <p>Terbit: {formatDate(item.publishAt)}</p> : null}
          {item.expiresAt ? <p>Berakhir: {formatDate(item.expiresAt)}</p> : null}
          {typeof item.readCount === "number" ? <p>Dibaca {item.readCount} orang</p> : null}
          {item.isRead ? <p className="font-semibold text-success-700">Sudah Anda baca</p> : null}
        </div>
        {actions}
      </div>
    </article>
  );
}
