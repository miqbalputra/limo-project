import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-gray-50 px-6">
      <section className="tailadmin-card w-full max-w-lg p-6 text-center">
        <p className="text-5xl font-semibold text-brand-500">404</p>
        <h1 className="mt-3 text-xl font-semibold text-gray-900">Halaman tidak ditemukan</h1>
        <p className="mt-2 text-theme-sm leading-6 text-gray-500">Tautan mungkin sudah berubah atau halaman belum tersedia untuk akun Anda.</p>
        <Link href="/" className="mt-5 tailadmin-button-primary px-5 py-2.5">Kembali ke Beranda</Link>
      </section>
    </main>
  );
}
