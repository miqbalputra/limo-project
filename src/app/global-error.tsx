"use client";

// global-error menangani kegagalan di root layout itu sendiri (kelas error
// paling parah) — wajib merender <html> dan <body> sendiri. Tanpa file ini,
// kegagalan tersebut menampilkan halaman error bawaan Next berbahasa Inggris.
// Tailwind tidak ter-load pada boundary ini, gaya memakai inline style minimal
// yang diambil langsung dari token LIMO.

import { LIMO_COLORS } from "@/lib/limo-brand";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", background: LIMO_COLORS.neutral[50] }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
          <section style={{ width: "100%", maxWidth: 448, background: LIMO_COLORS.white, border: `1px solid ${LIMO_COLORS.neutral[200]}`, borderRadius: 16, padding: 24, textAlign: "center", boxShadow: "0 10px 30px rgba(4,40,71,0.08)" }}>
            <span aria-hidden="true" style={{ display: "inline-grid", placeItems: "center", width: 56, height: 56, borderRadius: 16, background: LIMO_COLORS.red[100], color: LIMO_COLORS.red[700], fontSize: 24, fontWeight: 700 }}>!</span>
            <h1 style={{ marginTop: 16, fontSize: 20, fontWeight: 600, color: LIMO_COLORS.neutral[800] }}>Terjadi gangguan pada sistem</h1>
            <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, color: LIMO_COLORS.neutral[600] }}>
              Maaf, LIMO mengalami kendala teknis. Data Anda tetap aman. Coba muat ulang halaman; bila berlanjut, hubungi admin sekolah dan sebutkan kode bantuan berikut.
            </p>
            {error.digest ? <p style={{ marginTop: 12, fontSize: 12, color: LIMO_COLORS.neutral[400] }}>Kode bantuan: {error.digest}</p> : null}
            <button
              type="button"
              onClick={() => reset()}
              style={{ marginTop: 20, background: LIMO_COLORS.blue[500], color: LIMO_COLORS.white, border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Coba Lagi
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
