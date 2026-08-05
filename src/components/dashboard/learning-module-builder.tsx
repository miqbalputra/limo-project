"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type DateValue = string | Date | null;

export type LearningModuleItemView = {
  id: string;
  itemType: string;
  entityId: string;
  titleOverride: string | null;
  order: number;
  isRequired: boolean;
  availableFrom: DateValue;
  availableUntil: DateValue;
  prerequisiteItemId: string | null;
  prerequisiteItem: { id: string; itemType: string; entityId: string; titleOverride: string | null } | null;
  title: string;
  targetStatus: string;
  targetPublished: boolean;
  isAvailable: boolean;
  isScheduled: boolean;
  isExpired: boolean;
  isLockedByPrerequisite: boolean;
};

export type LearningModuleView = {
  id: string;
  kelasId: string;
  title: string;
  description: string | null;
  order: number;
  status: string;
  releaseAt: DateValue;
  dueAt: DateValue;
  publishedAt: DateValue;
  items: LearningModuleItemView[];
};

type SelectOption = { id: string; title: string; status: string };

export type LearningModuleOptions = {
  materials: SelectOption[];
  assignments: SelectOption[];
  exams: SelectOption[];
  sessions: SelectOption[];
};

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

async function requestJson(path: string, options: RequestOptions = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = (await response.json().catch(() => ({}))) as { data?: unknown; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || "Perubahan modul gagal disimpan");
  return payload.data;
}

export function LearningModuleBuilder({ kelasId, initialModules, options }: { kelasId: string; initialModules: LearningModuleView[]; options: LearningModuleOptions }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function createModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsCreating(true);
    try {
      const data = new FormData(event.currentTarget);
      await requestJson(`/api/v1/guru/kelas/${kelasId}/modul`, {
        method: "POST",
        body: {
          title: String(data.get("title") || ""),
          description: String(data.get("description") || ""),
          order: Number(data.get("order") || 0),
          releaseAt: String(data.get("releaseAt") || ""),
          dueAt: String(data.get("dueAt") || ""),
        },
      });
      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Modul gagal dibuat");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={createModule} className="tailadmin-card grid gap-4 p-5">
        <div>
          <p className="text-theme-xs font-semibold uppercase tracking-wide text-brand-500">Builder modul</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">Buat alur belajar baru</h2>
          <p className="mt-1 text-theme-sm text-gray-500">Susun materi, sesi, dan ujian existing tanpa menghapus akses daftar materi lama.</p>
        </div>
        {error ? <p className="tailadmin-alert-error">{error}</p> : null}
        <div className="grid gap-3 md:grid-cols-2">
          <input name="title" required minLength={3} maxLength={200} placeholder="Judul modul, misalnya Unit 1: Greetings" className="tailadmin-input" />
          <input name="order" type="number" min={0} defaultValue={initialModules.length} placeholder="Urutan" className="tailadmin-input" />
        </div>
        <textarea name="description" maxLength={10000} placeholder="Tujuan atau ringkasan modul" className="tailadmin-input min-h-24" />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-theme-xs font-semibold text-gray-600">Release
            <input name="releaseAt" type="datetime-local" className="tailadmin-input" />
          </label>
          <label className="grid gap-1 text-theme-xs font-semibold text-gray-600">Batas akhir opsional
            <input name="dueAt" type="datetime-local" className="tailadmin-input" />
          </label>
        </div>
        <button disabled={isCreating} className="tailadmin-button-primary w-full sm:w-fit">
          {isCreating ? "Menyimpan..." : "Tambah Modul"}
        </button>
      </form>

      {initialModules.length > 0 ? (
        <div className="space-y-4">
          {initialModules.map((module) => <ModuleCard key={module.id} module={module} options={options} onRefresh={() => router.refresh()} />)}
        </div>
      ) : (
        <div className="tailadmin-card p-8 text-center text-theme-sm text-gray-500">Belum ada modul. Buat modul pertama untuk mulai menyusun alur belajar kelas.</div>
      )}
    </div>
  );
}

function ModuleCard({ module, options, onRefresh }: { module: LearningModuleView; options: LearningModuleOptions; onRefresh: () => void }) {
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");

  async function runAction(action: string, path: string, method = "POST", body?: unknown) {
    if (action === "archive" && !window.confirm("Arsipkan modul ini? Data aktivitas dan nilai siswa tidak akan dihapus.")) return;
    setError("");
    setBusyAction(action);
    try {
      await requestJson(path, { method, body });
      onRefresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Perubahan modul gagal disimpan");
    } finally {
      setBusyAction("");
    }
  }

  async function reorderItems(itemIds: string[]) {
    await runAction("reorder", `/api/v1/guru/modul/${module.id}/reorder`, "PATCH", { itemIds });
  }

  return (
    <article className="tailadmin-card overflow-hidden">
      <div className="border-b border-gray-100 bg-gray-50/70 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClass(module.status)}`}>{module.status}</span>
              <span className="text-theme-xs text-gray-500">Urutan {module.order}</span>
            </div>
            <h2 className="mt-2 break-words text-xl font-semibold text-gray-900">{module.title}</h2>
            <p className="mt-1 whitespace-pre-line text-theme-sm leading-6 text-gray-500">{module.description || "Belum ada deskripsi modul."}</p>
            <p className="mt-3 text-theme-xs text-gray-500">
              {module.releaseAt ? `Release ${formatDate(module.releaseAt)}` : "Tersedia tanpa jadwal release"}
              {module.dueAt ? ` / Batas ${formatDate(module.dueAt)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
            {module.status !== "PUBLISHED" ? <button disabled={Boolean(busyAction)} onClick={() => void runAction("publish", `/api/v1/guru/modul/${module.id}/publish`)} className="tailadmin-button-primary px-3 py-2 text-theme-xs">{busyAction === "publish" ? "..." : "Publish"}</button> : null}
            {module.status !== "ARCHIVED" ? <button disabled={Boolean(busyAction)} onClick={() => void runAction("archive", `/api/v1/guru/modul/${module.id}/archive`)} className="tailadmin-button-outline px-3 py-2 text-theme-xs">{busyAction === "archive" ? "..." : "Arsipkan"}</button> : null}
            {module.status === "ARCHIVED" ? <button disabled={Boolean(busyAction)} onClick={() => void runAction("restore", `/api/v1/guru/modul/${module.id}`, "PATCH", { status: "DRAFT" })} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Kembalikan Draft</button> : null}
            <button disabled={Boolean(busyAction)} onClick={() => void runAction("duplicate", `/api/v1/guru/modul/${module.id}/duplicate`)} className="tailadmin-button-outline px-3 py-2 text-theme-xs">{busyAction === "duplicate" ? "..." : "Duplikasi"}</button>
          </div>
        </div>
        {error ? <p className="mt-4 tailadmin-alert-error">{error}</p> : null}
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.6fr)]">
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="font-semibold text-gray-900">Aktivitas Modul</h3><p className="mt-1 text-theme-xs text-gray-500">{module.items.length} aktivitas / urutan dibaca dari atas ke bawah.</p></div>
          </div>
          <div className="mt-4 space-y-3">
            {module.items.length > 0 ? module.items.map((item, index) => (
              <ModuleItemRow
                key={item.id}
                item={item}
                index={index}
                total={module.items.length}
                onMove={(direction) => {
                  const next = module.items.map((entry) => entry.id);
                  const swapIndex = index + direction;
                  [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
                  void reorderItems(next);
                }}
                onDelete={() => void runAction("delete", `/api/v1/guru/modul/${module.id}/items/${item.id}`, "DELETE")}
                busy={Boolean(busyAction)}
              />
            )) : <p className="rounded-xl border border-dashed border-gray-200 p-5 text-theme-sm text-gray-500">Belum ada aktivitas. Tambahkan materi, sesi, atau ujian dari pilihan existing.</p>}
          </div>
        </section>
        <ModuleItemForm moduleId={module.id} items={module.items} options={options} onDone={onRefresh} />
      </div>

      <ModuleEditForm module={module} onDone={onRefresh} />
    </article>
  );
}

function ModuleEditForm({ module, onDone }: { module: LearningModuleView; onDone: () => void }) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const data = new FormData(event.currentTarget);
      await requestJson(`/api/v1/guru/modul/${module.id}`, {
        method: "PATCH",
        body: {
          title: String(data.get("title") || ""),
          description: String(data.get("description") || ""),
          order: Number(data.get("order") || 0),
          releaseAt: String(data.get("releaseAt") || ""),
          dueAt: String(data.get("dueAt") || ""),
        },
      });
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Modul gagal diperbarui");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <details className="border-t border-gray-100">
      <summary className="cursor-pointer px-5 py-4 text-theme-sm font-semibold text-brand-600">Edit detail modul</summary>
      <form onSubmit={submit} className="grid gap-3 px-5 pb-5">
        {error ? <p className="tailadmin-alert-error">{error}</p> : null}
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_7rem]">
          <input name="title" required minLength={3} maxLength={200} defaultValue={module.title} className="tailadmin-input" />
          <input name="order" type="number" min={0} defaultValue={module.order} className="tailadmin-input" />
        </div>
        <textarea name="description" maxLength={10000} defaultValue={module.description || ""} className="tailadmin-input min-h-20" />
        <div className="grid gap-3 md:grid-cols-2">
          <input name="releaseAt" type="datetime-local" defaultValue={toDateInput(module.releaseAt)} className="tailadmin-input" />
          <input name="dueAt" type="datetime-local" defaultValue={toDateInput(module.dueAt)} className="tailadmin-input" />
        </div>
        <button disabled={isSubmitting} className="tailadmin-button-outline w-full sm:w-fit">{isSubmitting ? "Menyimpan..." : "Simpan Detail"}</button>
      </form>
    </details>
  );
}

function ModuleItemForm({ moduleId, items, options, onDone }: { moduleId: string; items: LearningModuleItemView[]; options: LearningModuleOptions; onDone: () => void }) {
  const [itemType, setItemType] = useState("MATERIAL");
  const [entityId, setEntityId] = useState(options.materials[0]?.id || "");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const choices = getChoices(itemType, options);

  function changeType(nextType: string) {
    setItemType(nextType);
    setEntityId(getChoices(nextType, options)[0]?.id || "");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const data = new FormData(event.currentTarget);
      await requestJson(`/api/v1/guru/modul/${moduleId}/items`, {
        method: "POST",
        body: {
          itemType: String(data.get("itemType") || "MATERIAL"),
          entityId: String(data.get("entityId") || ""),
          titleOverride: String(data.get("titleOverride") || ""),
          order: Number(data.get("order") || items.length),
          isRequired: Boolean(data.get("isRequired")),
          availableFrom: String(data.get("availableFrom") || ""),
          availableUntil: String(data.get("availableUntil") || ""),
          prerequisiteItemId: String(data.get("prerequisiteItemId") || ""),
        },
      });
      event.currentTarget.reset();
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aktivitas gagal ditambahkan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
      <h3 className="font-semibold text-gray-900">Tambah Aktivitas</h3>
      <p className="mt-1 text-theme-xs leading-5 text-gray-500">Fase ini menghubungkan materi, sesi, dan ujian existing.</p>
      {error ? <p className="mt-3 tailadmin-alert-error">{error}</p> : null}
      <div className="mt-4 grid gap-3">
        <select name="itemType" value={itemType} onChange={(event) => changeType(event.target.value)} className="tailadmin-input">
          <option value="MATERIAL">Materi</option>
          <option value="ASSIGNMENT">Tugas</option>
          <option value="CLASS_SESSION">Sesi kelas</option>
          <option value="EXAM">Ujian</option>
          <option value="QUIZ">Quiz (fase berikutnya)</option>
          <option value="DISCUSSION">Diskusi (fase berikutnya)</option>
        </select>
        <select name="entityId" value={entityId} onChange={(event) => setEntityId(event.target.value)} disabled={choices.length === 0} className="tailadmin-input">
          {choices.length > 0 ? choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.title} / {choice.status}</option>) : <option value="">Belum ada pilihan tersedia</option>}
        </select>
        <input name="titleOverride" maxLength={200} placeholder="Judul alternatif (opsional)" className="tailadmin-input" />
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="order" type="number" min={0} defaultValue={items.length} placeholder="Urutan" className="tailadmin-input" />
          <select name="prerequisiteItemId" defaultValue="" className="tailadmin-input">
            <option value="">Tanpa prasyarat</option>
            {items.map((item) => <option key={item.id} value={item.id}>{item.order + 1}. {item.title}</option>)}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-theme-xs font-semibold text-gray-600">Mulai tersedia
            <input name="availableFrom" type="datetime-local" className="tailadmin-input" />
          </label>
          <label className="grid gap-1 text-theme-xs font-semibold text-gray-600">Berakhir tersedia
            <input name="availableUntil" type="datetime-local" className="tailadmin-input" />
          </label>
        </div>
        <label className="flex items-center gap-2 text-theme-sm text-gray-600"><input name="isRequired" type="checkbox" defaultChecked /> Aktivitas wajib</label>
        <button disabled={isSubmitting || choices.length === 0} className="tailadmin-button-primary w-full">{isSubmitting ? "Menambahkan..." : "Tambahkan ke Modul"}</button>
      </div>
    </form>
  );
}

function ModuleItemRow({ item, index, total, onMove, onDelete, busy }: { item: LearningModuleItemView; index: number; total: number; onMove: (_direction: -1 | 1) => void; onDelete: () => void; busy: boolean }) {
  return (
    <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-theme-xs">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-theme-xs font-semibold text-brand-600">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600">{item.itemType}</span>{item.isRequired ? <span className="text-[10px] font-semibold text-warning-700">Wajib</span> : null}</div>
          <p className="mt-2 break-words font-semibold text-gray-900">{item.title}</p>
          <p className="mt-1 break-all text-theme-xs text-gray-500">Entity {item.entityId} / {item.targetStatus}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold">
            {item.isLockedByPrerequisite ? <span className="rounded-full bg-warning-50 px-2 py-1 text-warning-700">Terkunci prasyarat</span> : null}
            {item.isScheduled ? <span className="rounded-full bg-brand-50 px-2 py-1 text-brand-700">Terjadwal</span> : null}
            {item.isExpired ? <span className="rounded-full bg-error-50 px-2 py-1 text-error-700">Batas lewat</span> : null}
            {!item.targetPublished ? <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-600">Target belum publish</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button type="button" disabled={busy || index === 0} onClick={() => onMove(-1)} className="rounded-lg border border-gray-200 px-2 py-1 text-theme-xs text-gray-600 disabled:opacity-40" aria-label="Naikkan aktivitas">↑</button>
          <button type="button" disabled={busy || index === total - 1} onClick={() => onMove(1)} className="rounded-lg border border-gray-200 px-2 py-1 text-theme-xs text-gray-600 disabled:opacity-40" aria-label="Turunkan aktivitas">↓</button>
          <button type="button" disabled={busy} onClick={() => { if (window.confirm("Hapus aktivitas dari modul? Entity existing tidak akan dihapus.")) onDelete(); }} className="rounded-lg border border-error-100 px-2 py-1 text-theme-xs text-error-700 disabled:opacity-40" aria-label="Hapus aktivitas">×</button>
        </div>
      </div>
    </article>
  );
}

function getChoices(itemType: string, options: LearningModuleOptions) {
  if (itemType === "MATERIAL") return options.materials;
  if (itemType === "ASSIGNMENT") return options.assignments;
  if (itemType === "EXAM") return options.exams;
  if (itemType === "CLASS_SESSION") return options.sessions;
  return [];
}

function statusClass(status: string) {
  return {
    DRAFT: "bg-gray-100 text-gray-700",
    SCHEDULED: "bg-warning-50 text-warning-700",
    PUBLISHED: "bg-success-50 text-success-700",
    ARCHIVED: "bg-error-50 text-error-700",
  }[status] || "bg-gray-100 text-gray-700";
}

function formatDate(value: DateValue) {
  if (!value) return "";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

function toDateInput(value: DateValue) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}
