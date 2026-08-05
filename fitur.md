# Fitur Aplikasi LIMO

## 1. Gambaran Umum

LIMO adalah aplikasi manajemen kursus bahasa untuk mengelola proses pendaftaran, data peserta didik, kegiatan belajar mengajar, penilaian, presensi, progres belajar, tagihan, dan komunikasi antara lembaga, Guru, dan Wali.

Aplikasi memiliki tiga role utama:

- **Admin**: mengelola operasional lembaga, data master, pendaftaran, peserta didik, tagihan, laporan, pengguna, dan audit.
- **Guru**: mengelola kelas yang diampu, materi, sesi pembelajaran, presensi, progres, bank soal, ujian, hasil ujian, dan RPP.
- **Wali**: memantau anak yang terhubung, materi, presensi, progres, nilai, tugas/ujian online, tagihan, notifikasi, dan RPP.
- **Siswa**: login ke portal sendiri untuk melihat kelas aktif, jadwal, materi, nilai, progres, presensi, dan evaluasi yang tersedia.

Pengunjung yang belum login dapat mengakses landing page, informasi program, pendaftaran online, pengecekan status pendaftaran, kebijakan privasi, dan syarat penggunaan.

Portal Siswa menjadi pelaku aktivitas belajar pada fase pengembangan berikutnya. Pada implementasi fase saat ini, Siswa sudah memiliki akses baca dan dashboard sendiri; submission tugas dan pengerjaan ujian sebagai actor Siswa belum diaktifkan.

## 2. Landing Page dan Informasi Publik

### Deskripsi

Landing page menjadi halaman awal untuk memperkenalkan LIMO kepada calon peserta dan Wali. Halaman ini memuat informasi program serta akses menuju pendaftaran.

### Fitur yang tersedia

- Informasi program Bahasa Inggris dan Bahasa Arab.
- Hero section dan ajakan pendaftaran.
- Informasi layanan dan keunggulan program.
- Testimonial atau informasi pendukung profil lembaga.
- Informasi kontak LIMO.
- Link ke halaman pendaftaran online.
- Halaman kebijakan privasi.
- Halaman syarat penggunaan.
- Metadata SEO, Open Graph, sitemap, robots, manifest PWA, dan icon aplikasi.

### Halaman akses

- `/`
- `/kebijakan-privasi`
- `/syarat-penggunaan`
- `/sitemap.xml`
- `/robots.txt`

## 3. Pendaftaran Online

### Deskripsi

Calon peserta dapat mengajukan pendaftaran secara online tanpa harus login. Data pendaftaran disimpan sebagai pengajuan yang dapat diperiksa dan diproses oleh Admin.

### Fitur calon peserta atau Wali

- Mengisi formulir pendaftaran program.
- Memilih jenis program Bahasa Inggris atau Bahasa Arab.
- Mengisi data siswa:
  - Nama siswa.
  - Tanggal lahir.
- Mengisi data Wali:
  - Nama Wali.
  - Email Wali.
  - Nomor telepon Wali.
- Mengunggah dokumen pendukung.
- Mendapatkan kode pendaftaran.
- Mengecek status pendaftaran menggunakan kode pendaftaran dan email Wali.
- Melihat status `SUBMITTED`, `APPROVED`, atau `REJECTED`.
- Melihat alasan penolakan jika pendaftaran ditolak.

### Validasi dokumen

- Format yang diperbolehkan: PDF, JPG, dan PNG.
- Ekstensi harus sesuai dengan MIME type file.
- Isi file diperiksa menggunakan magic bytes.
- Ukuran file dibatasi sesuai konfigurasi aplikasi.
- File disimpan pada private storage, bukan pada folder publik.

### Fitur Admin pada pendaftaran

- Melihat daftar pendaftaran.
- Mencari dan memfilter pendaftaran.
- Melihat detail lengkap pendaftaran.
- Mengunduh dokumen secara authorized.
- Menyetujui pendaftaran.
- Menolak pendaftaran dengan alasan.
- Proses approval bersifat idempoten sehingga tidak membuat data siswa ganda ketika dijalankan ulang.
- Membuat atau menghubungkan data siswa dan Wali setelah pendaftaran disetujui.
- Mengirim notifikasi aktivasi akun kepada Wali.

### Halaman akses

- `/daftar`
- `/status-pendaftaran`
- `/admin/pendaftaran`
- `/admin/pendaftaran/[id]`

## 4. Login, Akun, dan Akses Role

### Deskripsi

Sistem login menggunakan role-based access control. Menu yang tampil bukan satu-satunya pengaman; service dan policy server tetap memeriksa role dan kepemilikan data pada setiap request.

### Fitur autentikasi

- Login menggunakan email dan password.
- Logout.
- Pemeriksaan sesi aktif.
- Perubahan password.
- Lupa password.
- Reset password menggunakan token.
- Penggantian sesi setelah password berubah.
- Pencabutan sesi pengguna oleh Admin.
- Redirect pengguna ke dashboard sesuai role.
- Penolakan akses ke halaman role lain.

### Pengamanan sesi

- Password disimpan menggunakan Argon2id.
- Session disimpan di database.
- Cookie session menggunakan `HttpOnly` dan `SameSite`.
- Terdapat batas waktu absolut dan idle timeout.
- Sesi kedaluwarsa otomatis ditolak.
- Sesi lama dapat dicabut setelah perubahan password atau tindakan Admin.

### Halaman akses

- `/login`
- `/lupa-password`
- `/reset-password`
- `/ubah-password`

### Portal Siswa Fase 1

- Admin dapat membuat satu akun untuk satu data Siswa.
- Identifier login dapat berupa email atau nomor induk.
- Akun Siswa diaktifkan melalui token reset password yang memiliki masa berlaku.
- Admin dapat mengirim ulang link aktivasi.
- Admin dapat mengaktifkan atau menonaktifkan akun Siswa.
- Penonaktifan akun mencabut session aktif.
- Siswa hanya dapat melihat profil, kelas, materi published, jadwal, presensi, progres, nilai, dan evaluasi yang berkaitan dengan dirinya.
- Dashboard Siswa menampilkan kelas aktif, kegiatan terdekat, materi terbaru, evaluasi, feedback, progres, dan notifikasi.
- Siswa tidak dapat membuka route Admin, Guru, Wali, atau data Siswa lain.

### Halaman Portal Siswa

- `/siswa`
- `/siswa/kelas`
- `/siswa/kelas/[kelasId]`
- `/siswa/profil`

## 5. Dashboard Admin

### Deskripsi

Dashboard Admin berfungsi sebagai command center untuk melihat kondisi operasional lembaga dan menuju modul pengelolaan utama.

### Informasi yang ditampilkan

- Jumlah pendaftaran yang menunggu proses.
- Ringkasan tagihan bulan berjalan.
- Total tagihan belum dibayar.
- Total tagihan yang melewati jatuh tempo.
- Ringkasan tingkat kehadiran.
- Aktivitas materi dan ujian.
- Ringkasan operasional peserta didik.
- Quick action menuju pendaftaran, tagihan, laporan, dan audit.

### Halaman akses

- `/admin`

## 6. Data Master Admin

### Deskripsi

Admin dapat menyiapkan struktur dasar lembaga yang digunakan oleh modul akademik dan billing.

### Program

- Membuat program.
- Melihat daftar program.
- Mengubah data program.
- Mengarsipkan program.
- Menentukan jenis program seperti English atau Arabic.

### Level

- Membuat level belajar.
- Melihat daftar level.
- Mengubah data level.
- Mengarsipkan level.
- Menghubungkan level dengan program.

### Kelas

- Membuat kelas.
- Menghubungkan kelas dengan program dan level.
- Menentukan Guru pengampu.
- Mengubah data kelas.
- Mengarsipkan kelas.
- Melihat jumlah sesi, materi, dan peserta aktif.

### Halaman akses

- `/admin/program`
- `/admin/level`
- `/admin/kelas`

## 7. Pengelolaan Pengguna dan Peserta Didik

### Guru dan Wali

Admin dapat:

- Membuat akun Guru.
- Membuat akun Wali.
- Melihat daftar Guru dan Wali.
- Menyediakan pilihan Guru atau Wali untuk proses pengelolaan data.
- Mengubah status akun aktif atau tidak aktif.
- Mengirim atau mencatat proses aktivasi akun.

### Siswa

Admin dapat:

- Membuat data siswa.
- Melihat daftar siswa.
- Mencari dan memfilter siswa.
- Mengubah data siswa.
- Mengarsipkan siswa.
- Memulihkan siswa yang diarsipkan.
- Menghubungkan siswa dengan Wali.
- Melepas hubungan siswa dengan Wali.
- Memindahkan siswa ke kelas lain.
- Menyimpan riwayat perpindahan kelas.
- Menentukan program, kelas, tanggal mulai, dan status siswa.
- Mengekspor data siswa ke CSV.
- Melihat detail siswa dan histori akademiknya.

### Pengelolaan sesi pengguna

Admin dapat:

- Mengubah status akun pengguna.
- Melihat atau mengelola sesi pengguna melalui tindakan pencabutan sesi.
- Mencegah akun tidak aktif menggunakan sistem.

### Halaman akses

- `/admin/guru`
- `/admin/wali`
- `/admin/siswa`
- `/admin/siswa/[id]`
- `/admin/siswa/[id]/akun`
- `/admin/users`

## 8. Modul Kelas dan Operasional Guru

### Deskripsi

Guru hanya dapat melihat dan mengelola kelas yang ditugaskan kepadanya. Data kelas, siswa, sesi, presensi, progres, materi, dan ujian selalu dibatasi berdasarkan scope kelas tersebut.

### Fitur kelas

- Melihat daftar kelas yang diampu.
- Melihat program dan level kelas.
- Melihat jumlah siswa aktif.
- Melihat jadwal dan sesi kelas.
- Membuka detail kelas.
- Melihat roster siswa aktif.
- Mencari siswa berdasarkan nama atau nomor induk.
- Membuka histori presensi, progres, dan nilai per siswa.
- Melihat ringkasan kelas.

### Fitur sesi pembelajaran

- Membuat sesi kelas.
- Menentukan nomor pertemuan.
- Menentukan topik.
- Menentukan tanggal sesi.
- Menyimpan status sesi sebagai draft atau final.
- Membatalkan sesi bila diperlukan.
- Menggandakan sesi sebagai template draft.
- Memfinalkan sesi setelah presensi dan progres lengkap.
- Mengunci sesi final agar tidak dapat diubah melalui alur biasa.

### Fitur jadwal Guru

- Melihat agenda mengajar.
- Melihat sesi hari ini.
- Melihat kalender jadwal kelas.
- Melihat pekerjaan atau tugas akademik yang masih perlu diselesaikan.

### Halaman akses

- `/guru`
- `/guru/kelas`
- `/guru/kelas/[kelasId]`
- `/guru/kelas/[kelasId]/ringkasan`
- `/guru/jadwal`

## 9. LMS Materi Pembelajaran

### Deskripsi

Modul LMS digunakan Guru untuk membagikan materi pembelajaran kepada kelas dan digunakan Wali untuk memantau materi yang telah dipublikasikan.

### Fitur Guru

- Membuat materi untuk kelas yang diampu.
- Menentukan tipe materi:
  - Teks.
  - PDF.
  - Gambar.
  - Link video.
- Menulis isi materi.
- Menambahkan link video yang tervalidasi.
- Menentukan urutan materi.
- Menambahkan konteks bahasa dan arah materi bila tersedia.
- Mengunggah file PDF, JPG, atau PNG.
- Mengubah status materi menjadi draft, published, atau archived.
- Mengarsipkan materi.
- Mengembalikan materi yang diarsipkan.
- Melihat daftar materi dengan pagination dan scope kelas.

### Fitur Wali

- Melihat materi dari kelas anak yang terhubung.
- Hanya melihat materi yang berstatus `PUBLISHED`.
- Membuka materi teks atau link video.
- Mengunduh file materi melalui private authorized route.

### Pengamanan materi

- Guru tidak dapat mengelola materi kelas Guru lain.
- Wali tidak dapat melihat materi draft atau archived.
- File materi tidak disajikan langsung dari folder publik.

### Halaman akses

- `/guru/materi`
- `/guru/kelas/[kelasId]`
- `/wali/materi`

## 10. Presensi

### Deskripsi

Presensi dikelola per sesi pembelajaran dan per siswa. Data presensi dapat dilihat kembali oleh Guru dan diringkas untuk Wali serta laporan Admin.

### Fitur Guru

- Mengisi presensi siswa dalam satu sesi.
- Menyimpan status kehadiran tiap siswa.
- Menyimpan catatan presensi bila diperlukan.
- Memisahkan proses penyimpanan presensi dari penyimpanan progres.
- Tidak dapat mengubah presensi pada sesi yang sudah final.

### Fitur Wali

- Melihat ringkasan presensi anak.
- Melihat rekap kehadiran bulanan.
- Melihat data sesuai anak yang sedang dipilih atau seluruh anak yang terhubung.

### Fitur Admin

- Melihat agregasi presensi pada laporan periode.
- Menggunakan data presensi untuk ringkasan operasional.

### Halaman akses

- `/guru/presensi`
- `/guru/presensi/[sesiKelasId]`
- `/wali/presensi`
- `/admin/laporan`

## 11. Progres Belajar

### Deskripsi

Guru dapat mencatat perkembangan belajar siswa setelah sesi pembelajaran. Data dapat dibedakan menjadi informasi yang terlihat oleh Wali dan catatan internal Guru.

### Fitur Guru

- Mengisi skor pemahaman 1 sampai 5.
- Menambahkan kategori progres.
- Menulis catatan publik untuk Wali.
- Menulis catatan internal untuk kebutuhan Guru atau lembaga.
- Menyimpan progres tanpa mengubah presensi.
- Melihat progres per sesi dan per siswa.
- Menggunakan progres sebagai bagian dari proses finalisasi sesi.

### Fitur Wali

- Melihat timeline progres anak.
- Melihat skor pemahaman.
- Melihat catatan publik Guru.
- Melihat grafik progres.
- Memilih satu anak atau seluruh anak yang terhubung.

### Fitur Admin dan ringkasan Guru

- Ringkasan kelas menyediakan data yang dapat digunakan untuk grafik.
- Laporan Admin dapat mengagregasikan progres berdasarkan periode.

### Halaman akses

- `/guru/progres`
- `/guru/progres/[sesiKelasId]`
- `/wali/progres`
- `/wali/progres/[siswaId]`
- `/guru/kelas/[kelasId]/ringkasan`

## 12. Grafik dan Laporan Akademik

### Deskripsi

Data presensi, progres, dan nilai disajikan dalam bentuk ringkasan agar perkembangan siswa dapat dipantau secara berkala.

### Fitur Wali

- Grafik atau ringkasan kehadiran.
- Grafik atau ringkasan skor progres.
- Ringkasan nilai ujian.
- Histori perkembangan anak.

### Fitur Guru

- Ringkasan kelas.
- Baris data presensi dan progres yang siap digunakan untuk visualisasi.
- Ringkasan siswa dalam scope kelas yang diampu.

### Fitur Admin

- Memilih periode laporan.
- Melihat ringkasan kelas dan siswa.
- Melihat data presensi, progres, dan nilai.
- Mengekspor laporan ke CSV.
- Memastikan CSV memiliki kolom periode dan siswa.

### Halaman akses

- `/wali/progres`
- `/guru/kelas/[kelasId]/ringkasan`
- `/admin/laporan`

## 13. Bank Soal

### Deskripsi

Bank soal menyimpan pertanyaan yang dapat digunakan kembali ketika Guru membuat ujian. Soal dapat berupa soal objektif maupun soal yang membutuhkan penilaian manual.

### Tipe soal yang didukung

- Pilihan ganda.
- Multi-select.
- Benar atau salah.
- Isian singkat.
- Cloze atau fill in the blank.
- Menjodohkan.
- Urutan.
- Gambar.
- Listening.
- Reading.
- Speaking.
- Writing.
- Roleplay.
- Esai.

### Metadata soal

- Level kognitif: LOTS, MOTS, atau HOTS.
- Skill: listening, reading, speaking, writing, vocabulary, grammar, pronunciation, numeracy, atau literacy.
- Tingkat kesulitan: mudah, sedang, atau sulit.
- Standard seperti CEFR, AKM Literasi, atau standard internal.
- Jenis assessment: formative, summative, placement, atau diagnostic.
- Stimulus text.
- Media URL.
- Expected answer.
- Rubrik dan skor maksimal untuk penilaian performa.

### Fitur Guru

- Membuat soal.
- Menentukan opsi dan kunci jawaban.
- Menentukan metadata pedagogis.
- Melihat daftar soal.
- Memakai soal untuk beberapa ujian.
- Menggunakan filter dan pagination.

### Halaman akses

- `/guru/bank-soal`

## 14. Ujian dan Penilaian

### Deskripsi

Modul ujian menyediakan pembuatan ujian, pelaksanaan ujian online oleh Wali, input hasil offline oleh Guru, penilaian otomatis, penilaian manual, dan histori hasil.

### Pembuatan ujian oleh Guru

- Membuat ujian untuk kelas yang diampu.
- Memilih soal dari bank soal.
- Menentukan judul ujian.
- Menentukan tanggal ujian.
- Menentukan durasi ujian.
- Menentukan mode delivery online melalui Wali atau input offline oleh Guru.
- Mengatur status draft, published, atau archived.
- Mempublikasikan ujian.
- Mengarsipkan ujian.
- Mengembalikan ujian menjadi draft.
- Menggandakan ujian sebagai template draft.
- Melihat daftar siswa dan histori hasil ujian.

### Pelaksanaan online oleh Wali

- Wali membuka tugas atau ujian yang tersedia untuk anaknya.
- Jawaban dapat disimpan sebagai draft melalui autosave.
- Jawaban tetap tersedia setelah halaman dimuat ulang.
- Attempt dapat dilanjutkan selama masih valid.
- Sistem menampilkan peringatan ketika koneksi bermasalah.
- Draft ujian tidak langsung dianggap sebagai nilai final.
- Ujian dapat disubmit setelah jawaban selesai.
- Attempt yang sudah expired menolak perubahan lanjutan.

### Penilaian

- Soal objektif dapat dinilai otomatis jika kunci tersedia.
- Soal esai dan performa dapat masuk status `NEEDS_REVIEW`.
- Guru dapat mengisi skor manual.
- Nilai akhir ditampilkan pada skala 0 sampai 100.
- Hasil `FINAL` tidak dapat ditimpa melalui alur input biasa.
- Guru dapat melakukan koreksi hasil final dengan alasan.
- Hasil koreksi menjadi `CORRECTED`.
- Perubahan koreksi menyimpan audit before dan after.
- Wali dapat melihat histori nilai final yang tersedia.

### Notifikasi ujian

- Wali dapat menerima notifikasi ketika ujian dipublikasikan.
- Wali dapat menerima notifikasi ketika hasil ujian tersedia atau diperbarui.

### Halaman akses

- `/guru/ujian`
- `/guru/ujian/[ujianId]/hasil`
- `/guru/ujian/[ujianId]/hasil/[hasilId]/koreksi`
- `/wali/tugas`
- `/wali/tugas/[siswaId]`
- `/wali/tugas/[siswaId]/ujian/[ujianId]`
- `/wali/tugas/attempt/[attemptId]`
- `/wali/nilai`

## 15. RPP atau Rencana Pelaksanaan Pembelajaran

### Deskripsi

Modul RPP memungkinkan Guru membuat rancangan pembelajaran secara langsung melalui form atau membagikan dokumen RPP yang sudah dibuat dalam format Word/PDF.

### Mode RPP

#### Isi rancangan langsung

Guru dapat mengisi:

- Kelas.
- Judul RPP.
- Tanggal rencana pembelajaran.
- Nomor pertemuan.
- Topik.
- Tujuan pembelajaran.
- Materi dan media.
- Tingkat kesulitan.
- Langkah kegiatan pembelajaran.
- Asesmen.
- Durasi pembelajaran.
- Catatan tambahan.

#### Upload dokumen

Guru dapat mengunggah dokumen RPP dalam format:

- PDF.
- DOC.
- DOCX.

Untuk mode upload, Guru mengisi metadata RPP dan dokumen menjadi sumber isi utama. Sistem memeriksa ukuran, ekstensi, MIME type, serta magic bytes file Word/PDF.

### Status RPP

- `DRAFT`: hanya dapat dilihat Guru.
- `PUBLISHED`: dapat dilihat Wali yang memiliki anak aktif di kelas terkait.
- `ARCHIVED`: tidak lagi ditampilkan kepada Wali, tetapi dapat dikembalikan menjadi draft.

### Fitur akses Wali

- Melihat RPP published dari kelas anak.
- Melihat isi RPP form secara langsung.
- Mengunduh dokumen RPP Word/PDF melalui route private.
- Tidak dapat melihat RPP draft atau archived.
- Tidak dapat melihat RPP dari kelas yang tidak memiliki enrollment aktif untuk anaknya.

### Notifikasi dan audit

- Guru dapat menerima status perubahan RPP melalui UI.
- Wali dapat menerima notifikasi ketika RPP dipublikasikan.
- Pembuatan dan perubahan status RPP dicatat dalam audit log.

### Halaman akses

- `/guru/rpp`
- `/wali/rpp`

## 16. Tagihan dan Payment Gateway Mayar

### Deskripsi

Modul billing mengelola tarif, pembuatan tagihan bulanan, pembayaran melalui Mayar V2, webhook pembayaran, histori pembayaran, dan rekonsiliasi. Status pada database LIMO menjadi sumber kebenaran lokal.

### Fitur Admin

- Membuat dan mengelola tarif.
- Membuat tagihan bulanan.
- Menjalankan generate tagihan dalam mode dry-run.
- Mencegah pembuatan tagihan ganda pada periode dan siswa yang sama.
- Melihat tagihan berdasarkan periode, siswa, status, dan pencarian.
- Melihat tagihan overdue.
- Melihat histori pembayaran.
- Melakukan rekonsiliasi pembayaran dengan alasan.
- Menjalankan rekonsiliasi terhadap invoice Mayar.
- Menerima ringkasan billing pada dashboard.

### Fitur Wali

- Melihat tagihan untuk anak yang terhubung.
- Melihat status tagihan.
- Melihat detail nominal dan jatuh tempo.
- Memilih metode pembayaran.
- Membuka hosted checkout Mayar.
- Melihat status pembayaran pada halaman tagihan.
- Membuka halaman sukses setelah pembayaran terkonfirmasi lokal.

### Metode pembayaran Mayar

- QRIS.
- Virtual Account BNI.
- Virtual Account BRI.
- Virtual Account Mandiri.
- Virtual Account CIMB.
- Virtual Account Permata.
- Virtual Account BJB.
- Virtual Account BSI.
- DANA.
- GoPay.
- Alfamart.

Ketersediaan channel tetap mengikuti konfigurasi merchant pada dashboard Mayar.

### Webhook dan rekonsiliasi

- Mayar mengirim event pembayaran ke endpoint webhook LIMO.
- Webhook memvalidasi secret.
- Merchant ID dan nominal pembayaran divalidasi.
- Invoice dan transaction ID Mayar disimpan.
- Webhook duplicate diproses secara idempoten.
- Redirect browser tidak langsung mengubah status invoice menjadi paid.
- Status lokal diperbarui setelah webhook atau rekonsiliasi berhasil.
- Panel Wali memeriksa status lokal secara berkala.

### Halaman akses

- `/admin/tagihan`
- `/wali/tagihan`
- `/wali/tagihan/success`
- `/api/v1/webhooks/mayar`

## 17. Notifikasi

### Deskripsi

Sistem notifikasi menyimpan event notifikasi di aplikasi dan dapat meneruskannya ke provider eksternal.

### Event notifikasi yang diterapkan

- Pendaftaran disetujui.
- Pendaftaran ditolak.
- Aktivasi akun Wali.
- Materi atau ujian dipublikasikan.
- Hasil ujian tersedia atau diperbarui.
- Progres siswa tersimpan.
- Invoice baru dibuat.
- Pembayaran berhasil.
- RPP dipublikasikan.
- Pekerjaan Guru yang perlu ditindaklanjuti.

### Kanal notifikasi

- Notifikasi in-app.
- Email melalui SMTP.
- Email melalui webhook n8n.
- WhatsApp melalui webhook n8n dan workflow GOWA eksternal.

### Pengelolaan notifikasi

- Notifikasi memiliki status delivery.
- Pengiriman gagal dapat dicoba ulang.
- Jumlah attempt dapat dibatasi.
- Wali dapat menandai notifikasi sebagai sudah dibaca.
- Wali tidak dapat menandai notifikasi milik pengguna lain.
- Notifikasi pembayaran dan akademik menyimpan metadata entity terkait.

## 18. Profil Wali dan Pemilihan Anak

### Deskripsi

Satu akun Wali dapat terhubung dengan lebih dari satu anak. Fitur pemilihan anak membatasi seluruh data dashboard sesuai konteks yang dipilih.

### Fitur

- Melihat profil akun Wali.
- Melihat daftar anak yang terhubung.
- Memilih satu anak.
- Memilih `Semua Anak`.
- Memperbarui scope data dashboard setelah anak dipilih.
- Membatasi materi, presensi, progres, nilai, tagihan, tugas, dan RPP sesuai hubungan Wali yang sah.

### Halaman akses

- `/wali`
- `/wali/profil`

## 19. Pusat Bantuan

### Deskripsi

Pusat bantuan membantu Wali memahami alur penggunaan aplikasi dan kanal komunikasi dengan Admin.

### Fitur

- FAQ tentang status tugas.
- FAQ tentang nilai.
- FAQ tentang tagihan.
- Penjelasan alur materi dan progres.
- Informasi kanal kontak Admin.

### Halaman akses

- `/wali/bantuan`

## 20. Audit dan Pelacakan Aktivitas

### Deskripsi

Aktivitas penting dicatat ke audit log untuk membantu pelacakan operasional dan perubahan data.

### Aktivitas yang dicatat

- Login dan aktivitas akun.
- Perubahan password.
- Pencabutan sesi.
- Approval atau rejection pendaftaran.
- Perubahan data master.
- Perubahan data siswa dan hubungan Wali.
- Perpindahan kelas.
- Pembuatan dan perubahan status materi.
- Pembuatan, publish, archive, dan perubahan status RPP.
- Pembuatan dan perubahan ujian.
- Input dan koreksi hasil ujian.
- Submit presensi dan progres.
- Finalisasi sesi.
- Pembuatan tagihan dan perubahan pembayaran.
- Rekonsiliasi pembayaran.

### Fitur Admin

- Melihat audit activity.
- Memfilter audit berdasarkan periode atau aktivitas.
- Mengekspor audit log ke CSV.
- Membatasi akses audit hanya untuk Admin.

### Halaman akses

- `/admin/audit`

## 21. Backup dan Restore

### Deskripsi

Fitur backup digunakan untuk menjaga database dan file privat agar dapat dipulihkan pada environment target.

### Artefak backup

- `database.sql`: dump MariaDB.
- `backup.zip`: berisi dump database, private storage, manifest, dan checksum SHA-256.

### Fitur backup

- Backup manual melalui script.
- Backup melalui endpoint internal yang dapat dipanggil n8n.
- Retention backup lokal.
- Penyimpanan backup pada volume persistent.
- Download artefak SQL atau ZIP dengan authorization secret.
- Penggunaan `mariadb-dump` atau `mysqldump` dengan transaction konsisten.

### Fitur restore

- Restore ke database target yang ditentukan.
- Restore ke private storage target.
- Konfirmasi eksplisit sebelum restore.
- Validasi path ZIP untuk mencegah path traversal.
- Validasi manifest dan checksum file.
- Import SQL ke database target.
- Penggantian isi private storage target.

## 22. Job Terjadwal

Job dijalankan melalui cron atau systemd timer, bukan dari lifecycle proses web.

Job yang tersedia:

- Generate tagihan bulanan.
- Menandai tagihan overdue.
- Membersihkan sesi yang kedaluwarsa.
- Mengirim ulang notifikasi yang gagal.
- Rekonsiliasi pembayaran Mayar.
- Membuat backup.

Job menggunakan timezone operasional `Asia/Jakarta` dan dapat dijalankan manual dengan mode dry-run bila tersedia.

## 23. Keamanan dan Perlindungan Data

### Kontrol akses

- RBAC Admin, Guru, dan Wali.
- Admin dapat mengakses data operasional secara luas.
- Guru hanya dapat mengakses kelas yang diampu.
- Wali hanya dapat mengakses anak yang terhubung.
- Akses invoice dibatasi berdasarkan hubungan Wali dan siswa.
- Akses file dibatasi berdasarkan owner, kelas, status publikasi, dan hubungan siswa.

### Perlindungan request

- Mutation request memerlukan origin yang sah.
- `localhost` dan `127.0.0.1` diperlakukan sebagai alias loopback hanya pada development.
- Origin production tetap strict.
- Rate limit diterapkan pada endpoint tertentu.
- Request memiliki request ID untuk pelacakan error dan log.
- API menggunakan format error yang konsisten.

### Perlindungan file

- File privat tidak disimpan di folder `public`.
- Nama file dibersihkan dari karakter path berbahaya.
- Ekstensi dan MIME type divalidasi.
- Magic bytes diperiksa untuk tipe file yang didukung.
- File diakses melalui route authorized.
- Path storage diperiksa agar tidak keluar dari private storage root.
- RPP Word/PDF memiliki validasi tipe dan batas ukuran tersendiri.

### Health check

- Liveness endpoint untuk memastikan aplikasi berjalan.
- Readiness endpoint untuk memeriksa environment, database, dan private storage.
- Readiness mengembalikan status gagal jika dependency wajib tidak siap.

### Endpoint health

- `/api/health`
- `/api/health/ready`

## 24. Antarmuka dan Responsivitas

- Dashboard menggunakan pola TailAdmin.
- Sidebar dan navigasi role-based.
- Breadcrumb dan command search.
- Profile dropdown.
- Dropdown notifikasi.
- Layout responsif untuk desktop dan mobile.
- Form dan tabel memiliki state loading, error, empty, dan success.
- Halaman utama dan dashboard mendukung metadata PWA.
- Alur utama diuji pada viewport desktop dan mobile melalui Playwright.

## 25. Status Implementasi dan Catatan Operasional

Fitur-fitur pada dokumen ini sudah tersedia pada source code, API, dan halaman aplikasi. Verifikasi lokal yang sudah dijalankan meliputi unit test, integration test Week 1 sampai Week 3, E2E Playwright, typecheck, lint, dan production build.

Beberapa aktivitas deployment masih membutuhkan environment eksternal:

- Migration production perlu dijalankan pada MariaDB staging atau production.
- Credential dan channel pembayaran Mayar perlu dikonfigurasi pada merchant nyata.
- UAT webhook dan rekonsiliasi Mayar perlu dijalankan end-to-end.
- Provider SMTP atau n8n perlu dikonfigurasi untuk delivery eksternal.
- Backup dan restore perlu diuji pada MariaDB serta storage staging.
- Rate limit multi-instance membutuhkan Redis atau rate limit pada reverse proxy.

Dokumen pendukung:

- `docs/CLIENT_SCOPE_COVERAGE.md`
- `docs/ROLE_ACCESS_MATRIX.md`
- `docs/MAYAR_N8N_INTEGRATION.md`
- `docs/BACKUP_RESTORE.md`
- `docs/UAT_SCRIPT.md`
- `docs/KNOWN_LIMITATIONS.md`
