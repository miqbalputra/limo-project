import Link from "next/link";

export const metadata = { title: "Syarat Penggunaan", alternates: { canonical: "/syarat-penggunaan" } };

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-5 py-12 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs sm:p-10">
        <Link href="/" className="text-theme-sm font-semibold text-brand-500">Kembali ke beranda</Link>
        <h1 className="mt-5 text-3xl font-semibold text-gray-900">Syarat Penggunaan</h1>
        <p className="mt-2 text-theme-sm text-gray-500">Terakhir diperbarui: 22 Juli 2026</p>
        <div className="mt-8 space-y-6 text-theme-sm leading-7 text-gray-700">
          <section><h2 className="font-semibold text-gray-900">Penggunaan layanan</h2><p className="mt-2">Pengguna wajib memberikan informasi yang benar dan menggunakan akun hanya untuk kepentingan layanan kursus LIMO.</p></section>
          <section><h2 className="font-semibold text-gray-900">Keamanan akun</h2><p className="mt-2">Kredensial akun bersifat pribadi. Pengguna bertanggung jawab menjaga password dan segera melapor bila menduga akses tidak sah.</p></section>
          <section><h2 className="font-semibold text-gray-900">Materi pembelajaran</h2><p className="mt-2">Materi, soal, dan konten kelas digunakan untuk peserta yang berhak dan tidak boleh didistribusikan ulang tanpa izin LIMO.</p></section>
          <section><h2 className="font-semibold text-gray-900">Pendaftaran dan pembayaran</h2><p className="mt-2">Pendaftaran akan ditinjau oleh Admin. Jadwal, tarif, jatuh tempo, serta kebijakan pengembalian mengikuti informasi resmi yang disampaikan LIMO.</p></section>
          <section><h2 className="font-semibold text-gray-900">Perubahan layanan</h2><p className="mt-2">LIMO dapat memperbarui fitur dan ketentuan untuk keamanan atau kebutuhan operasional. Perubahan penting akan disampaikan melalui kanal resmi.</p></section>
        </div>
      </article>
    </main>
  );
}
