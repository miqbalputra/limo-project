import { Fragment, type ReactNode } from "react";

export type ResponsiveDataColumn<Row> = {
  id: string;
  label: ReactNode;
  render: (_row: Row) => ReactNode;
  cellClassName?: string;
  headerClassName?: string;
  mobileValueClassName?: string;
};

type Breakpoint = "lg" | "xl" | "2xl";

type ResponsiveDataViewProps<Row> = {
  rows: readonly Row[];
  columns: readonly ResponsiveDataColumn<Row>[];
  getRowKey: (_row: Row) => string;
  tableLabel: string;
  desktopBreakpoint?: Breakpoint;
  empty?: ReactNode;
  testId?: string;
  tableClassName?: string;
  headerClassName?: string;
  rowClassName?: string | ((_row: Row) => string);
  cardsClassName?: string;
  cardClassName?: string;
  cardLabel?: (_row: Row) => string;
  isExpanded?: (_row: Row) => boolean;
  renderExpandedContent?: (_row: Row) => ReactNode;
};

const breakpointClasses: Record<Breakpoint, { desktop: string; mobile: string }> = {
  lg: { desktop: "hidden lg:block", mobile: "grid gap-3 lg:hidden" },
  xl: { desktop: "hidden xl:block", mobile: "grid gap-3 xl:hidden" },
  "2xl": { desktop: "hidden 2xl:block", mobile: "grid gap-3 2xl:hidden" },
};

/**
 * Keeps dense operational data readable: semantic tables at a safe desktop
 * width and explicit, labelled fields for touch-first screens.
 */
export function ResponsiveDataView<Row>({
  rows,
  columns,
  getRowKey,
  tableLabel,
  desktopBreakpoint = "xl",
  empty,
  testId,
  tableClassName = "",
  headerClassName = "",
  rowClassName = "",
  cardsClassName = "",
  cardClassName = "",
  cardLabel,
  isExpanded,
  renderExpandedContent,
}: ResponsiveDataViewProps<Row>) {
  if (rows.length === 0) return empty ? <>{empty}</> : null;

  const visibility = breakpointClasses[desktopBreakpoint];
  const getRowClassName = (row: Row) =>
    typeof rowClassName === "function" ? rowClassName(row) : rowClassName;

  return (
    <>
      <div className={`${visibility.desktop} overflow-x-auto`} data-testid={testId ? `${testId}-table` : undefined}>
        <table className={`w-full text-left text-theme-sm ${tableClassName}`} aria-label={tableLabel}>
          <thead className={`border-b border-gray-100 bg-gray-50 text-theme-xs font-semibold uppercase tracking-wide text-gray-500 ${headerClassName}`}>
            <tr>
              {columns.map((column) => (
                <th key={column.id} scope="col" className={`px-5 py-3 ${column.headerClassName || ""}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const key = getRowKey(row);
              const expanded = isExpanded?.(row) ?? false;
              return (
                <Fragment key={key}>
                  <tr className={getRowClassName(row)}>
                    {columns.map((column) => (
                      <td key={column.id} className={`px-5 py-4 align-top ${column.cellClassName || ""}`}>
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                  {expanded && renderExpandedContent ? (
                    <tr>
                      <td colSpan={columns.length} className="bg-gray-50/70 px-5 py-4">
                        {renderExpandedContent(row)}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={`${visibility.mobile} p-4 sm:p-5 ${cardsClassName}`} data-testid={testId ? `${testId}-cards` : undefined}>
        {rows.map((row) => {
          const expanded = isExpanded?.(row) ?? false;
          return (
            <article key={getRowKey(row)} aria-label={cardLabel?.(row)} className={`rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs ${cardClassName}`}>
              <dl className="divide-y divide-gray-100">
                {columns.map((column) => (
                  <div key={column.id} className="grid gap-1 py-3 first:pt-0 last:pb-0">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{column.label}</dt>
                    <dd className={`min-w-0 text-theme-sm text-gray-800 ${column.mobileValueClassName || ""}`}>{column.render(row)}</dd>
                  </div>
                ))}
              </dl>
              {expanded && renderExpandedContent ? <div className="mt-4 border-t border-gray-100 pt-4">{renderExpandedContent(row)}</div> : null}
            </article>
          );
        })}
      </div>
    </>
  );
}
