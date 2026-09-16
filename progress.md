# Progress Implementasi LIMO

Terakhir diperbarui: 29 Juli 2026

## Status Saat Ini

Aplikasi LIMO telah dibangun sebagai satu aplikasi Next.js 16 App Router dengan Route Handlers pada `/api/v1/**`, Prisma, MariaDB sebagai target database, database session, dan UI berbasis TailAdmin/Tailwind CSS v4.

Landing page terbaru tersedia di `http://127.0.0.1:3000` saat development server berjalan.

## Revisi Alur Pendaftaran (Revisi v2)

Alur pendaftaran publik diubah mengikuti dokumen revisi v2 (4 langkah + halaman sukses):

- Halaman 1 — Pilih Program: pilihan tunggal, dikelompokkan "Bahasa & Bahasa Arab" dan "Akademik", memakai program aktif yang ada (Bahasa Inggris, Arabic for Kids, Nahwu, Math & Academic Support).
- Halaman 2 — Data Peserta: pilihan "Diri sendiri" atau "Anak" dengan field kondisional (nama, panggilan, jenis kelamin, tanggal lahir, WhatsApp, email, alamat; anak: + nama orang tua/wali, sekolah, kelas/jenjang). Upload foto peserta dihapus dari form pendaftaran (permintaan client).
- Halaman 3 — Formulir khusus per program (Bahasa Inggris, Bahasa Arab, Nahwu, Matematika/Bimbel) sesuai daftar pertanyaan pada dokumen revisi.
- Halaman 4 — Persetujuan: 3 pernyataan wajib + persetujuan dokumentasi (tanpa blur / wajib blur / tidak mengizinkan).
- Halaman sukses `/daftar/berhasil`: nomor pendaftaran, program, peserta, status, dan tahapan selanjutnya (5 langkah).
- Data baru tersimpan di `Pendaftaran`: `participantType`, `studentNickname`, `studentGender`, `address`, `schoolName`, `gradeLevel`, `programAnswers` (JSON), kolom persetujuan, dan `consentAt`.
- Email wali menjadi opsional sesuai dokumen; status lookup menerima kode + nomor WhatsApp atau email. Bila email kosong, admin dapat melengkapinya di halaman detail pendaftaran sebelum approve.
- Admin detail menampilkan data peserta, jawaban formulir program, dan persetujuan; export PDF/Excel menambah kolom baru (tipe peserta, gender, sekolah, kelas, konsen dokumentasi, jawaban program).
- Acceptance: `npm run test:week1` (submit CHILD + SELF, upload, approve/reject) dan unit test schema pendaftaran diperbarui; alur wizard diuji desktop/mobile.

### Verifikasi Kesesuaian revisi_v2.md (data terekam penuh)

- `npm run test:pendaftaran-v2` (integrasi HTTP + database) memverifikasi submit ENGLISH/ARABIC_KIDS/NAHWU/MATH_ACADEMIC_SUPPORT untuk mode Diri sendiri dan Anak: seluruh kolom peserta, `programAnswers` (termasuk opsi opsional yang dikosongkan dan jawaban "Lainnya"), konsen, `consentAt`, `submittedAt`, riwayat status, detail admin, validasi data wajib, anti-duplikat, dan cek status via WhatsApp/email.
- `tests/e2e/pendaftaran-v2.spec.ts` memverifikasi UI 4 langkah sesuai dokumen (grup program, field kondisional, keempat formulir program, persetujuan, halaman sukses) dan dijalankan via `npm run test:e2e` (database terisolasi per spec).
- `scripts/seed-production.ts` menonaktifkan program legacy kind ARABIC agar halaman pilih program konsisten menampilkan empat program revisi.

### Notifikasi Pendaftaran (Fase 1)

- Submit kini otomatis membuat notifikasi konfirmasi `pendaftaran-submitted` ke WhatsApp orang tua/wali dan email (bila diisi), berisi nomor pendaftaran, program, dan tautan cek status.
- Approve mengirim `pendaftaran-approved` ke WhatsApp dan email berisi status diterima, identifier akun wali, dan tautan aktivasi; reject mengirim `pendaftaran-rejected` beserta alasan ke kedua kanal.
- Service baru `src/server/services/pendaftaran-notification-service.ts` memakai `dedupeKey` (anti-duplikat) dan mengikuti `NOTIFICATION_PROVIDER` (console/email/n8n).
- Job notifikasi dipindah ke `src/server/services/notification-job-service.ts` (impor relatif tanpa `server-only`) agar `npm run notifications:retry` dapat dieksekusi Node; sebelumnya gagal karena rantai impor `payment-gateway-service`.
- Jadwalkan `notifications:retry` tiap menit (lihat `docs/DEPLOYMENT.md`); kontrak webhook n8n dan template didokumentasikan di `docs/MAYAR_N8N_INTEGRATION.md`, rencana lengkap di `docs/PLAN_NOTIFIKASI_PENDAFTARAN.md`.


## Status Minggu 1

Target teknis Minggu 1 dinyatakan selesai dan telah diverifikasi menggunakan SQLite lokal:

- Landing page, metadata sosial, sitemap, robots, halaman privasi, halaman syarat, kontak configurable, CTA, dan mobile navigation.
- Login/logout, forgot/reset/change password, database session, idle/absolute timeout, redirect per role, activation link, deactivate/reactivate user, dan revoke session.
- Pendaftaran publik, status lookup, dokumen privat, review, approval idempoten, rejection beralasan, audit, dan notification record.
- Data siswa: create/list/detail/update, archive/restore, filter, pagination, CSV, relasi banyak wali, dan mutasi kelas dengan histori enrollment.
- Acceptance test HTTP SQLite dan Playwright 360px telah lulus.

MariaDB tetap menjadi target production. SQLite hanya digunakan untuk development dan acceptance test sementara.

## Status Minggu 2

Target proposal Minggu 2 telah mulai ditutup untuk kebutuhan demo:

- LMS materi mendukung tipe teks, PDF, gambar, dan link video, dengan kategorisasi melalui program, level, kelas, dan sesi pertemuan.
- Route `/guru/materi` ditambahkan sebagai pintu masuk kelola materi per kelas.
- Bank soal mendukung pilihan ganda terstruktur dan esai, dengan scoping kelas/guru.
- Builder ujian mendukung durasi/timer ujian, status draft/published, tanggal ujian, bobot soal, dan pilihan soal dari bank soal.
- Input hasil ujian menampilkan timer, auto-skoring pilihan ganda, dan status final/review untuk esai.
- Route `/wali/nilai` ditambahkan untuk riwayat nilai ujian anak.
- Acceptance test Pekan 2 tersedia melalui `npm.cmd run test:week2`.
- Browser smoke test Pekan 2 tersedia di `tests/e2e/week2.spec.ts` untuk memastikan halaman Materi, Bank Soal, Ujian, Input Hasil, dan Riwayat Nilai Wali usable di viewport mobile tanpa horizontal overflow.

## Status Minggu 3

Target proposal Minggu 3 telah siap untuk demo:

- Presensi per sesi dapat diinput guru dan ditampilkan ke wali sebagai rekap kehadiran bulanan.
- Catatan progres belajar per sesi memakai skor pemahaman 1-5, catatan wali, dan catatan internal guru.
- Grafik progress tersedia tanpa dependency tambahan melalui bar chart CSS responsif: pemahaman, nilai ujian, dan kehadiran bulanan di halaman wali; ringkasan kelas guru juga memakai indikator grafik.
- Route `/wali/presensi` ditambahkan agar menu presensi wali tidak 404 dan menampilkan rate kehadiran per anak.
- Halaman tagihan wali menampilkan status, nominal, jatuh tempo, dan CTA instruksi pembayaran Mayar.
- Integrasi Mayar V2 mendukung create invoice, webhook `payment.received`, validasi merchant/nominal, status transition, dan reconciliation detail invoice.
- Acceptance test Minggu 3 tersedia melalui `npm.cmd run test:week3` dan browser smoke test mobile tersedia di `tests/e2e/week3.spec.ts`.

## Fitur yang Sudah Diimplementasikan

- Autentikasi database session: login, logout, forgot password, dan reset password.
- Role dan data scoping dasar untuk Admin, Guru, dan Wali.
- Dashboard terpisah berdasarkan role.
- Pendaftaran publik, upload dokumen privat, pengecekan status, approval, dan rejection.
- Master data program, level, kelas, guru, wali, siswa, dan enrollment dasar.
- LMS: sesi kelas, materi teks/video/file, dan upload materi privat.
- Assessment Bank SD English/Arabic dengan tipe PG, multi-select, benar/salah, isian, cloze, matching, sequencing, picture, listening, speaking, writing, reading, roleplay, esai, metadata CEFR/AKM, auto-scoring objektif, dan review rubric/manual.
- Ujian online MVP via akun wali tersedia melalui menu Tugas Anak, dengan attempt, timer server-authoritative, auto-scoring objektif, dan status review untuk jawaban manual.
- Timer ujian dan riwayat nilai wali untuk target Pekan 2.
- Presensi massal dan pencatatan progres siswa.
- Grafik progress wali/guru, rekap presensi bulanan, create payment Mayar, dan webhook payment untuk target Minggu 3.
- Tarif, tagihan, overdue job, webhook Mayar, dan rekonsiliasi pembayaran manual.
- PWA dasar, offline fallback, security headers, dan noindex untuk dashboard/auth.
- Script job eksternal untuk tagihan, overdue, session cleanup, dan retry notification.
- Unit test dasar dan dokumentasi deployment/UAT/backup.
- Setup SQLite reproducible melalui `npm run sqlite:setup`.
- Acceptance test Minggu 1 melalui `npm run test:week1` dan `npm run test:e2e`.

## UI dan TailAdmin

- Token warna, tipografi Outfit, shadow, button, card, dan form TailAdmin telah diadaptasi ke `src/app/globals.css`.
- Dashboard menggunakan sidebar, header, active navigation, dan mobile drawer bergaya TailAdmin.
- Shell dashboard telah diselaraskan dengan demo TailAdmin: sidebar 290/90 yang dapat collapse, ikon SVG, menu grouping, command search `Ctrl+K`, profile dropdown, dropdown notifikasi berbasis data, dan breadcrumb.
- Halaman auth sudah memakai pola TailAdmin signin/reset-password.
- Dashboard Admin memakai metric cards, recent registration table, komposisi pengguna, recent students, dan quick actions.
- Halaman Minggu 1 Pendaftaran, Siswa, dan Pengguna memakai responsive TailAdmin data tables, status badges, summary cards, filter, dan pagination.
- Seluruh route dashboard Admin, Guru, dan Wali telah memakai token serta utilitas visual TailAdmin.
- Form auth, pendaftaran publik, form dashboard, table, card, button, input, dan semantic feedback telah memakai komponen visual TailAdmin.
- Utility bersama `tailadmin-input`, `tailadmin-alert-error`, `tailadmin-alert-success`, dan `tailadmin-alert-warning` menjaga form tetap konsisten.
- Folder `free-react-tailwind-admin-dashboard-main` dipakai sebagai referensi desain dan dikecualikan dari TypeScript serta ESLint aplikasi.

## Landing Page

Landing page di `src/app/(public)/page.tsx` telah disesuaikan dengan identitas LIMO:

- Menggunakan logo resmi `public/icon.svg`.
- Hero bertema pembelajaran anak dengan Bahasa Inggris dan Bahasa Arab.
- Program English for Kids dan Arabic for Kids.
- Manfaat untuk anak, guru, dan wali.
- Alur pendaftaran empat langkah.
- Preview dashboard wali dan progres belajar.
- CTA pendaftaran dan pengecekan status.
- Responsive untuk mobile dan desktop.
- Warna utama tetap menggunakan token TailAdmin seperti `brand-*`, `gray-*`, `success-*`, dan `warning-*`.

## Verifikasi Terakhir

- `npm.cmd run typecheck`: lulus.
- `npm.cmd run lint`: lulus.
- `npm.cmd test`: lulus.
- `npm.cmd run test:week2`: 5 acceptance checks lulus untuk materi, bank soal, timer ujian, auto-skoring, dan riwayat nilai wali.
- `npm.cmd run test:week3`: lulus untuk presensi, progres, finalisasi sesi, grafik, rekap presensi wali, ringkasan kelas, instruksi payment Mayar, webhook payment, dan dropdown notifikasi berbasis data.
- `npm.cmd run build`: lulus dengan environment validasi.
- `npm.cmd run sqlite:setup`: lulus, schema valid, database sinkron, client generated, seed berhasil.
- `npm.cmd run test:week1`: 17 acceptance checks lulus.
- `npm.cmd run test:e2e`: 8 browser tests lulus, termasuk shell dashboard desktop/mobile, halaman Pekan 2 mobile, dan halaman Pekan 3 mobile.
- `GET /`: HTTP 200.
- `GET /login`: HTTP 200.
- `GET /api/health`: HTTP 200.

## Development Server

- URL: `http://127.0.0.1:3000`
- PID listener terakhir: `12576`
- Stop server: `taskkill /PID 12576 /T /F`

PID dapat berubah jika server dijalankan ulang.

## Catatan dan Batasan

- MariaDB/Docker belum tersedia di environment ini. Migration dan parity test MariaDB tetap harus dilakukan sebelum production.
- SQLite tidak memvalidasi perilaku khusus MariaDB seperti collation, precision Decimal, batas `VarChar`, dan concurrency write.
- Data kontak production, jadwal resmi, testimoni terverifikasi, materi, dan konten final perlu dikonfirmasi oleh LIMO.
- Landing page memiliki kebebasan visual LIMO sendiri; dashboard, auth, dan form operasional tetap mengikuti TailAdmin.
- Provider email SMTP dan outbound n8n sudah tersedia; credential Mayar production, workflow GOWA nyata, dan UAT payment end-to-end di environment production masih perlu diselesaikan.

## Langkah Berikutnya

1. Finalisasi konten resmi landing page: kontak, jadwal, testimoni, dan informasi program.
2. Lanjutkan target Minggu 4: integrasi final, pengujian, deployment production, dan pelatihan.
3. Siapkan MariaDB, buat migration production dari `prisma/schema.prisma`, seed, dan jalankan parity test.
4. Selesaikan workflow n8n/GOWA, credential Mayar production, dan UAT payment end-to-end.
