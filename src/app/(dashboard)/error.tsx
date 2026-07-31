"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center justify-center px-4 py-10">
      <section className="tailadmin-card w-full p-6 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Data belum dapat dimuat</h1>
        <p className="mt-2 text-theme-sm leading-6 text-gray-500">Coba lagi. Jika masalah berlanjut, sampaikan kode bantuan kepada admin LIMO.</p>
        {error.digest ? <p className="mt-3 text-theme-xs text-gray-400">Kode bantuan: {error.digest}</p> : null}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => reset()} className="tailadmin-button-primary px-5 py-2.5">Coba Lagi</button>
          <Link href="/" className="tailadmin-button-outline px-5 py-2.5">Ke Beranda</Link>
        </div>
      </section>
    </main>
  );
}
