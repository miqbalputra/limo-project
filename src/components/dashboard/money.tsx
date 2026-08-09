import { formatRupiah } from "@/lib/money";

export function Money({
  value,
  className,
  title,
}: {
  value: number;
  className?: string;
  title?: string;
}) {
  return (
    <data value={String(value)} className={className} title={title}>
      {formatRupiah(value)}
    </data>
  );
}
