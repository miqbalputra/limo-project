import Link from "next/link";

export const metadata = { title: "Kebijakan Privasi", alternates: { canonical: "/kebijakan-privasi" } };

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-5 py-12 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs sm:p-10">
        <Link href="/" className="text-theme-sm font-semibold text-brand-500">Kembali ke beranda</Link>
        <h1 className="mt-5 text-3xl font-semibold text-gray-900">Kebijakan Privasi</h1>
        <p className="mt-2 text-theme-sm text-gray-500">Terakhir diperbarui: 22 Juli 2026</p>
        <div className="mt-8 space-y-6 text-theme-sm leading-7 text-gray-700">
          <section><h2 className="font-semibold text-gray-900">Data yang dikumpulkan</h2><p className="mt-2">LIMO memproses data calon siswa, wali, program pilihan, dokumen pendukung, data pembelajaran, presensi, nilai, progres, dan tagihan untuk memberikan layanan kursus.</p></section>
          <section><h2 className="font-semibold text-gray-900">Tujuan pemrosesan</h2><p className="mt-2">Data digunakan untuk pendaftaran, pengelolaan kelas, komunikasi operasional, pemantauan perkembangan, keamanan akun, dan administrasi pembayaran.</p></section>
          <section><h2 className="font-semibold text-gray-900">Perlindungan data</h2><p className="mt-2">Dokumen dan data privat tidak disajikan melalui URL publik. Akses dibatasi berdasarkan role dan relasi pengguna, serta aktivitas penting dicatat untuk audit.</p></section>
          <section><h2 className="font-semibold text-gray-900">Retensi dan hak pengguna</h2><p className="mt-2">Data disimpan selama diperlukan untuk layanan dan kewajiban administrasi. Wali dapat meminta koreksi data melalui kanal resmi LIMO.</p></section>
          <section><h2 className="font-semibold text-gray-900">Cache perangkat</h2><p className="mt-2">PWA hanya menyimpan aset publik dan offline shell. API, dashboard, dokumen, nilai, presensi, dan tagihan privat tidak disimpan dalam cache persisten.</p></section>
        </div>
      </article>
    </main>
  );
}
