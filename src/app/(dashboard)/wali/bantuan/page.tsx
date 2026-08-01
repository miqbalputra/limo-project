import { requireActor, requireRole } from "@/server/auth/session";
import { DashboardHero, SectionHeader } from "@/components/dashboard/dashboard-widgets";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";

export const metadata = { title: "Bantuan Wali" };

const faqGroups = [
  {
    title: "Tugas dan Ujian",
    items: [
      ["Bagaimana cara membuka tugas anak?", "Buka menu Tugas Anak, pilih anak dari selector global atau kartu anak, lalu pilih Buka Instruksi. Baca instruksi sebelum menekan Mulai Kerjakan."],
      ["Apa arti status tugas?", "Belum Dikerjakan berarti attempt belum dimulai. Sedang Dikerjakan berarti attempt masih aktif. Menunggu Review berarti ada jawaban yang perlu diperiksa guru. Selesai berarti nilai final sudah tersedia."],
      ["Apakah jawaban tersimpan jika browser tertutup?", "Jawaban disimpan sebagai draft secara berkala. Saat membuka kembali attempt yang masih aktif, jawaban terakhir akan dimuat kembali."],
      ["Apa yang terjadi jika koneksi terputus?", "LIMO menampilkan peringatan dan menahan submit. Draft akan dicoba disimpan kembali setelah koneksi pulih. Waktu ujian tetap mengikuti batas yang ditetapkan server."],
    ],
  },
  {
    title: "Progres, Materi, dan Nilai",
    items: [
      ["Mengapa nilai belum muncul?", "Nilai baru tampil sebagai nilai final setelah guru menyelesaikan input atau review. Jawaban yang masih menunggu review belum dianggap nilai final."],
      ["Bagaimana membaca progres anak?", "Gunakan menu Progres untuk melihat rata-rata pemahaman, catatan guru, grafik, dan timeline. Pilih anak tertentu jika ingin fokus pada satu anak."],
      ["Di mana materi pembelajaran berada?", "Materi yang sudah dipublikasikan guru tersedia di menu Materi. Materi mengikuti anak yang dipilih pada selector global."],
    ],
  },
  {
    title: "Tagihan dan Data Akun",
    items: [
      ["Bagaimana melihat tagihan?", "Buka menu Tagihan untuk melihat nominal, periode, jatuh tempo, status pembayaran, dan instruksi pembayaran yang tersedia."],
      ["Bagaimana memperbaiki data wali atau relasi anak?", "Hubungi Admin LIMO melalui email kontak resmi. Perubahan data wali dan relasi anak dilakukan oleh Admin untuk menjaga keamanan data."],
      ["Bagaimana mengganti password?", "Buka menu Ubah Password dari menu akun, masukkan password saat ini, lalu buat password baru minimal sesuai aturan yang ditampilkan."],
    ],
  },
];

export default async function WaliBantuanPage() {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const contactEmail = process.env.NEXT_PUBLIC_LIMO_CONTACT_EMAIL;

  return (
    <main className="space-y-8">
      <DashboardHero
        eyebrow="Pusat Bantuan"
        title="Bantuan untuk Wali"
        description="Jawaban singkat untuk alur tugas, materi, progres, nilai, tagihan, dan keamanan data akun."
        aside={<div className="grid size-20 place-items-center rounded-3xl bg-brand-50 text-brand-600 shadow-theme-xs"><DashboardIcon name="help" className="size-10" /></div>}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-8">
          {faqGroups.map((group) => <section key={group.title}><SectionHeader title={group.title} description="Pilih pertanyaan untuk melihat jawabannya." /><div className="mt-4 space-y-3">{group.items.map(([question, answer]) => <details key={question} className="group tailadmin-card overflow-hidden"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-theme-sm font-semibold text-gray-900 marker:hidden"><span>{question}</span><span className="grid size-7 shrink-0 place-items-center rounded-full bg-gray-50 text-lg text-gray-500 transition group-open:rotate-45">+</span></summary><p className="border-t border-gray-100 px-5 pb-5 pt-4 text-theme-sm leading-6 text-gray-600">{answer}</p></details>)}</div></section>)}
        </div>

        <aside className="h-fit rounded-3xl bg-gray-900 p-5 text-white shadow-theme-lg lg:sticky lg:top-28">
          <span className="grid size-11 place-items-center rounded-2xl bg-white/10 text-brand-200"><DashboardIcon name="help" className="size-6" /></span>
          <h2 className="mt-5 text-lg font-semibold">Masih butuh bantuan?</h2>
          <p className="mt-2 text-theme-sm leading-6 text-white/70">Sampaikan nama wali, nama anak, dan detail kendala agar Admin dapat memeriksa data dengan tepat.</p>
          {contactEmail ? <a href={`mailto:${contactEmail}`} className="mt-5 block break-all rounded-xl bg-white px-4 py-3 text-center text-theme-sm font-semibold text-gray-900 hover:bg-brand-50">{contactEmail}</a> : <p className="mt-5 rounded-xl bg-white/10 p-3 text-theme-xs text-white/70">Kanal kontak sedang dikonfigurasi.</p>}
        </aside>
      </div>
    </main>
  );
}
