import Link from "next/link";

export function PaginationControls({
  basePath,
  page,
  totalPages,
  pageParam = "page",
  params = {},
}: {
  basePath: string;
  page: number;
  totalPages: number;
  pageParam?: string;
  params?: Record<string, string | number | undefined>;
}) {
  if (totalPages <= 1) {
    return null;
  }

  function href(targetPage: number) {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, String(value));
    }

    query.set(pageParam, String(targetPage));
    return `${basePath}?${query.toString()}`;
  }

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 text-theme-sm">
      <p className="text-gray-500">Halaman {page} dari {totalPages}</p>
      <div className="flex items-center gap-2">
        {page > 1 ? <Link href={href(page - 1)} className="tailadmin-button-outline px-3 py-1.5">Sebelumnya</Link> : <span className="rounded-lg border border-gray-100 px-3 py-1.5 text-gray-300">Sebelumnya</span>}
        {page < totalPages ? <Link href={href(page + 1)} className="tailadmin-button-outline px-3 py-1.5">Berikutnya</Link> : <span className="rounded-lg border border-gray-100 px-3 py-1.5 text-gray-300">Berikutnya</span>}
      </div>
    </nav>
  );
}
