"use client";

import type { ReactNode } from "react";
import { useDashboardRole } from "@/components/dashboard/dashboard-role-context";

function Skeleton({ className }: { className: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-gray-200 motion-reduce:animate-none ${className}`} />;
}

function LoadingFrame({ label, status, children }: { label: string; status: string; children: ReactNode }) {
  return (
    <main className="space-y-6" aria-busy="true" aria-labelledby="dashboard-loading-title">
      <p role="status" className="sr-only">{status}</p>
      <div>
        <p className="text-theme-xs font-semibold uppercase tracking-[0.14em] text-gray-400">{label}</p>
        <h1 id="dashboard-loading-title" className="mt-1 text-xl font-semibold text-gray-900">{status}</h1>
      </div>
      {children}
    </main>
  );
}

function AdminWorkspaceLoading() {
  return (
    <LoadingFrame label="Admin" status="Memuat ruang kerja Admin">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5"><Skeleton className="h-5 w-36" /><Skeleton className="h-48" /></div>
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5"><Skeleton className="h-5 w-28" /><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
      </div>
    </LoadingFrame>
  );
}

function GuruWorkspaceLoading() {
  return (
    <LoadingFrame label="Guru" status="Memuat ruang kerja Guru">
      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.4fr]">
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5"><Skeleton className="h-5 w-28" /><Skeleton className="h-32" /><Skeleton className="h-10 w-2/3" /></div>
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5"><Skeleton className="h-5 w-40" /><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
    </LoadingFrame>
  );
}

function WaliWorkspaceLoading() {
  return (
    <LoadingFrame label="Wali" status="Memuat ruang kerja Wali">
      <div className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-5"><Skeleton className="size-14 shrink-0 rounded-full" /><div className="flex-1 space-y-3"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-9 w-28" /></div></div>
      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.9fr]"><div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5"><Skeleton className="h-5 w-36" /><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div><div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5"><Skeleton className="h-5 w-24" /><Skeleton className="h-40" /></div></div>
    </LoadingFrame>
  );
}

function SiswaWorkspaceLoading() {
  return (
    <LoadingFrame label="Siswa" status="Memuat ruang kerja Siswa">
      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.35fr]">
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5"><Skeleton className="h-5 w-28" /><div className="space-y-3 border-l-2 border-gray-100 pl-4"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div></div>
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5"><Skeleton className="h-5 w-40" /><Skeleton className="h-28" /><div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div></div>
      </div>
    </LoadingFrame>
  );
}

function NeutralWorkspaceLoading() {
  return (
    <LoadingFrame label="Dashboard" status="Memuat dashboard">
      <Skeleton className="h-32 rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      <Skeleton className="h-64" />
    </LoadingFrame>
  );
}

export default function DashboardLoading() {
  const dashboardRole = useDashboardRole();

  switch (dashboardRole?.role) {
    case "ADMIN":
      return <AdminWorkspaceLoading />;
    case "GURU":
      return <GuruWorkspaceLoading />;
    case "WALI":
      return <WaliWorkspaceLoading />;
    case "SISWA":
      return <SiswaWorkspaceLoading />;
    default:
      return <NeutralWorkspaceLoading />;
  }
}
