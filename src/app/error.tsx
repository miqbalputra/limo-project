"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-gray-50 px-6">
      <section className="tailadmin-card w-full max-w-lg p-6 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-error-50 text-2xl text-error-700">!</span>
        <h1 className="mt-4 text-xl font-semibold text-gray-900">Halaman mengalami kendala</h1>
        <p className="mt-2 text-theme-sm leading-6 text-gray-500">Data Anda tetap aman. Coba muat ulang halaman atau kembali ke dashboard.</p>
        {error.digest ? <p className="mt-3 text-theme-xs text-gray-400">Kode bantuan: {error.digest}</p> : null}
        <button type="button" onClick={() => reset()} className="mt-5 tailadmin-button-primary px-5 py-2.5">Coba Lagi</button>
      </section>
    </main>
  );
}
