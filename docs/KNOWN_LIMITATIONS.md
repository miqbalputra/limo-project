# Known Limitations and Open Issues

Dokumen ini mencatat gap MVP saat ini agar tidak dianggap selesai diam-diam.

## Infrastruktur

- Migration database nyata belum dijalankan di environment ini karena Docker CLI/MariaDB belum tersedia.
- Integration test dan E2E belum dijalankan karena database test belum tersedia.
- Warning Turbopack terkait dynamic filesystem tracing private storage masih muncul tetapi build sukses.

## Payment

- Signature Pakasir masih asumsi HMAC SHA-256 header `x-pakasir-signature` atas raw body.
- Create payment QRIS/VA ke Pakasir belum dibuat.
- Redirect browser tidak mengubah status pembayaran, sesuai PRD.

## Notifikasi

- Provider nyata email/WhatsApp belum diimplementasikan.
- Retry notification saat ini provider `console` dan menandai `SENT` untuk skeleton operasional.

## UI/UX

- UI masih fungsional dasar, belum polish TailAdmin penuh.
- Banyak modul belum memiliki edit/update/delete/arsip lengkap.
- Tabel besar belum semua memakai pagination UI penuh, meskipun query utama dibatasi.

## Akademik

- Online exam tidak dibuat karena PRD default adalah offline teacher-entry.
- Koreksi nilai setelah final belum memiliki UI khusus.
- Halaman materi untuk Wali belum expose penuh.

## Operasional

- Backup/restore belum diuji nyata.
- Nginx/PM2 config final belum dibuat sebagai file deploy siap pakai.
- Domain/staging/credential provider masih open decision.
