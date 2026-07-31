import Link from "next/link";
import type { ReactNode } from "react";
import type { DashboardIconName } from "@/components/dashboard/dashboard-icon";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";

export function DashboardHero({ eyebrow, title, description, actions, aside }: { eyebrow: string; title: string; description: string; actions?: ReactNode; aside?: ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-theme-xs sm:p-7 lg:p-8">
      <div className="absolute -right-16 -top-20 size-64 rounded-full bg-brand-50 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-24 left-1/3 size-72 rounded-full bg-success-50 blur-3xl" aria-hidden="true" />
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-theme-sm font-semibold text-brand-500">{eyebrow}</p>
          <h1 className="mt-2 text-title-sm font-semibold tracking-tight text-gray-900 sm:text-title-md">{title}</h1>
          <p className="mt-3 max-w-2xl text-theme-sm leading-6 text-gray-500">{description}</p>
          {actions ? <div className="mt-5 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
    </section>
  );
}

export function MetricCard({ label, value, description, icon, tone = "brand" }: { label: string; value: string | number; description: string; icon: DashboardIconName; tone?: "brand" | "success" | "warning" | "error" | "gray" }) {
  const tones = {
    brand: "bg-brand-50 text-brand-600",
    success: "bg-success-50 text-success-700",
    warning: "bg-warning-50 text-warning-700",
    error: "bg-error-50 text-error-700",
    gray: "bg-gray-50 text-gray-600",
  };

  return (
    <article className="tailadmin-card p-5 transition hover:-translate-y-0.5 hover:shadow-theme-sm">
      <div className="flex items-start justify-between gap-4">
        <span className={`grid size-12 place-items-center rounded-xl ${tones[tone]}`}><DashboardIcon name={icon} className="size-6" /></span>
        <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Live</span>
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-theme-sm font-medium text-gray-800">{label}</p>
      <p className="mt-1 text-theme-xs leading-5 text-gray-500">{description}</p>
    </article>
  );
}

export function QuickActionCard({ href, icon, label, description }: { href: string; icon: DashboardIconName; label: string; description: string }) {
  return (
    <Link href={href} className="group flex min-h-24 items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-theme-sm">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gray-50 text-gray-500 transition group-hover:bg-brand-50 group-hover:text-brand-500"><DashboardIcon name={icon} className="size-5" /></span>
      <span className="min-w-0"><span className="block text-theme-sm font-semibold text-gray-800">{label}</span><span className="mt-1 block text-theme-xs leading-5 text-gray-500">{description}</span></span>
    </Link>
  );
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="font-semibold text-gray-900">{title}</h2>{description ? <p className="mt-1 text-theme-xs text-gray-500">{description}</p> : null}</div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: DashboardIconName; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="tailadmin-card flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-gray-50 text-gray-400"><DashboardIcon name={icon} className="size-7" /></span>
      <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 max-w-md text-theme-sm leading-6 text-gray-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ProgressBar({ value, max = 100, tone = "brand" }: { value: number; max?: number; tone?: "brand" | "success" | "warning" | "error" }) {
  const colors = { brand: "bg-brand-500", success: "bg-success-500", warning: "bg-warning-500", error: "bg-error-500" };
  const width = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));

  return <div role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} aria-label={`Progress ${Math.round(value)} dari ${max}`} className="h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${colors[tone]}`} style={{ width: `${width}%` }} /></div>;
}
