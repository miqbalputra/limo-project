# Progress Implementasi LIMO

Terakhir diperbarui: 23 Juli 2026

## Status Saat Ini

Aplikasi LIMO telah dibangun sebagai satu aplikasi Next.js 16 App Router dengan Route Handlers pada `/api/v1/**`, Prisma, MariaDB sebagai target database, database session, dan UI berbasis TailAdmin/Tailwind CSS v4.

Landing page terbaru tersedia di `http://127.0.0.1:3000` saat development server berjalan.

## Status Minggu 1

Target teknis Minggu 1 dinyatakan selesai dan telah diverifikasi menggunakan SQLite lokal:

- Landing page, metadata sosial, sitemap, robots, halaman privasi, halaman syarat, kontak configurable, CTA, dan mobile navigation.
- Login/logout, forgot/reset/change password, database session, idle/absolute timeout, redirect per role, activation link, deactivate/reactivate user, dan revoke session.
- Pendaftaran publik, status lookup, dokumen privat, review, approval idempoten, rejection beralasan, audit, dan notification record.
- Data siswa: create/list/detail/update, archive/restore, filter, pagination, CSV, relasi banyak wali, dan mutasi kelas dengan histori enrollment.
- Acceptance test HTTP SQLite dan Playwright 360px telah lulus.

MariaDB tetap menjadi target production. SQLite hanya digunakan untuk development dan acceptance test sementara.

## Fitur yang Sudah Diimplementasikan

- Autentikasi database session: login, logout, forgot password, dan reset password.
- Role dan data scoping dasar untuk Admin, Guru, dan Wali.
- Dashboard terpisah berdasarkan role.
- Pendaftaran publik, upload dokumen privat, pengecekan status, approval, dan rejection.
- Master data program, level, kelas, guru, wali, siswa, dan enrollment dasar.
- LMS: sesi kelas, materi teks/video/file, dan upload materi privat.
- Bank soal, builder ujian, hasil ujian offline, auto-skoring pilihan ganda, dan review esai.
- Presensi massal dan pencatatan progres siswa.
- Tarif, tagihan, overdue job, webhook Pakasir skeleton, dan rekonsiliasi pembayaran manual.
- PWA dasar, offline fallback, security headers, dan noindex untuk dashboard/auth.
- Script job eksternal untuk tagihan, overdue, session cleanup, dan retry notification.
- Unit test dasar dan dokumentasi deployment/UAT/backup.
- Setup SQLite reproducible melalui `npm run sqlite:setup`.
- Acceptance test Minggu 1 melalui `npm run test:week1` dan `npm run test:e2e`.

## UI dan TailAdmin

- Token warna, tipografi Outfit, shadow, button, card, dan form TailAdmin telah diadaptasi ke `src/app/globals.css`.
- Dashboard menggunakan sidebar, header, active navigation, dan mobile drawer bergaya TailAdmin.
- Shell dashboard telah diselaraskan dengan demo TailAdmin: sidebar 290/90 yang dapat collapse, ikon SVG, menu grouping, command search `Ctrl+K`, profile dropdown, notification affordance, dan breadcrumb.
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
- `npm.cmd run build`: lulus dengan environment validasi.
- `npm.cmd run sqlite:setup`: lulus, schema valid, database sinkron, client generated, seed berhasil.
- `npm.cmd run test:week1`: 17 acceptance checks lulus.
- `npm.cmd run test:e2e`: 4 browser tests lulus, termasuk shell dashboard desktop/mobile.
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
- Build masih menampilkan warning Turbopack non-fatal terkait filesystem tracing pada private storage.
- Data kontak production, jadwal resmi, testimoni terverifikasi, materi, dan konten final perlu dikonfirmasi oleh LIMO.
- Landing page memiliki kebebasan visual LIMO sendiri; dashboard, auth, dan form operasional tetap mengikuti TailAdmin.
- Integrasi provider email/WhatsApp dan payment provider production belum selesai.

## Langkah Berikutnya

1. Finalisasi konten resmi landing page: kontak, jadwal, testimoni, dan informasi program.
2. Lanjutkan target Minggu 2: materi LMS, bank soal, ujian, dan hardening workflow yang sudah memiliki baseline.
3. Siapkan MariaDB, buat migration production dari `prisma/schema.prisma`, seed, dan jalankan parity test.
4. Selesaikan provider notifikasi dan konfigurasi payment production.
