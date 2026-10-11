"use client";

// global-error menangani kegagalan di root layout itu sendiri (kelas error
// paling parah) — wajib merender <html> dan <body> sendiri. Tanpa file ini,
// kegagalan tersebut menampilkan halaman error bawaan Next berbahasa Inggris.
// Tailwind tidak ter-load pada boundary ini, gaya memakai inline style minimal.

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", background: "#f9fafb" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
          <section style={{ width: "100%", maxWidth: 448, background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 24, textAlign: "center", boxShadow: "0 10px 30px rgba(4,40,71,0.08)" }}>
            <span aria-hidden="true" style={{ display: "inline-grid", placeItems: "center", width: 56, height: 56, borderRadius: 16, background: "#fee2e2", color: "#b91c1c", fontSize: 24, fontWeight: 700 }}>!</span>
            <h1 style={{ marginTop: 16, fontSize: 20, fontWeight: 600, color: "#111827" }}>Terjadi gangguan pada sistem</h1>
            <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, color: "#6b7280" }}>
              Maaf, LIMO mengalami kendala teknis. Data Anda tetap aman. Coba muat ulang halaman; bila berlanjut, hubungi admin sekolah dan sebutkan kode bantuan berikut.
            </p>
            {error.digest ? <p style={{ marginTop: 12, fontSize: 12, color: "#9ca3af" }}>Kode bantuan: {error.digest}</p> : null}
            <button
              type="button"
              onClick={() => reset()}
              style={{ marginTop: 20, background: "#2563eb", color: "#ffffff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Coba Lagi
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
