"use client";

import { useState } from "react";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { EmptyState } from "@/components/dashboard/dashboard-widgets";
import { MasterDataActions } from "@/components/dashboard/master-data-actions";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { formatUiLabel } from "@/lib/ui-labels";

type ClassStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

type ClassReportItem = {
  id: string;
  name: string;
  status: ClassStatus;
  scheduleNote: string | null;
  program: { id: string; name: string; kind: string };
  level: { id: string; name: string };
  guruProfile: { id: string; user: { name: string; email: string } } | null;
  _count: { enrollments: number };
};

type GuruOption = { id: string; user: { name: string; email: string } };
type StatusFilter = "ALL" | ClassStatus;
type SortOption = "NAME" | "STUDENTS";

export function KelasReportCards({ classes, guruOptions }: { classes: ClassReportItem[]; guruOptions: GuruOption[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [programFilter, setProgramFilter] = useState("ALL");
  const [sortOption, setSortOption] = useState<SortOption>("NAME");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLowerCase();

  const programOptions = [...new Map(classes.map((item) => [item.program.id, item.program.name])).entries()].sort((left, right) => left[1].localeCompare(right[1]));
  const activeClassCount = classes.filter((item) => item.status === "ACTIVE").length;
  const archivedClassCount = classes.filter((item) => item.status === "ARCHIVED").length;
  const activeStudentCount = classes.filter((item) => item.status === "ACTIVE").reduce((total, item) => total + item._count.enrollments, 0);
  const assignedGuruCount = new Set(classes.map((item) => item.guruProfile?.id).filter(Boolean)).size;
  const filteredClasses = classes
    .filter((item) => statusFilter === "ALL" || item.status === statusFilter)
    .filter((item) => programFilter === "ALL" || item.program.id === programFilter)
    .filter((item) => {
      if (!normalizedQuery) return true;
      return [item.name, item.program.name, item.level.name, item.guruProfile?.user.name || "", item.guruProfile?.user.email || ""].some((value) => value.toLowerCase().includes(normalizedQuery));
    })
    .sort((left, right) => sortOption === "STUDENTS" ? right._count.enrollments - left._count.enrollments || left.name.localeCompare(right.name) : left.name.localeCompare(right.name));

  return (
    <section id="kelas-report" className="space-y-5" aria-labelledby="kelas-report-title">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ReportMetric icon="classes" label="Total kelas" value={classes.length} helper="Semua status" tone="brand" />
        <ReportMetric icon="audit" label="Kelas aktif" value={activeClassCount} helper={`${archivedClassCount} diarsipkan`} tone="success" />
        <ReportMetric icon="student" label="Siswa aktif" value={activeStudentCount} helper="Pada kelas aktif" tone="warning" />
        <ReportMetric icon="teacher" label="Guru pengampu" value={assignedGuruCount} helper="Guru unik terhubung" tone="gray" />
      </div>

      <div className="tailadmin-card overflow-hidden">
        <div className="border-b border-gray-100 p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-theme-xs font-semibold uppercase tracking-[0.18em] text-limo-blue-500">Laporan akademik</p>
              <h2 id="kelas-report-title" className="mt-1 text-lg font-semibold text-gray-900">Kelas yang sudah dibuat</h2>
              <p className="mt-1 text-theme-sm text-gray-500">Pantau kapasitas siswa, pengampu, dan status kelas dari satu tampilan.</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1.5 text-theme-xs font-medium text-gray-500">
              <span className="size-1.5 rounded-full bg-limo-blue-500" aria-hidden="true" />
              Menampilkan {filteredClasses.length} dari {classes.length} kelas
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(150px,0.7fr)_minmax(150px,0.7fr)_auto]">
            <label className="relative block">
              <span className="sr-only">Cari kelas</span>
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"><SearchIcon /></span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Cari kelas" placeholder="Cari nama kelas, program, level, atau guru" className="tailadmin-input py-2.5 pl-10" />
            </label>
            <label>
              <span className="sr-only">Filter program kelas</span>
              <select value={programFilter} onChange={(event) => setProgramFilter(event.target.value)} aria-label="Filter program kelas" className="tailadmin-input py-2.5">
                <option value="ALL">Semua program</option>
                {programOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">Urutkan kelas</span>
              <select value={sortOption} onChange={(event) => setSortOption(event.target.value as SortOption)} aria-label="Urutkan kelas" className="tailadmin-input py-2.5">
                <option value="NAME">Urutkan nama</option>
                <option value="STUDENTS">Siswa terbanyak</option>
              </select>
            </label>
            <button type="button" onClick={() => { setQuery(""); setStatusFilter("ALL"); setProgramFilter("ALL"); setSortOption("NAME"); }} className="tailadmin-button-outline px-4 py-2.5">Atur ulang</button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter status kelas">
            {(["ALL", "ACTIVE", "INACTIVE", "ARCHIVED"] as const).map((status) => {
              const count = status === "ALL" ? classes.length : classes.filter((item) => item.status === status).length;
               const label = formatUiLabel(status);
              const selected = statusFilter === status;
               return <button key={status} type="button" role="tab" aria-selected={selected} onClick={() => setStatusFilter(status)} className={`rounded-full px-3 py-1.5 text-theme-xs font-semibold transition ${selected ? "bg-limo-blue-500 text-white shadow-theme-xs" : "bg-gray-50 text-gray-600 hover:bg-limo-blue-50 hover:text-limo-blue-600"}`}>{label} <span className={selected ? "text-white/75" : "text-gray-400"}>({count})</span></button>;
            })}
          </div>
        </div>

        {filteredClasses.length > 0 ? (
          <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-2">
            {filteredClasses.map((item) => <ClassReportCard key={item.id} item={item} guruOptions={guruOptions} expanded={expandedId === item.id} onToggle={() => setExpandedId((current) => current === item.id ? null : item.id)} />)}
          </div>
        ) : (
          <div className="p-5">
            <EmptyState icon="classes" title="Kelas tidak ditemukan" description="Tidak ada kelas yang cocok dengan filter saat ini. Coba ubah pencarian atau status." />
          </div>
        )}
      </div>
    </section>
  );
}

function ClassReportCard({ item, guruOptions, expanded, onToggle }: { item: ClassReportItem; guruOptions: GuruOption[]; expanded: boolean; onToggle: () => void }) {
  const initials = item.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "K";
  const kindLabel = formatUiLabel(item.program.kind);

  return (
    <article className={`group overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:shadow-theme-sm ${item.status === "ACTIVE" ? "" : "bg-gray-50/50"}`}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-11 shrink-0 place-items-center rounded-xl text-sm font-bold ${item.status === "ACTIVE" ? "bg-limo-blue-50 text-limo-blue-600" : "bg-gray-100 text-gray-500"}`}>{initials}</span>
            <div className="min-w-0">
              <p className="truncate text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-500" title={`${item.program.name} / ${item.level.name}`}>{item.program.name} / {item.level.name}</p>
              <h3 className="mt-1 truncate text-lg font-semibold text-gray-900" title={item.name}>{item.name}</h3>
            </div>
          </div>
          <StatusBadge status={item.status} compact className="shrink-0" />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <ReportValue icon="student" label="Siswa aktif" value={String(item._count.enrollments)} />
          <ReportValue icon="teacher" label="Pengampu" value={item.guruProfile ? "Terhubung" : "Belum ada"} tone={item.guruProfile ? "success" : "warning"} />
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-xl bg-gray-50 p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-theme-xs font-bold text-gray-500 ring-1 ring-gray-200">{item.guruProfile?.user.name.slice(0, 1).toUpperCase() || "-"}</span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Guru pengampu</p>
            <p className="truncate text-theme-sm font-semibold text-gray-800">{item.guruProfile?.user.name || "Belum ditentukan"}</p>
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-gray-500">{kindLabel}</span>
        </div>

        <button type="button" aria-expanded={expanded} onClick={onToggle} className="mt-4 flex w-full items-center justify-between border-t border-gray-100 pt-3 text-left text-theme-xs font-semibold text-limo-blue-600 hover:text-limo-blue-700">
          <span>{expanded ? "Sembunyikan ringkasan" : "Lihat ringkasan kelas"}</span>
          <ChevronIcon expanded={expanded} />
        </button>

        {expanded ? (
          <div className="mt-3 grid gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-theme-xs text-gray-600">
            <p><strong className="font-semibold text-gray-900">Level:</strong> {item.level.name}</p>
            <p><strong className="font-semibold text-gray-900">Email guru:</strong> {item.guruProfile?.user.email || "Belum tersedia"}</p>
            <p><strong className="font-semibold text-gray-900">Catatan jadwal:</strong> {item.scheduleNote || "Belum ada catatan jadwal."}</p>
          </div>
        ) : null}

        <MasterDataActions resource="kelas" id={item.id} name={item.name} scheduleNote={item.scheduleNote || ""} guruProfileId={item.guruProfile?.id || ""} guruOptions={guruOptions} archived={item.status !== "ACTIVE"} />
      </div>
    </article>
  );
}

function ReportMetric({ icon, label, value, helper, tone }: { icon: "classes" | "student" | "teacher" | "audit"; label: string; value: number; helper: string; tone: "brand" | "success" | "warning" | "gray" }) {
  const tones = {
    brand: "bg-limo-blue-50 text-limo-blue-600",
    success: "bg-success-50 text-success-700",
    warning: "bg-warning-50 text-warning-700",
    gray: "bg-gray-100 text-gray-600",
  };

  return <article className="tailadmin-card p-4"><div className="flex items-center justify-between gap-3"><span className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}><DashboardIcon name={icon} className="size-5" /></span><span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Laporan</span></div><p className="mt-4 text-2xl font-semibold tracking-tight text-gray-900">{value}</p><p className="mt-1 text-theme-sm font-semibold text-gray-800">{label}</p><p className="mt-0.5 text-theme-xs text-gray-500">{helper}</p></article>;
}

function ReportValue({ icon, label, value, tone = "brand" }: { icon: "student" | "teacher"; label: string; value: string; tone?: "brand" | "success" | "warning" }) {
  const tones = { brand: "bg-limo-blue-50 text-limo-blue-600", success: "bg-success-50 text-success-700", warning: "bg-warning-50 text-warning-700" };
  return <div className="flex min-w-0 items-center gap-2 rounded-xl border border-gray-100 p-3"><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${tones[tone]}`}><DashboardIcon name={icon} className="size-4" /></span><div className="min-w-0"><p className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p><p className="truncate text-theme-sm font-semibold text-gray-800">{value}</p></div></div>;
}

function SearchIcon() {
  return <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5" /><path d="m12.5 12.5 4 4" strokeLinecap="round" /></svg>;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return <svg viewBox="0 0 20 20" className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
