export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-gray-50 px-6 text-center">
      <div role="status" aria-live="polite">
        <div className="mx-auto size-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-500" />
        <p className="mt-4 text-theme-sm font-semibold text-gray-800">Memuat LIMO...</p>
        <p className="mt-1 text-theme-xs text-gray-500">Menyiapkan halaman Anda.</p>
      </div>
    </main>
  );
}
