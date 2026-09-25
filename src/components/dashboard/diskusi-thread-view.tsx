import Link from "next/link";
import type { Actor } from "@/server/auth/session";
import { getDiskusiThread } from "@/server/services/diskusi-service";
import { DiskusiReplyActions, DiskusiThreadActions } from "@/components/dashboard/diskusi-moderation-actions";
import { DiskusiReplyForm } from "@/components/dashboard/diskusi-reply-form";
import { DiskusiAttachmentForm, DiskusiAttachmentRemoveButton, DiskusiReplyAttachmentForm, DiskusiReplyAttachmentRemoveButton } from "@/components/dashboard/diskusi-attachments";
import { DiskusiReportButton } from "@/components/dashboard/diskusi-report-button";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { formatUiLabel, getUiToneClass } from "@/lib/ui-labels";

function formatDateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(date);
}

function formatSize(value: bigint | number) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ThreadSummary = {
  id: string;
  title: string;
  content: string;
  status: string;
  isPinned: boolean;
  replyCount: number;
  lastReplyAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  kelas: { id: string; name: string };
  createdBy: { id: string; name: string; role: string } | null;
};

export function DiskusiThreadCard({ thread, href, manage }: { thread: ThreadSummary; href: string; manage: boolean }) {
  return (
    <article className={`tailadmin-card min-w-0 p-5 ${thread.deletedAt ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-700">{thread.kelas.name}</p>
          <h2 className="mt-1 break-words text-lg font-semibold text-gray-900">
            {thread.isPinned ? "📌 " : ""}
            <Link href={href} className="hover:text-limo-blue-700">{thread.title}</Link>
          </h2>
          <p className="mt-1 text-theme-xs text-gray-500">
            {thread.createdBy?.name ?? "Pengguna dihapus"} · {formatDateTime(thread.createdAt)} · {thread.replyCount} balasan
            {thread.lastReplyAt ? ` · terakhir ${formatDateTime(thread.lastReplyAt)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {thread.deletedAt ? <span className="rounded-full bg-gray-100 px-3 py-1 text-theme-xs font-semibold text-gray-600">Dihapus</span> : null}
          <span className={`rounded-full px-3 py-1 text-theme-xs font-semibold ${getUiToneClass(thread.status)}`}>{formatUiLabel(thread.status)}</span>
        </div>
      </div>
      <p className="mt-4 line-clamp-3 whitespace-pre-line rounded-2xl bg-gray-50 p-4 text-theme-sm leading-7 text-gray-700">{thread.content}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-theme-xs text-gray-500">{manage ? "Anda dapat mengunci, menyembunyikan, atau menghapus diskusi ini." : "Buka diskusi untuk ikut serta."}</span>
        <Link href={href} className="tailadmin-button-outline px-4 py-2">Buka diskusi</Link>
      </div>
    </article>
  );
}

export async function DiskusiThreadView({
  actor,
  threadId,
  page,
  basePath,
  backHref,
  backLabel,
}: {
  actor: Actor;
  threadId: string;
  page: number;
  basePath: string;
  backHref: string;
  backLabel: string;
}) {
  const data = await getDiskusiThread(actor, threadId, { page, pageSize: 50 });
  const thread = data.thread;
  const manage = data.manage;
  const authorNames = new Map(data.replies.map((reply) => [reply.id, reply.createdBy?.name ?? "Pengguna dihapus"]));

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow={`${thread.kelas.program.name} / ${thread.kelas.name}`}
        title={thread.title}
        description={thread.deletedAt ? "Diskusi ini sudah dihapus dan hanya terlihat untuk pengelola kelas." : thread.status === "LOCKED" ? "Diskusi dikunci, tidak dapat dibalas selain oleh Guru." : "Ikuti percakapan kelas dan tanyakan hal yang belum jelas."}
        actions={<Link href={backHref} className="tailadmin-button-outline px-4 py-2">{backLabel}</Link>}
        aside={<div className="grid w-full min-w-0 grid-cols-2 gap-2 rounded-2xl border border-gray-100 bg-white/80 p-3 shadow-theme-xs lg:w-auto lg:min-w-56"><MiniStat label="Balasan" value={thread.replyCount} /><MiniStat label="Status" text={formatUiLabel(thread.status)} /></div>}
      />

      <article className={`tailadmin-card p-5 ${thread.deletedAt ? "opacity-70" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-700">{thread.createdBy?.name ?? "Pengguna dihapus"}</p>
            <p className="mt-1 text-theme-xs text-gray-500">{formatDateTime(thread.createdAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {thread.isPinned ? <span className="rounded-full bg-warning-50 px-3 py-1 text-theme-xs font-semibold text-warning-700">Disematkan</span> : null}
            {thread.deletedAt ? <span className="rounded-full bg-gray-100 px-3 py-1 text-theme-xs font-semibold text-gray-600">Dihapus</span> : null}
            <span className={`rounded-full px-3 py-1 text-theme-xs font-semibold ${getUiToneClass(thread.status)}`}>{formatUiLabel(thread.status)}</span>
          </div>
        </div>
        <p className="mt-4 whitespace-pre-line rounded-2xl bg-gray-50 p-4 text-theme-sm leading-7 text-gray-700">{thread.content}</p>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          {manage ? <DiskusiThreadActions threadId={thread.id} status={thread.status} isPinned={thread.isPinned} deleted={Boolean(thread.deletedAt)} /> : <span />}
          <DiskusiReportButton threadId={thread.id} />
        </div>
      </article>

      {thread.attachments.length > 0 || data.canAttach ? (
        <section className="tailadmin-card p-5">
          <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Lampiran</p>
          {thread.attachments.length > 0 ? (
            <ul className="mt-3 grid gap-2">
              {thread.attachments.map((file) => (
                <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white p-3">
                  <a href={`/api/v1/diskusi/threads/${thread.id}/attachments/${file.id}`} className="min-w-0 break-all text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800">{file.originalName}</a>
                  <span className="flex items-center gap-3 text-theme-xs text-gray-500">
                    <span>{formatSize(file.sizeBytes)}</span>
                    {data.canAttach ? <DiskusiAttachmentRemoveButton threadId={thread.id} fileId={file.id} /> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-theme-sm text-gray-500">Belum ada lampiran pada diskusi ini.</p>
          )}
          {data.canAttach ? <div className="mt-4 border-t border-gray-100 pt-4"><DiskusiAttachmentForm threadId={thread.id} /></div> : null}
        </section>
      ) : null}

      <section className="space-y-3">
        {data.replies.length > 0 ? (
          data.replies.map((reply) => (
            <article key={reply.id} className={`tailadmin-card p-4 ${reply.deletedAt ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-theme-xs font-semibold text-gray-700">
                    {reply.createdBy?.name ?? "Pengguna dihapus"}
                    <span className="ms-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-500">{formatUiLabel(reply.createdBy?.role ?? "")}</span>
                  </p>
                  <p className="mt-1 text-theme-xs text-gray-500">{formatDateTime(reply.createdAt)}{reply.parentReplyId ? ` · ${authorNames.get(reply.parentReplyId) ? `membalas ${authorNames.get(reply.parentReplyId)}` : "membalas balasan"}` : ""}</p>
                </div>
                {reply.isTeacherAnswer ? <span className="rounded-full bg-success-50 px-3 py-1 text-theme-xs font-semibold text-success-700">Jawaban guru</span> : null}
                {reply.status === "HIDDEN" ? <span className="rounded-full bg-warning-50 px-3 py-1 text-theme-xs font-semibold text-warning-700">Disembunyikan</span> : null}
              </div>
              <p className="mt-3 whitespace-pre-line text-theme-sm leading-7 text-gray-700">{reply.content}</p>
              {reply.attachments.length > 0 ? (
                <ul className="mt-3 grid gap-2">
                  {reply.attachments.map((file) => (
                    <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white p-2.5">
                      <a href={`/api/v1/diskusi/replies/${reply.id}/attachments/${file.id}`} className="min-w-0 break-all text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800">{file.originalName}</a>
                      <span className="flex items-center gap-3 text-theme-xs text-gray-500">
                        <span>{formatSize(file.sizeBytes)}</span>
                        {manage || reply.createdBy?.id === actor.id ? <DiskusiReplyAttachmentRemoveButton replyId={reply.id} fileId={file.id} /> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!reply.deletedAt && !thread.deletedAt && (manage || reply.createdBy?.id === actor.id) ? (
                <div className="mt-3"><DiskusiReplyAttachmentForm replyId={reply.id} /></div>
              ) : null}
              <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                <DiskusiReplyActions replyId={reply.id} threadId={thread.id} isTeacherAnswer={reply.isTeacherAnswer} manage={manage} canReply={!thread.deletedAt} />
                <DiskusiReportButton threadId={thread.id} replyId={reply.id} compact />
              </div>
            </article>
          ))
        ) : (
          <EmptyState icon="bell" title="Belum ada balasan" description="Jadilah yang pertama menjawab diskusi ini." />
        )}
      </section>

      {thread.deletedAt ? (
        <p className="tailadmin-alert-error">Diskusi sudah dihapus; balasan baru tidak lagi diterima.</p>
      ) : (
        <section className="tailadmin-card p-5">
          <DiskusiReplyForm threadId={thread.id} />
        </section>
      )}

      <PaginationControls basePath={basePath} page={data.pagination.page} totalPages={data.pagination.totalPages} />
    </main>
  );
}

function MiniStat({ label, value, text }: { label: string; value?: number; text?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-gray-50 p-3 text-center">
      <p className="truncate text-xl font-semibold text-gray-900">{value ?? text}</p>
      <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  );
}
