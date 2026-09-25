# Runbook Migrasi MariaDB (Staging → Produksi)

Dokumen ini melengkapi `docs/DEPLOYMENT.md` (langkah deploy umum) dan `docs/DOKPLOY.md` (deploy via Dokploy). Fokusnya: menjalankan **migrasi Prisma ke MariaDB** dengan aman dan membuktikan **parity** terhadap database yang dipakai untuk verifikasi harian (SQLite).

## Mengapa ini penting

Seluruh verifikasi otomatis (unit, integrasi, e2e) berjalan di **SQLite**. Produksi memakai **MariaDB** (`prisma/schema.prisma` bertarget `mysql`). Perbedaan yang berisiko dan pernah memakan korban di proyek lain:

- **Collation/charset** — pencarian `contains`/`startsWith` pada MySQL bergantung collation; salah setel bisa membuat filter tak sensitif/kurang sensitif huruf besar-kecil.
- **Presisi `Decimal`** — uang memakai `Decimal(14,2)`; konfigurasi berbeda bisa memunculkan pembulatan tak terduga.
- **Batas `VarChar`** — kolom seperti `jenis VARCHAR(64)`, `title VARCHAR(200)`, `code VARCHAR(32)` bisa memotong/menolak jika kode mengirim lebih panjang.
- **Concurrency** — klaim atomik (`usedCount`, `updatedAt`, `notifiedAt`) harus benar-benar atomik di bawah MariaDB.
- **Urutan & index** — `orderBy` + pagination harus deterministik.

## Prasyarat

- Akses ke MariaDB staging (private, tidak diekspos ke internet) dan `DATABASE_URL` berbentuk `mysql://user:pass@host:3306/limo`.
- Node.js 22+, `npm ci` selesai pada release yang akan dideploy.
- **Backup** database sebelum menjalankan migrasi apa pun.
- Prisma Client di-generate dari **schema utama** (bukan schema SQLite):

```bash
npx prisma generate --schema prisma/schema.prisma
```

> Catatan: `npm run sqlite:setup` mengganti Prisma Client ke provider SQLite. Di server staging/produksi **jangan** memakai perintah itu.

## Langkah Staging

```bash
# 1. Backup (dump SQL + storage privat bila ada)
mysqldump --single-transaction --routines --triggers limo > /backup/limo-$(date +%F-%H%M).sql

# 2. Pasang dependency dari lockfile
npm ci

# 3. Generate client dengan schema utama (provider mysql)
npx prisma generate --schema prisma/schema.prisma

# 4. Lihat status migrasi (pastikan daftar pending sesuai harapan)
npx prisma migrate status

# 5. Jalankan migrasi
npx prisma migrate deploy

# 6. Verifikasi parity
DATABASE_URL="mysql://..." npm run db:parity

# 7. Smoke test aplikasi (lihat bagian Smoke Test)
```

### Migrasi yang menunggu (per 25 Sep 2026)

`20260924010000_quiz_google_forms_parity`, `20260924020000_quiz_manual_scores`, `20260924030000_certificates`, `20260925010000_student_self_exam`, `20260925020000_exam_secure_mode_result_release`, `20260925030000_pengumuman`, `20260925040000_diskusi`, `20260925050000_diskusi_moderasi`, `20260925060000_vouchers_and_receipts`, `20260925070000_voucher_scope`, `20260925080000_diskusi_balasan_lampiran`, `20260925090000_exam_result_release_per_student`.

## Parity otomatis: `npm run db:parity`

Skrip `scripts/verify-db-parity.mjs` memeriksa:

- Koneksi database.
- **MySQL/MariaDB saja**: charset database `utf8mb4`, tabel & kolom wajib ada, presisi semua kolom `DECIMAL` ≥ `(10,2)`, enum `VoucherDiscountType` berisi `PERCENT`/`FIXED`, ada unique index di `Tagihan`/`Voucher`.
- **Semua provider**: keberadaan tabel & kolom baru lewat query Prisma, round-trip `Decimal(14,2)`, dan **unique constraint `Voucher.code`**.
- Probe tulis dijalankan di dalam transaksi yang sengaja gagal (rollback) sehingga **tidak meninggalkan data**.

Keluaran berakhir dengan `N/M pemeriksaan lulus.` dan exit code non-nol bila ada kegagalan. **Jangan lanjutkan rilis** bila ada `FAIL`.

> Skrip ini **tidak** menggantikan uji beban/concurrency. Untuk itu lihat bagian berikut.

## Pemeriksaan manual yang tetap perlu

Skrip di atas bersifat skema/dasar. Sebelum tanda tangan UAT, lakukan:

1. **Concurrency ujian serentak** — jalankan beberapa attempt bersamaan dan pastikan tidak ada `database is locked`/deadlock/timeout; cek plan query untuk endpoint pemutar (`/api/v1/siswa/attempt/*`, `/api/v1/wali/attempt/*`).
2. **Klaim atomik** — pastikan satu pengumuman berjadwal hanya memicu satu notifikasi walau job `pengumuman:publish` jalan berbarengan; idem untuk `notifiedAt`, `usedCount` voucher, dan `draftSavedAt`.
3. **Filter teks** — uji pencarian (`search`) pada list siswa/tagihan/kelas dengan huruf besar-kecil dan aksen untuk memastikan collation sesuai harapan.
4. **Upload berkas** — unggah di batas `MAX_QUIZ_UPLOAD_MB`/`MAX_ASSIGNMENT_FILE_MB` dan pastikan ditolak/diterima konsisten.
5. **Rate limit** — catat bahwa pembatasan masih **in-process**; bila dijalankan multi-instance, angkanya tidak akurat (lihat Gate 3).

## Smoke Test

Di staging, lakukan minimal:

- Login Admin/Guru/Wali/Siswa (browser desktop **dan** mobile).
- Buat 1 pengumuman kelas → terlihat oleh siswa, tandai dibaca.
- Buat 1 diskusi → balas sebagai wali → moderasi guru (sematkan).
- Buat 1 ujian daring (~2 soal) → siswa kerjakan → guru rilis nilai → siswa lihat nilai.
- Terbitkan 1 sertifikat → buka `/verifikasi-sertifikat/<kode>`.
- Terbitkan 1 voucher → wali pakai pada tagihan → admin rekonsiliasi → unduh kuitansi PDF.
- Kirim 1 notifikasi (email/WhatsApp) lewat provider staging.

## Rollback

`prisma migrate deploy` **tidak** otomatis di-rollback. Bila migrasi atau rilis bermasalah:

1. Hentikan aplikasi (PM2/Dokploy) agar tidak menulis ke schema yang setengah jadi.
2. Restore backup: `mysql limo < /backup/limo-<stamp>.sql`.
3. Checkout release sebelumnya dan `npm ci` → `npx prisma generate` → `npm run build`.
4. Reload aplikasi dan cek `/api/health/ready`.
5. Catat insiden; jangan menjalankan ulang migrasi destruktif tanpa validasi data.

Migrasi bersifat additive (kolom/tabel baru + enum), sehingga rollback kode tanpa rollback schema umumnya aman; namun tetap validasi bila ada perubahan bentuk data.

## Checklist kelulusan migrasi

- [ ] Backup database dibuat dan tersimpan.
- [ ] `npx prisma migrate status` bersih setelah `migrate deploy`.
- [ ] `npm run db:parity` **100% lulus** di MariaDB staging.
- [ ] Smoke test lintas peran lulus (desktop + mobile).
- [ ] Pemeriksaan manual (concurrency, klaim atomik, filter teks, upload) dicatat hasilnya.
- [ ] Hasil di atas dilampirkan ke UAT owner.
