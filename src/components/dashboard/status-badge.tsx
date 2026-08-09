import type { ReactNode } from "react";
import {
  formatUiLabel,
  getUiTone,
  getUiToneClass,
  type UiTone,
} from "@/lib/ui-labels";

export type StatusBadgeProps = {
  status: string | null | undefined;
  fallback?: string;
  compact?: boolean;
  noIcon?: boolean;
  suffix?: ReactNode;
  className?: string;
};

export function StatusBadge({
  status,
  fallback,
  compact = false,
  noIcon = false,
  suffix,
  className,
}: StatusBadgeProps) {
  const tone = getUiTone(status);
  const label = formatUiLabel(status, fallback);

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${compact ? "gap-1 px-2 py-1 text-[10px]" : "gap-1.5 px-2.5 py-1 text-theme-xs"} ${getUiToneClass(status)}${className ? ` ${className}` : ""}`}
    >
      {!noIcon ? <StatusIcon tone={tone} /> : null}
      <span>
        {label}
        {suffix}
      </span>
    </span>
  );
}

function StatusIcon({ tone }: { tone: UiTone }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="size-3 shrink-0"
    >
      {tone === "neutral" ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M8.5 12h7" />
        </>
      ) : null}
      {tone === "info" ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 10v5M12 7.5h.01" />
        </>
      ) : null}
      {tone === "success" ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="m8.5 12 2.3 2.3 4.8-5" />
        </>
      ) : null}
      {tone === "warning" ? (
        <>
          <path d="m12 4 8 15H4L12 4Z" />
          <path d="M12 9v4M12 16h.01" />
        </>
      ) : null}
      {tone === "danger" ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="m9 9 6 6m0-6-6 6" />
        </>
      ) : null}
    </svg>
  );
}
