import type { DashboardIconName } from "@/components/dashboard/dashboard-icon";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";

export type MetricTone = "brand" | "success" | "warning" | "error" | "gray";

export type MetricCardProps = {
  label: string;
  value: string | number;
  description: string;
  icon: DashboardIconName;
  tone?: MetricTone;
  compact?: boolean;
  dense?: boolean;
  hoverable?: boolean;
  iconClassName?: string;
  className?: string;
};

const metricToneClasses: Record<MetricTone, string> = {
  brand: "bg-limo-blue-50 text-limo-blue-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  error: "bg-error-50 text-error-700",
  gray: "bg-gray-50 text-gray-600",
};

export function MetricCard({
  label,
  value,
  description,
  icon,
  tone = "brand",
  compact = false,
  dense = false,
  hoverable = true,
  iconClassName,
  className,
}: MetricCardProps) {
  const valueText = String(value);

  return (
    <article
      className={`tailadmin-card p-5${hoverable ? " transition hover:shadow-theme-sm" : ""}${className ? ` ${className}` : ""}`}
    >
      <div className="flex items-start">
        <span
          className={`grid ${compact ? "size-11" : "size-12"} place-items-center rounded-xl ${iconClassName || metricToneClasses[tone]}`}
        >
          <DashboardIcon name={icon} className={compact ? "size-5" : "size-6"} />
        </span>
      </div>
      <p
        className={
          compact
            ? `${dense ? "mt-4" : "mt-5"} truncate text-2xl font-semibold tracking-tight text-gray-900`
            : "mt-5 text-3xl font-semibold tracking-tight text-gray-900"
        }
        title={compact ? valueText : undefined}
      >
        {value}
      </p>
      <p className={`mt-1 text-theme-sm ${compact ? "font-semibold" : "font-medium"} text-gray-800`}>{label}</p>
      <p className={`mt-1 text-theme-xs ${dense ? "" : "leading-5 "}text-gray-500`}>{description}</p>
    </article>
  );
}

export function MetricStat({
  label,
  value,
  helper,
  align = "start",
  rounded = "xl",
  valueClassName = "text-theme-sm",
  truncateLabel = false,
  className,
}: {
  label: string;
  value: string | number;
  helper?: string;
  align?: "start" | "center";
  rounded?: "xl" | "2xl";
  valueClassName?: string;
  truncateLabel?: boolean;
  className?: string;
}) {
  const valueText = String(value);

  return (
    <div
      className={`min-w-0 ${rounded === "2xl" ? "rounded-2xl" : "rounded-xl"} bg-gray-50 p-3${align === "center" ? " text-center" : ""}${className ? ` ${className}` : ""}`}
    >
      <p className={`truncate ${valueClassName} font-semibold text-gray-900`} title={valueText}>
        {value}
      </p>
      <p
        className={`mt-1 ${truncateLabel ? "truncate " : ""}text-[10px] font-semibold uppercase tracking-wide text-gray-400`}
      >
        {label}
      </p>
      {helper ? <p className="mt-0.5 truncate text-[10px] text-gray-400">{helper}</p> : null}
    </div>
  );
}
