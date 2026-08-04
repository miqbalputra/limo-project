# Known Limitations and Open Issues

Dokumen ini mencatat gap MVP saat ini agar tidak dianggap selesai diam-diam.

## Infrastruktur

- Migration database nyata belum dijalankan di environment ini karena Docker CLI/MariaDB belum tersedia.
- Acceptance test SQLite dan E2E Playwright sudah tersedia; parity test MariaDB production belum dijalankan di environment ini.
- Rate limit aplikasi masih in-process; deployment multi-instance tetap membutuhkan Redis atau rate limit di reverse proxy.

## Payment

- Mayar menjadi provider pembayaran resmi. Webhook dilindungi secret LIMO dan validasi merchant/nominal jika credential production sudah dikonfigurasi.
- Reconciliation Mayar menggunakan detail invoice API melalui `npm run mayar:reconcile`.
- Kredensial production Mayar dan UAT end-to-end di merchant nyata belum dilakukan di environment ini.
- Redirect browser tidak mengubah status pembayaran, sesuai PRD.

## Notifikasi

- Provider email SMTP tersedia melalui `NOTIFICATION_PROVIDER=email` dan script `npm run notifications:retry`.
- Provider n8n tersedia untuk email/WhatsApp; pengiriman WhatsApp tetap dilakukan oleh workflow GOWA eksternal, bukan langsung dari LIMO.

## UI/UX

- Dashboard shell sudah memakai pola TailAdmin termasuk sidebar collapse, command search, profile dropdown, breadcrumb, dan dropdown notifikasi berbasis data; polish visual per modul masih bisa dilanjutkan.
- Banyak modul belum memiliki edit/update/delete/arsip lengkap.
- Tabel besar belum semua memakai pagination UI penuh, meskipun query utama dibatasi.

## Akademik

- Online exam MVP via akun wali sudah tersedia untuk tipe soal dasar; autosave/resume, network-loss warning, global child selector, materi Wali, operational notification triggers, dan FAQ/pusat bantuan tersedia. Recording speaking, matching/sequencing interaktif, dan akun siswa mandiri masih menjadi backlog.
- Hasil `NEEDS_REVIEW`, `FINAL`, dan `CORRECTED` memiliki jalur review/koreksi Guru; hasil final tetap dikunci dari input biasa.
- Sesi Guru memiliki workflow finalisasi yang mengunci presensi dan progres setelah data lengkap.

## Operasional

- Backup/restore terjadwal, SQL import, ZIP checksum, dan endpoint n8n sudah tersedia; belum diuji nyata terhadap MariaDB staging serta storage off-site.
- Nginx/PM2 config final belum dibuat sebagai file deploy siap pakai.
- Domain/staging/credential provider masih open decision.
