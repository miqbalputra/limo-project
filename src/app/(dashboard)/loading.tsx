export default function DashboardLoading() {
  return (
    <main className="space-y-6" aria-busy="true" aria-label="Memuat dashboard">
      <div className="h-32 animate-pulse rounded-3xl bg-gray-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl bg-gray-200" />)}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-gray-200" />
    </main>
  );
}
