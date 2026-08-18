# Panduan Pengguna Aplikasi LIMO

Panduan ini menjelaskan fitur, hak akses, dan alur penggunaan aplikasi LIMO untuk Admin, Guru, Wali, dan Siswa.

## 1. Gambaran Umum

LIMO adalah sistem informasi kursus bahasa yang membantu lembaga mengelola:

- Pendaftaran calon peserta secara online.
- Data program, level, kelas, Guru, Wali, dan Siswa.
- Kegiatan belajar mengajar, materi, RPP, presensi, dan progres.
- Bank soal, ujian, penilaian, tugas, dan gradebook.
- Kalender akademik, agenda, dan pekerjaan yang perlu ditindaklanjuti.
- Tagihan, pembayaran melalui Mayar, dan rekonsiliasi pembayaran.
- Notifikasi, audit aktivitas, file privat, dan backup.

Alamat aplikasi demo:

```text
https://limo.sistemflow.com
```

## Cara Membaca Panduan

Pengguna tidak perlu membaca seluruh dokumen sekaligus. Gunakan bagian sesuai kebutuhan:

- Client/demo reviewer: baca bagian 2, 3, 5, 7, 22, dan 23.
- Admin: baca bagian 4, 6, 7, dan 8.
- Guru: baca bagian 4, 9, 13, dan 14.
- Wali: baca bagian 4 dan 10.
- Siswa: baca bagian 4 dan 11.
- Administrator teknis: baca bagian 12, 16, 17, 18, 20, dan 23.

### Daftar Isi

- [1. Gambaran Umum](#1-gambaran-umum)
- [2. Role Pengguna](#2-role-pengguna)
- [3. Akun Demo](#3-akun-demo)
- [4. Login dan Akun](#4-login-dan-akun)
- [5. Akses Publik Tanpa Login](#5-akses-publik-tanpa-login)
- [6. Alur Pendaftaran Online](#6-alur-pendaftaran-online)
- [7. Alur Utama yang Disarankan untuk Demo](#7-alur-utama-yang-disarankan-untuk-demo)
- [8. Panduan Admin](#8-panduan-admin)
- [9. Panduan Guru](#9-panduan-guru)
- [10. Panduan Wali](#10-panduan-wali)
- [11. Panduan Siswa](#11-panduan-siswa)
- [12. Modul LMS Tambahan](#12-modul-lms-tambahan)
- [13. Alur Modul Assignment](#13-alur-modul-assignment)
- [14. Alur Gradebook](#14-alur-gradebook)
- [15. Alur Kalender dan To-do](#15-alur-kalender-dan-to-do)
- [16. Notifikasi](#16-notifikasi)
- [17. File dan Private Storage](#17-file-dan-private-storage)
- [18. Backup dan Restore](#18-backup-dan-restore)
- [19. Pengamanan dan Batas Akses](#19-pengamanan-dan-batas-akses)
- [20. Health Check](#20-health-check)
- [21. Troubleshooting Umum](#21-troubleshooting-umum)
- [22. Checklist Demo Client](#22-checklist-demo-client)
- [23. Checklist Sebelum Production Nyata](#23-checklist-sebelum-production-nyata)
- [24. Ringkasan Alur Per Role](#24-ringkasan-alur-per-role)

### Kamus Istilah Singkat

| Istilah | Arti sederhana |
|---|---|
| Draft | Data masih disiapkan dan belum ditampilkan sebagai data final |
| Published | Data sudah dipublikasikan kepada pengguna yang berhak |
| Archived | Data disimpan tetapi tidak tampil pada daftar aktif |
| Feature flag | Pengaturan teknis untuk menyalakan atau menyembunyikan fitur |
| Scope akses | Batas data yang boleh dilihat oleh pengguna |
| Webhook | Pesan otomatis dari layanan eksternal ke aplikasi |
| Dry-run | Simulasi proses tanpa menyimpan perubahan utama |
| Private storage | Penyimpanan file internal yang tidak dibuka sebagai folder publik |
| UAT | User Acceptance Test, yaitu pengujian dan persetujuan dari perwakilan client |

## 2. Role Pengguna

| Role | Fokus penggunaan | Batas akses |
|---|---|---|
| Admin | Operasional lembaga, data master, billing, laporan, dan audit | Dapat melihat dan mengelola seluruh data operasional |
| Guru | Kelas yang diampu, sesi, materi, presensi, progres, ujian, dan penilaian | Hanya dapat mengelola kelas yang ditugaskan |
| Wali | Memantau anak, materi, progres, nilai, presensi, tugas, dan tagihan | Hanya dapat melihat anak yang terhubung |
| Siswa | Melihat kelas, materi, jadwal, progres, evaluasi, dan tugas | Hanya dapat mengakses data dan aktivitas miliknya sendiri |

Menu yang terlihat dapat berbeda karena feature flag. Tidak munculnya sebuah menu biasanya berarti fitur tersebut belum diaktifkan untuk environment demo.

## 3. Akun Demo

Password akun seed demo adalah:

```text
password-dev-only
```

| Role | Email atau identifier | Password |
|---|---|---|
| Admin | `admin@limo.local` | `password-dev-only` |
| Guru | `guru@limo.local` | `password-dev-only` |
| Guru Bahasa Arab | `guru.arab@limo.local` | `password-dev-only` |
| Wali | `wali@limo.local` | `password-dev-only` |
| Wali demo | `wali.demo@limo.local` | `password-dev-only` |
| Siswa | `siswa@limo.local` atau `LIMO-DEV-001` | `password-dev-only` |

Catatan keamanan:

- Akun dan password di atas hanya untuk demo.
- Jangan memakai akun seed untuk production nyata.
- Ganti password setelah login pertama.
- Akun `wali.inactive@limo.local` adalah contoh akun nonaktif dan tidak dapat digunakan untuk login.

## 4. Login dan Akun

### Login

1. Buka halaman `/login` atau pilih tombol login dari landing page.
2. Masukkan email atau identifier yang sesuai role.
3. Masukkan password.
4. Setelah berhasil, sistem mengarahkan pengguna ke dashboard role masing-masing.

### Logout

1. Buka menu profil di bagian navigasi.
2. Pilih **Keluar** atau **Logout**.

### Ubah password

1. Buka menu **Ubah Password**.
2. Masukkan password lama.
3. Masukkan password baru.
4. Simpan perubahan.
5. Login ulang jika diminta.

### Lupa password

1. Buka `/lupa-password`.
2. Masukkan email akun.
3. Buka link reset yang dikirim melalui provider notifikasi.
4. Atur password baru pada halaman reset.

Pada environment demo dengan `NOTIFICATION_PROVIDER=console`, email tidak dikirim ke inbox. Untuk penggunaan nyata, gunakan SMTP atau n8n.

## 5. Akses Publik Tanpa Login

Pengunjung atau calon peserta dapat menggunakan fitur berikut tanpa membuat akun:

- Landing page dan informasi program.
- Pendaftaran online.
- Pengecekan status pendaftaran.
- Kebijakan privasi.
- Syarat penggunaan.

Halaman publik utama:

```text
/
/daftar
/status-pendaftaran
/kebijakan-privasi
/syarat-penggunaan
```

## 6. Alur Pendaftaran Online

### 6.1 Pengajuan oleh calon peserta atau Wali

1. Buka halaman **Daftar**.
2. Pilih program Bahasa Inggris atau Bahasa Arab.
3. Isi data calon Siswa, yaitu nama Siswa dan tanggal lahir.
4. Isi data Wali, yaitu nama, email, dan nomor telepon.
5. Unggah dokumen pendukung bila diperlukan.
6. Periksa kembali data.
7. Kirim formulir.
8. Simpan kode pendaftaran yang ditampilkan sistem.

### 6.2 Aturan file pendaftaran

- Format utama: PDF, JPG, dan PNG.
- Ekstensi harus sesuai dengan tipe file.
- Isi file diperiksa, bukan hanya nama ekstensi.
- Ukuran file mengikuti batas konfigurasi aplikasi.
- File disimpan pada private storage dan tidak tersedia sebagai file publik biasa.

### 6.3 Cek status pendaftaran

1. Buka **Cek Status Pendaftaran**.
2. Masukkan kode pendaftaran.
3. Masukkan email Wali yang digunakan saat mendaftar.
4. Lihat status dan informasi terbaru.

Status yang umum digunakan:

| Status | Arti |
|---|---|
| `DRAFT` | Data masih berupa draft |
| `SUBMITTED` | Pendaftaran sudah dikirim |
| `UNDER_REVIEW` | Sedang diperiksa Admin |
| `APPROVED` | Pendaftaran disetujui |
| `REJECTED` | Pendaftaran ditolak dan dapat memiliki alasan |
| `CANCELLED` | Pendaftaran dibatalkan |

## 7. Alur Utama yang Disarankan untuk Demo

Urutan setup yang paling mudah untuk Admin:

1. Buat **Program**.
2. Buat **Level** di dalam Program.
3. Buat akun **Guru** dan **Wali**.
4. Buat data **Kelas** dan pilih Guru pengampu.
5. Buat data **Siswa**.
6. Hubungkan Siswa dengan Wali.
7. Masukkan Siswa ke Kelas.
8. Buat sesi pembelajaran.
9. Buat materi dan RPP.
10. Isi presensi dan progres.
11. Buat bank soal dan ujian.
12. Masukkan hasil ujian.
13. Buat tarif dan tagihan jika ingin mencoba billing.
14. Login sebagai Wali untuk melihat hasil akademik dan tagihan.

## 8. Panduan Admin

### 8.1 Dashboard Admin

Menu: **Admin -> Beranda**

Dashboard menampilkan ringkasan operasional, seperti:

- Pendaftaran yang perlu diproses.
- Ringkasan Siswa dan kelas.
- Tagihan belum dibayar dan overdue.
- Aktivitas presensi, materi, dan ujian.
- Akses cepat ke modul operasional.

### 8.2 Memproses pendaftaran

Menu: **Admin -> Pendaftaran**

1. Buka daftar pendaftaran.
2. Gunakan pencarian atau filter status.
3. Buka detail pendaftaran.
4. Periksa data calon Siswa dan Wali.
5. Unduh dokumen melalui tombol unduh yang memiliki hak akses.
6. Pilih tindakan: setujui pendaftaran, atau tolak pendaftaran dengan alasan.
7. Periksa data Siswa dan Wali yang terbentuk setelah approval.

Approval dirancang idempoten. Menjalankan approval ulang tidak seharusnya membuat data Siswa ganda.

### 8.3 Mengelola Program

Menu: **Admin -> Program**

Program adalah kelompok layanan utama, misalnya:

- Bahasa Inggris.
- Bahasa Arab.

Alur:

1. Pilih **Tambah Program**.
2. Isi nama, jenis program, deskripsi, dan status aktif.
3. Simpan.
4. Edit atau arsipkan program bila diperlukan.

### 8.4 Mengelola Level

Menu: **Admin -> Level**

Level digunakan untuk mengelompokkan tingkatan belajar di dalam program.

1. Pilih **Tambah Level**.
2. Pilih Program.
3. Isi nama level dan urutan.
4. Tambahkan deskripsi bila diperlukan.
5. Simpan.

### 8.5 Membuat akun Guru

Menu: **Admin -> Guru**

1. Isi nama Guru.
2. Isi email Guru.
3. Isi nomor HP dan alamat bila diperlukan.
4. Pilih **Simpan Guru**.

Sistem akan membuat user role `GURU`, profil Guru, dan token aktivasi password. Pada production, link aktivasi dikirim melalui email atau n8n. Pada mode demo console, email tidak dikirim sehingga proses aktivasi perlu ditangani oleh operator.

### 8.6 Membuat akun Wali

Menu: **Admin -> Wali**

1. Isi nama Wali.
2. Isi email Wali.
3. Isi nomor HP dan alamat.
4. Pilih **Simpan Wali**.

Setelah akun Wali dibuat, hubungkan Wali ke Siswa dari halaman data Siswa.

### 8.7 Mengelola data Siswa

Menu: **Admin -> Siswa**

Admin dapat:

- Membuat data Siswa.
- Mencari dan memfilter Siswa.
- Mengubah data Siswa.
- Mengarsipkan atau memulihkan Siswa.
- Menghubungkan atau melepas hubungan Wali.
- Menentukan Program dan Kelas.
- Memindahkan Siswa ke Kelas lain.
- Melihat histori akademik.
- Mengekspor data ke CSV bila tersedia pada halaman.

Alur membuat Siswa:

1. Isi nomor induk.
2. Isi nama dan tanggal lahir.
3. Pilih Program.
4. Pilih Wali bila sudah tersedia.
5. Pilih Kelas bila ingin langsung menempatkan Siswa.
6. Isi tanggal mulai kelas.
7. Simpan.

### 8.8 Membuat dan mengelola Kelas

Menu: **Admin -> Kelas**

1. Isi nama Kelas.
2. Pilih Program.
3. Pilih Level.
4. Pilih Guru pengampu.
5. Isi catatan jadwal bila diperlukan.
6. Simpan.

Admin dapat mengubah Guru pengampu, mengarsipkan Kelas, dan melihat jumlah sesi, materi, serta Siswa aktif.

### 8.9 Mengelola Jadwal dan Sesi

Menu: **Admin -> Jadwal/Sesi**

Admin dapat melihat operasional sesi dan, jika diperlukan, melakukan override administratif. Guru tetap menjadi pemilik kegiatan harian Kelas.

### 8.10 File Manager

Menu: **Admin -> Berkas Materi**

Admin dapat memantau file materi atau dokumen yang tersimpan pada private storage sesuai hak akses. File privat tidak boleh dibagikan melalui URL folder publik.

### 8.11 Tagihan dan Tarif

Menu: **Admin -> Tagihan**

Alur setup billing:

1. Buat Tarif berdasarkan Program atau Kelas.
2. Tentukan nominal dan tanggal berlaku.
3. Jalankan generate tagihan dalam mode **dry-run** terlebih dahulu.
4. Periksa hasil simulasi.
5. Jalankan generate non-dry-run jika hasil sudah benar.
6. Filter tagihan berdasarkan periode, Siswa, status, atau pencarian.

Generate tagihan memiliki perlindungan duplikasi berdasarkan Siswa, periode, dan jenis tagihan.

Status tagihan:

| Status | Arti |
|---|---|
| `DRAFT` | Tagihan masih disiapkan |
| `UNPAID` | Belum dibayar |
| `PENDING` | Pembayaran sedang diproses |
| `PAID` | Pembayaran terkonfirmasi |
| `OVERDUE` | Melewati tanggal jatuh tempo |
| `CANCELLED` | Dibatalkan |
| `REFUNDED` | Dana dikembalikan |

### 8.12 Pembayaran dan rekonsiliasi

Menu: **Admin -> Pembayaran**

Admin dapat:

- Melihat histori pembayaran.
- Memfilter status pembayaran.
- Melakukan rekonsiliasi manual dengan alasan.
- Memeriksa referensi provider dan nominal.
- Menangani pembayaran yang statusnya belum sinkron.

Status pembayaran dari provider tidak boleh diubah hanya karena pengguna kembali dari halaman checkout. Status lokal diperbarui melalui webhook yang valid atau rekonsiliasi.

### 8.13 Laporan

Menu: **Admin -> Laporan**

1. Pilih periode laporan.
2. Periksa ringkasan Kelas dan Siswa.
3. Periksa presensi, progres, dan nilai.
4. Unduh CSV bila diperlukan.

### 8.14 Pengguna dan sesi

Menu: **Admin -> Pengguna**

Admin dapat:

- Mengaktifkan atau menonaktifkan akun.
- Mencabut semua sesi aktif pengguna.
- Mencegah akun nonaktif login.

### 8.15 Audit

Menu: **Admin -> Audit**

Audit mencatat aktivitas penting, antara lain:

- Login dan perubahan password.
- Approval atau rejection pendaftaran.
- Perubahan data master.
- Perubahan data Siswa dan hubungan Wali.
- Perubahan materi, RPP, dan ujian.
- Input presensi dan progres.
- Finalisasi sesi.
- Pembuatan tagihan dan rekonsiliasi pembayaran.

Admin dapat memfilter dan mengekspor audit sesuai fitur yang tersedia.

## 9. Panduan Guru

### 9.1 Dashboard Guru

Menu: **Guru -> Beranda**

Dashboard Guru hanya menampilkan aktivitas Kelas yang ditugaskan kepada Guru tersebut.

### 9.2 Kelas Saya

Menu: **Guru -> Kelas Saya**

1. Pilih Kelas.
2. Buka detail Kelas.
3. Periksa Program, Level, daftar Siswa, dan jumlah Siswa aktif.
4. Gunakan pencarian untuk menemukan Siswa berdasarkan nama atau nomor induk.
5. Buka ringkasan Kelas untuk melihat presensi, progres, dan nilai.

Guru tidak dapat membuka atau mengubah Kelas Guru lain.

### 9.3 Membuat sesi pembelajaran

Menu: **Guru -> Sesi**

1. Pilih Kelas.
2. Buat sesi baru.
3. Isi nomor pertemuan.
4. Isi topik.
5. Tentukan tanggal sesi.
6. Simpan sebagai `DRAFT`.
7. Lengkapi presensi dan progres.
8. Finalisasi sesi jika semua data sudah benar.

Status sesi:

- `DRAFT`: masih dapat dikerjakan.
- `FINAL`: dikunci dari perubahan biasa.
- `CANCELLED`: sesi dibatalkan.

Sesi dapat digandakan untuk membuat template sesi berikutnya.

### 9.4 Presensi

Menu: **Guru -> Presensi**

1. Pilih sesi.
2. Isi status setiap Siswa.
3. Tambahkan catatan jika diperlukan.
4. Simpan presensi.

Status presensi yang tersedia:

- Hadir.
- Izin.
- Sakit.
- Alpa.
- Terlambat.

Presensi dan progres disimpan terpisah. Menyimpan presensi tidak otomatis mengubah progres.

### 9.5 Progres belajar

Menu: **Guru -> Progres**

1. Pilih sesi dan Siswa.
2. Isi skor pemahaman 1 sampai 5.
3. Pilih kategori progres bila digunakan.
4. Isi catatan publik untuk Wali.
5. Isi catatan internal untuk Guru atau lembaga.
6. Simpan progres.

Catatan internal tidak ditampilkan kepada Wali. Setelah sesi difinalkan, presensi dan progres menjadi read-only melalui alur biasa.

### 9.6 Materi pembelajaran

Menu: **Guru -> Materi**

Jenis materi:

- Teks.
- PDF.
- Gambar.
- Link video.

Alur membuat materi:

1. Pilih Kelas dan sesi bila diperlukan.
2. Pilih tipe materi.
3. Isi judul dan konten.
4. Masukkan link video jika tipe materi adalah video.
5. Atur bahasa, arah teks, dan urutan bila diperlukan.
6. Simpan sebagai draft.
7. Publikasikan setelah siap.

Status materi:

- `DRAFT`: hanya untuk pengelolaan internal Guru.
- `PUBLISHED`: dapat dilihat Wali dan Siswa yang berhak.
- `ARCHIVED`: tidak lagi tampil sebagai materi aktif.

File materi yang diunggah menggunakan private storage dan hanya dapat diunduh oleh pengguna yang berhak.

### 9.7 RPP

Menu: **Guru -> RPP**

RPP memiliki dua mode:

1. **Form**: isi langsung tujuan, materi, kegiatan, asesmen, durasi, dan catatan.
2. **File**: unggah dokumen PDF, DOC, atau DOCX beserta metadata RPP.

Status RPP:

- `DRAFT`: hanya Guru.
- `PUBLISHED`: dapat dilihat Wali dari Kelas terkait.
- `ARCHIVED`: tidak tampil pada daftar aktif Wali.

### 9.8 Bank Soal

Menu: **Guru -> Bank Soal**

Guru dapat membuat dan menggunakan ulang soal untuk beberapa ujian.

Tipe soal yang tersedia:

- Pilihan ganda.
- Multi-select.
- Benar atau salah.
- Isian singkat.
- Cloze atau isian rumpang.
- Menjodohkan.
- Urutan.
- Gambar.
- Listening.
- Reading.
- Speaking.
- Writing.
- Roleplay.
- Esai.

Metadata soal dapat berisi level kognitif, skill, tingkat kesulitan, standard, tipe asesmen, stimulus, media, kunci jawaban, rubrik, dan skor maksimal.

### 9.9 Ujian

Menu: **Guru -> Ujian**

Alur membuat ujian:

1. Buat ujian untuk Kelas yang diampu.
2. Isi judul dan deskripsi.
3. Tentukan tanggal, durasi, dan batas percobaan.
4. Pilih soal dari Bank Soal.
5. Pilih mode ujian, yaitu input hasil offline oleh Guru atau online melalui Wali bila fitur tersedia.
6. Simpan sebagai draft.
7. Publikasikan jika siap.

Ujian dapat diduplikasi sebagai draft template dan dapat diarsipkan.

### 9.10 Hasil ujian dan penilaian

Guru dapat:

- Memasukkan hasil ujian offline.
- Memeriksa nilai otomatis untuk soal yang memiliki kunci.
- Menilai soal esai atau performa secara manual.
- Memberi feedback.
- Melihat hasil `NEEDS_REVIEW`.
- Memfinalkan hasil.
- Mengoreksi hasil final dengan alasan.

Hasil koreksi berubah menjadi `CORRECTED` dan perubahan before/after dicatat di audit.

### 9.11 Fitur LMS tambahan

Jika feature flag aktif, Guru dapat menggunakan:

- Modul pembelajaran dan urutan item.
- Assignment dengan draft autosave, attempt, late submission, file, audio, atau video.
- Rubrik dan feedback.
- Gradebook dengan kategori, bobot, drop-lowest, publish, lock, dan correction.
- Kalender Kelas dan pekerjaan yang perlu ditindaklanjuti.
- Activity completion dan progres modul.
- Remedial dan permintaan revisi.

## 10. Panduan Wali

### 10.1 Dashboard Wali

Menu: **Wali -> Beranda**

Dashboard menampilkan ringkasan anak yang terhubung, seperti:

- Presensi.
- Progres.
- Nilai.
- Materi terbaru.
- Tugas atau ujian.
- Tagihan.
- Notifikasi.

### 10.2 Pemilihan anak

Jika satu akun Wali memiliki beberapa anak:

1. Buka selector anak.
2. Pilih satu anak untuk melihat detail.
3. Pilih **Semua Anak** untuk ringkasan gabungan.

Selector ini memengaruhi materi, presensi, progres, nilai, tugas, kalender, dan tagihan yang tampil.

Wali tidak dapat melihat anak yang tidak memiliki hubungan aktif.

### 10.3 Materi

Menu: **Wali -> Materi**

Wali hanya melihat materi berstatus `PUBLISHED` dari Kelas anak yang terhubung.

Wali dapat:

- Membuka materi teks.
- Membuka link video.
- Mengunduh file materi yang berhak diakses.

Materi draft dan archived tidak ditampilkan.

### 10.4 RPP

Menu: **Wali -> RPP**

Wali dapat melihat RPP published dari Kelas anak, baik RPP form maupun dokumen PDF/DOC/DOCX.

### 10.5 Presensi dan progres

Menu:

```text
/wali/presensi
/wali/progres
```

Wali dapat melihat:

- Rekap kehadiran.
- Riwayat pertemuan.
- Skor pemahaman.
- Grafik atau timeline progres.
- Catatan publik Guru.

Catatan internal Guru tidak ditampilkan.

### 10.6 Nilai dan ujian online

Menu: **Wali -> Nilai** dan **Wali -> Tugas Anak** bila fitur aktif.

Untuk ujian online melalui Wali:

1. Pilih anak.
2. Buka ujian yang sudah dipublikasikan.
3. Mulai attempt.
4. Isi jawaban.
5. Draft jawaban disimpan otomatis bila fitur aktif.
6. Lanjutkan kembali jika halaman direload selama attempt masih valid.
7. Submit setelah selesai.

Draft tidak langsung menjadi nilai final. Attempt yang expired tidak dapat diubah lagi.

### 10.7 Tugas anak

Menu: **Wali -> Tugas Anak** bila `ASSIGNMENTS_ENABLED=true`.

Wali dapat memantau tugas, status, jawaban, file, feedback, dan hasil anak sesuai scope akses. Hak pengumpulan tugas mengikuti konfigurasi fitur dan pengguna yang ditetapkan sebagai pelaksana pembelajaran.

### 10.8 Tagihan

Menu: **Wali -> Tagihan**

Wali dapat:

- Melihat tagihan setiap anak.
- Melihat nominal dan jatuh tempo.
- Melihat status tagihan.
- Memilih metode pembayaran.
- Membuka hosted checkout Mayar.
- Melihat status pembayaran lokal setelah webhook atau rekonsiliasi.

### 10.9 Pembayaran

Menu: **Wali -> Pembayaran**

Metode pembayaran mengikuti channel yang aktif pada akun merchant Mayar, misalnya QRIS, Virtual Account, e-wallet, dan outlet.

Status pembayaran dianggap berhasil setelah status lokal diperbarui oleh webhook atau rekonsiliasi. Kembali dari halaman checkout saja tidak otomatis membuat tagihan menjadi lunas.

### 10.10 Profil, bantuan, dan notifikasi

Menu:

- **Wali -> Profil**: mengelola data profil.
- **Wali -> Bantuan**: membaca FAQ tentang tugas, nilai, tagihan, materi, dan progres.
- Dropdown notifikasi: membaca informasi akademik dan billing.

## 11. Panduan Siswa

Portal Siswa aktif jika `STUDENT_PORTAL_ENABLED=true`.

Menu yang tersedia bila aktif:

- **Beranda**: ringkasan kegiatan dan informasi akademik.
- **Kelas Saya**: daftar Kelas aktif dan detail Kelas.
- **Remedial**: remedial yang diberikan bila fitur terkait aktif.
- **Kalender**: agenda akademik bila kalender aktif.
- **Perlu Ditindaklanjuti**: tugas atau kegiatan yang masih perlu dikerjakan.
- **Profil**: data akun Siswa.
- **Ubah Password**: mengganti password.

Di detail Kelas, Siswa dapat melihat fitur yang diaktifkan, seperti:

- Modul pembelajaran.
- Materi published.
- Tugas.
- Gradebook atau nilai.
- Jadwal.
- Progres.

Siswa hanya dapat melihat data yang berkaitan dengan akun dan Kelasnya sendiri. Ketersediaan submit tugas atau pengerjaan ujian mandiri mengikuti versi fitur yang diaktifkan pada environment.

## 12. Modul LMS Tambahan

Modul berikut dapat diaktifkan melalui environment variable:

| Feature flag | Variable | Fungsi |
|---|---|---|
| Portal Siswa | `STUDENT_PORTAL_ENABLED` | Mengaktifkan navigasi dan dashboard Siswa |
| Modul pembelajaran | `LEARNING_MODULES_ENABLED` | Builder modul, item, publish, archive, dan progres modul |
| Assignment | `ASSIGNMENTS_ENABLED` | Tugas, draft, submission, attempt, file, audio, dan video |
| Gradebook | `GRADEBOOK_ENABLED` | Kategori, bobot, nilai, publish, lock, dan correction |
| Kalender | `CALENDAR_ENABLED` | Kalender, event, agenda, dan pekerjaan yang perlu ditindaklanjuti |
| Activity completion | `ACTIVITY_COMPLETION_ENABLED` | Aturan penyelesaian dan progres aktivitas |
| Remedial | `REMEDIAL_ENABLED` | Remedial, score policy, dan revision request |
| Class discussion | `CLASS_DISCUSSION_ENABLED` | Konfigurasi diskusi kelas bila implementasi diaktifkan |
| Periodic reports | `PERIODIC_REPORTS_ENABLED` | Konfigurasi laporan periodik bila implementasi tersedia |
| Guardian assisted submission | `GUARDIAN_ASSISTED_SUBMISSION_ENABLED` | Selalu aktifkan hanya setelah kebijakan dan UAT disetujui |

Pada `NODE_ENV=production`, fitur tambahan default-nya nonaktif. Admin teknis harus mengaktifkan feature flag secara sengaja setelah UAT.

## 13. Alur Modul Assignment

Jika Assignment aktif, alur Guru:

1. Buka Kelas.
2. Buat tugas.
3. Isi instruksi.
4. Pilih tipe submission.
5. Atur tanggal tersedia, deadline, cutoff, jumlah attempt, late submission, dan resubmission.
6. Hubungkan rubrik bila diperlukan.
7. Simpan draft.
8. Publikasikan tugas.
9. Pantau submission.
10. Beri nilai, feedback, atau minta revisi.

Tipe submission yang didukung:

- Teks online.
- File.
- Gambar.
- Audio.
- Video.
- Link eksternal.
- Aktivitas offline.

File submission divalidasi ukuran, MIME, ekstensi, magic bytes, dan private storage.

## 14. Alur Gradebook

Jika Gradebook aktif:

1. Guru membuat kategori nilai.
2. Tentukan bobot setiap kategori.
3. Tambahkan Grade Item dari Assignment, Ujian, presensi, progres, atau input manual.
4. Pastikan total bobot sesuai aturan, umumnya 100%.
5. Isi atau sinkronkan nilai.
6. Periksa status `MISSING`, `SUBMITTED`, `GRADED`, `EXEMPT`, atau `REMEDIAL`.
7. Publikasikan nilai.
8. Kunci nilai setelah disetujui.
9. Gunakan alur correction dengan alasan jika ada perubahan resmi.

Siswa dan Wali melihat gradebook secara read-only sesuai scope akses.

## 15. Alur Kalender dan To-do

Jika Kalender aktif, event dapat berasal dari:

- Jadwal sesi Kelas.
- Rilis modul.
- Deadline tugas.
- Jadwal atau batas ujian.
- Deadline remedial.
- Hari libur.
- Pengumuman.

Kategori pekerjaan yang perlu ditindaklanjuti dapat mencakup:

- Sesi yang belum selesai.
- Tugas yang mendekati deadline.
- Ujian yang perlu ditinjau.
- Nilai atau feedback yang belum lengkap.
- Agenda anak untuk Wali.

## 16. Notifikasi

Event notifikasi dapat dibuat untuk:

- Pendaftaran disetujui atau ditolak.
- Aktivasi akun.
- Materi atau ujian dipublikasikan.
- Hasil ujian tersedia.
- Progres tersimpan.
- Invoice baru dibuat.
- Pembayaran berhasil.
- RPP dipublikasikan.
- Pekerjaan Guru yang perlu ditindaklanjuti.

Provider yang tersedia:

- `console`: untuk demo, tidak mengirim email.
- `email`: menggunakan SMTP.
- `n8n`: meneruskan email dan WhatsApp ke webhook n8n.

Notifikasi yang gagal dapat diproses ulang oleh operator melalui job retry.

## 17. File dan Private Storage

File privat digunakan untuk dokumen pendaftaran, materi, RPP, dan submission tugas.

Aturan utama:

- File tidak diletakkan di folder `public`.
- Akses file selalu melalui pemeriksaan role dan hubungan data.
- Nama file dibersihkan dari karakter path berbahaya.
- MIME type, ekstensi, ukuran, dan isi file diperiksa.
- Folder storage harus menggunakan volume persistent pada deployment nyata.

Jika file berhasil diunggah tetapi hilang setelah redeploy, periksa persistent volume pada `/app/storage/private`.

## 18. Backup dan Restore

Backup operasional mencakup:

- `database.sql`: dump database.
- `backup.zip`: database, private storage, manifest, dan checksum.

Backup dapat dijalankan manual atau melalui workflow n8n. Restore harus dilakukan oleh operator teknis setelah:

1. Menghentikan atau mengisolasi aplikasi target.
2. Memastikan database target benar.
3. Memastikan private storage target benar.
4. Melakukan konfirmasi eksplisit.
5. Memeriksa manifest dan checksum.
6. Menjalankan restore.
7. Menguji login, database, dan file privat.

Backup dan restore wajib diuji di staging sebelum dianggap siap untuk production.

## 19. Pengamanan dan Batas Akses

### Admin

- Dapat mengelola seluruh data operasional.
- Dapat melihat audit.
- Dapat mengaktifkan atau menonaktifkan akun.
- Dapat mencabut sesi pengguna.

### Guru

- Hanya dapat mengakses Kelas yang diampu.
- Tidak dapat membuka data Kelas Guru lain melalui URL langsung.
- Tidak dapat melihat catatan internal Guru lain.

### Wali

- Hanya dapat melihat anak yang terhubung.
- Hanya dapat melihat materi dan RPP published dari Kelas anak.
- Hanya dapat melihat tagihan anak sendiri.

### Siswa

- Hanya dapat melihat profil, Kelas, materi, nilai, progres, dan aktivitas miliknya.
- Tidak dapat membuka route Admin, Guru, atau Wali.

Menu yang tersembunyi bukan satu-satunya pengaman. Server tetap memeriksa role dan ownership pada setiap request.

## 20. Health Check

Untuk memeriksa apakah aplikasi berjalan:

```text
https://limo.sistemflow.com/api/health
```

Untuk memeriksa kesiapan environment, database, dan private storage:

```text
https://limo.sistemflow.com/api/health/ready
```

Status readiness yang baik:

```json
{
  "status": "ready",
  "checks": {
    "environment": "ok",
    "database": "ok",
    "privateStorage": "ok"
  }
}
```

## 21. Troubleshooting Umum

### Menu fitur tidak terlihat

Periksa feature flag terkait. Pada production, modul LMS tambahan default-nya nonaktif.

### Guru tidak melihat Kelas

Pastikan:

1. Akun Guru aktif.
2. Profil Guru sudah dibuat.
3. Guru dipilih sebagai pengampu Kelas.
4. Kelas berstatus aktif.

### Wali tidak melihat anak

Pastikan hubungan Wali-Siswa sudah dibuat dan belum diakhiri. Gunakan selector anak pada dashboard Wali.

### Siswa tidak bisa masuk

Pastikan:

1. Portal Siswa aktif.
2. Akun Siswa aktif.
3. `SiswaAccount` terhubung ke data Siswa.
4. Identifier yang digunakan benar.

### Link aktivasi tidak diterima

Periksa provider notifikasi. Mode `console` tidak mengirim email. Gunakan SMTP atau n8n untuk pengiriman nyata.

### Pembayaran belum berubah menjadi lunas

Status pembayaran menunggu webhook Mayar atau rekonsiliasi. Kembali dari checkout saja tidak mengubah status lokal menjadi `PAID`.

### Readiness gagal

Periksa bagian `checks` pada `/api/health/ready`:

- `environment=failed`: periksa variable wajib dan provider.
- `database=failed`: periksa hostname, user, password, port 3306, dan network database.
- `privateStorage=failed`: periksa volume dan permission `/app/storage/private`.

## 22. Checklist Demo Client

Sebelum sesi demo, siapkan:

- Landing page dan program sudah sesuai konten client.
- Akun Admin dapat login.
- Akun Guru dapat login.
- Akun Wali dapat login.
- Data Program, Level, Kelas, dan Siswa tersedia.
- Guru sudah ditugaskan ke Kelas.
- Materi dan contoh presensi tersedia.
- Contoh progres dan nilai tersedia.
- Tagihan demo tersedia jika billing akan ditampilkan.
- Feature flag LMS sudah diaktifkan jika akan dipresentasikan.
- `/api/health/ready` berstatus ready.
- Password demo tidak dibagikan sebagai credential production.

## 23. Checklist Sebelum Production Nyata

- Ganti seluruh password seed dan demo.
- Rotasi `SESSION_SECRET` dan credential database.
- Set `LIMO_DEMO_MODE=false`.
- Gunakan Mayar credential yang benar dan uji webhook.
- Gunakan SMTP atau n8n yang aktif.
- Matikan `DOKPLOY_DB_PUSH_ON_START` setelah migration production normal.
- Pastikan migration production sudah diuji di staging.
- Gunakan volume persistent untuk database dan private storage.
- Aktifkan backup database dan file.
- Uji restore.
- Tinjau rate limit dan reverse proxy.
- Lakukan UAT untuk seluruh role.
- Minta persetujuan final dari pemilik LIMO.

## 24. Ringkasan Alur Per Role

### Admin

```text
Program -> Level -> Guru/Wali -> Kelas -> Siswa -> Sesi -> Billing/Laporan
```

### Guru

```text
Kelas -> Sesi -> Materi/RPP -> Presensi/Progres -> Bank Soal/Ujian -> Penilaian
```

### Wali

```text
Pilih Anak -> Materi/Progres/Presensi/Nilai -> Tugas/Ujian -> Tagihan -> Pembayaran
```

### Siswa

```text
Login -> Kelas Saya -> Materi/Modul -> Tugas/Evaluasi -> Progres/Nilai
```

Dokumen ini ditujukan untuk demo dan UAT client. Detail konfigurasi server, secret, backup, dan integrasi provider harus dikelola oleh administrator teknis dan tidak dibagikan kepada pengguna umum.
