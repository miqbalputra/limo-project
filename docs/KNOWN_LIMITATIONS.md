# Known Limitations and Open Issues

Dokumen ini mencatat gap MVP saat ini agar tidak dianggap selesai diam-diam.

## Infrastruktur

- Migration database nyata belum dijalankan di environment ini karena Docker CLI/MariaDB belum tersedia.
- Acceptance test SQLite dan E2E Playwright sudah tersedia; parity test MariaDB production belum dijalankan di environment ini.
- Warning Turbopack terkait dynamic filesystem tracing private storage masih muncul tetapi build sukses.

## Payment

- Webhook Pakasir menerima payload resmi tanpa signature; jika `PAKASIR_WEBHOOK_SECRET` diisi, signature HMAC SHA-256 `x-pakasir-signature` tetap divalidasi sebagai hardening tambahan.
- Jika `PAKASIR_API_KEY` tersedia, webhook diverifikasi ulang ke Transaction Detail API Pakasir sebelum status pembayaran diterima.
- Create payment QRIS/VA ke Pakasir sudah tersedia: API Pakasir dipakai ketika `PAKASIR_API_KEY` tersedia, dan fallback link resmi dipakai ketika hanya `PAKASIR_PROJECT` yang dikonfigurasi.
- Kredensial production Pakasir dan UAT end-to-end di merchant nyata belum dilakukan di environment ini.
- Redirect browser tidak mengubah status pembayaran, sesuai PRD.

## Notifikasi

- Provider email SMTP sudah tersedia untuk production awal melalui `NOTIFICATION_PROVIDER=email` dan script `npm run notifications:retry`.
- Provider WhatsApp nyata belum diimplementasikan; gunakan email sebagai kanal production awal sampai vendor WhatsApp dipilih.

## UI/UX

- Dashboard shell sudah memakai pola TailAdmin termasuk sidebar collapse, command search, profile dropdown, breadcrumb, dan dropdown notifikasi berbasis data; polish visual per modul masih bisa dilanjutkan.
- Banyak modul belum memiliki edit/update/delete/arsip lengkap.
- Tabel besar belum semua memakai pagination UI penuh, meskipun query utama dibatasi.

## Akademik

- Online exam MVP via akun wali sudah tersedia untuk tipe soal dasar; autosave/resume dan network-loss warning selesai, sedangkan global child selector sedang dikerjakan. Recording speaking, matching/sequencing interaktif, dan akun siswa mandiri masih menjadi backlog.
- Koreksi nilai setelah final belum memiliki UI khusus.
- Halaman materi untuk Wali belum expose penuh.

## Operasional

- Backup/restore belum diuji nyata.
- Nginx/PM2 config final belum dibuat sebagai file deploy siap pakai.
- Domain/staging/credential provider masih open decision.
