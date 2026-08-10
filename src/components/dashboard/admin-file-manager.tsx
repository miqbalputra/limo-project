"use client";

import Link from "next/link";
import { useState } from "react";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ResponsiveDataView } from "@/components/dashboard/responsive-data-view";
import { StatusBadge } from "@/components/dashboard/status-badge";

export type AdminFileManagerItem = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: string;
  createdAt: string;
  materi: {
    id: string;
    title: string;
    type: string;
    status: string;
    kelas: {
      id: string;
      name: string;
      program: { name: string };
      level: { name: string };
    };
  } | null;
};

export type AdminFileManagerFolder = {
  id: string;
  name: string;
  programName: string;
  levelName: string;
  fileCount: number;
};

export type AdminFileManagerStats = {
  totalFiles: number;
  totalMaterials: number;
  totalFolders: number;
  storageBytes: number;
};

export function AdminFileManager({ files, folders, stats }: { files: AdminFileManagerItem[]; folders: AdminFileManagerFolder[]; stats: AdminFileManagerStats }) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const storageLimit = 512 * 1024 * 1024;
  const storagePercent = Math.min(100, Math.round((stats.storageBytes / storageLimit) * 100));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Ringkasan file materi">
        <MetricCard compact dense hoverable={false} icon="materials" label="Total berkas" value={String(stats.totalFiles)} description="Berkas materi tersimpan" tone="brand" iconClassName="bg-limo-blue-50 text-limo-blue-600" />
        <MetricCard compact dense hoverable={false} icon="materials" label="Materi" value={String(stats.totalMaterials)} description="Materi yang memiliki berkas" tone="success" />
        <MetricCard compact dense hoverable={false} icon="classes" label="Folder kelas" value={String(stats.totalFolders)} description="Kelas dengan materi" tone="warning" />
        <MetricCard compact dense hoverable={false} icon="billing" label="Penyimpanan" value={formatFileSize(stats.storageBytes)} description={`${storagePercent}% dari kuota lokal 512 MB`} tone="gray" />
      </section>

      <section className="tailadmin-card p-5 sm:p-6" aria-labelledby="material-folders-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-theme-xs font-semibold uppercase tracking-[0.18em] text-limo-blue-700">Ringkasan penyimpanan</p>
            <h2 id="material-folders-title" className="mt-1 text-lg font-semibold text-gray-900">Folder materi</h2>
            <p className="mt-1 text-theme-sm text-gray-500">Berkas dikelompokkan berdasarkan kelas asal materi.</p>
          </div>
          <Link href="/admin/kelas" className="text-theme-sm font-semibold text-limo-blue-500 hover:text-limo-blue-700">Kelola kelas</Link>
        </div>
        {folders.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {folders.map((folder) => <Link key={folder.id} href="/admin/kelas" className="group flex min-h-11 items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition hover:bg-gray-25 hover:shadow-theme-xs">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-warning-50 text-warning-700"><DashboardIcon name="classes" className="size-5" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-theme-sm font-semibold text-gray-800 group-hover:text-limo-blue-700">{folder.name}</span><span className="mt-0.5 block truncate text-theme-xs text-gray-500">{folder.programName} / {folder.levelName}</span></span>
              <span className="shrink-0 text-theme-xs font-semibold text-gray-400">{folder.fileCount} berkas</span>
            </Link>)}
          </div>
        ) : <EmptyManagerState title="Belum ada folder materi" description="Berkas yang diunggah dari materi guru akan muncul di sini." />}
        <div className="mt-6 border-t border-gray-100 pt-5">
          <div className="mb-2 flex items-center justify-between gap-3 text-theme-xs"><span className="font-semibold text-gray-700">Kapasitas penyimpanan</span><span className="text-gray-500">{formatFileSize(stats.storageBytes)} / 512 MB</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-limo-blue-500 transition-[width]" style={{ width: `${Math.max(storagePercent, stats.storageBytes > 0 ? 1 : 0)}%` }} /></div>
        </div>
      </section>

      <section className="tailadmin-card overflow-hidden" aria-labelledby="all-material-files-title">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div><h2 id="all-material-files-title" className="font-semibold text-gray-900">Semua berkas materi</h2><p className="mt-1 text-theme-xs text-gray-500">Berkas tetap pribadi dan hanya dapat diunduh oleh pengguna yang berwenang.</p></div>
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1" aria-label="Tampilan berkas">
            <button type="button" aria-label="Tampilan kotak" aria-pressed={view === "grid"} onClick={() => setView("grid")} className={`grid size-11 place-items-center rounded-md ${view === "grid" ? "bg-white text-limo-blue-600 shadow-theme-xs" : "text-gray-400 hover:text-gray-700"}`}><DashboardIcon name="dashboard" className="size-4" /></button>
            <button type="button" aria-label="Tampilan daftar" aria-pressed={view === "list"} onClick={() => setView("list")} className={`grid size-11 place-items-center rounded-md ${view === "list" ? "bg-white text-limo-blue-600 shadow-theme-xs" : "text-gray-400 hover:text-gray-700"}`}><DashboardIcon name="registration" className="size-4" /></button>
          </div>
        </div>
        {files.length > 0 ? view === "grid" ? <FileGrid files={files} /> : <FileList files={files} /> : <div className="px-6 py-14"><EmptyManagerState title="Belum ada berkas materi" description="Setelah guru mengunggah PDF atau gambar pada materi, berkas akan tersimpan dan terpantau di sini." /></div>}
      </section>
    </div>
  );
}

function FileGrid({ files }: { files: AdminFileManagerItem[] }) {
  return <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">{files.map((file) => <FileCard key={file.id} file={file} />)}</div>;
}

function FileCard({ file }: { file: AdminFileManagerItem }) {
  const material = file.materi;
  return <article className="group rounded-xl border border-gray-200 bg-white p-4 transition hover:bg-gray-25 hover:shadow-theme-xs">
    <div className="flex items-start justify-between gap-3">
      <span className={`grid size-11 place-items-center rounded-xl ${isImage(file.mimeType) ? "bg-success-50 text-success-700" : "bg-error-50 text-error-700"}`}><DashboardIcon name="materials" className="size-5" /></span>
      <StatusBadge status={material?.status || "-"} fallback={!material || material.status === "-" ? "Tidak tersedia" : "Tidak diketahui"} compact />
    </div>
    <h3 className="mt-4 truncate text-theme-sm font-semibold text-gray-900" title={file.originalName}>{file.originalName}</h3>
    <p className="mt-1 truncate text-theme-xs text-gray-500" title={material?.title || "Materi tidak tersedia"}>{material?.title || "Materi tidak tersedia"}</p>
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-200/80 pt-3 text-[10px] text-gray-500"><span className="truncate">{material?.kelas.name || "-"}</span><span className="shrink-0">{formatFileSize(Number(file.sizeBytes))}</span></div>
    <a href={`/api/v1/files/${file.id}`} className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-theme-xs font-semibold text-limo-blue-700 hover:text-limo-blue-800"><DashboardIcon name="materials" className="size-3.5" />Unduh berkas</a>
  </article>;
}

function FileList({ files }: { files: AdminFileManagerItem[] }) {
  return <ResponsiveDataView
    rows={files}
    getRowKey={(file) => file.id}
    tableLabel="Daftar berkas materi"
    desktopBreakpoint="2xl"
    testId="admin-material-files"
    tableClassName="min-w-[850px]"
    rowClassName="hover:bg-gray-25"
    columns={[
      { id: "file", label: "Nama file", render: (file) => <div className="flex items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-lg ${isImage(file.mimeType) ? "bg-success-50 text-success-700" : "bg-error-50 text-error-700"}`}><DashboardIcon name="materials" className="size-4" /></span><div className="min-w-0"><p className="max-w-56 truncate font-semibold text-gray-800" title={file.originalName}>{file.originalName}</p><p className="mt-0.5 text-[10px] text-gray-400">{formatDate(file.createdAt)}</p></div></div> },
      { id: "material", label: "Materi", render: (file) => <p className="text-gray-700">{file.materi?.title || "-"}</p> },
      { id: "class", label: "Kelas", render: (file) => <span className="text-gray-600">{file.materi?.kelas.name || "-"}</span> },
      { id: "size", label: "Ukuran", render: (file) => <span className="text-gray-500">{formatFileSize(Number(file.sizeBytes))}</span> },
      { id: "status", label: "Status", render: (file) => <StatusBadge status={file.materi?.status || "-"} fallback={!file.materi || file.materi.status === "-" ? "Tidak tersedia" : "Tidak diketahui"} compact /> },
      { id: "action", label: "Aksi", render: (file) => <a href={`/api/v1/files/${file.id}`} className="inline-flex min-h-11 items-center font-semibold text-limo-blue-700 hover:text-limo-blue-800">Unduh</a> },
    ]}
  />;
}

function EmptyManagerState({ title, description }: { title: string; description: string }) {
  return <div className="flex flex-col items-center justify-center text-center"><span className="grid size-12 place-items-center rounded-2xl bg-gray-50 text-gray-400"><DashboardIcon name="materials" className="size-6" /></span><h3 className="mt-4 font-semibold text-gray-900">{title}</h3><p className="mt-1 max-w-md text-theme-sm leading-6 text-gray-500">{description}</p></div>;
}

function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

function formatFileSize(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value));
}
