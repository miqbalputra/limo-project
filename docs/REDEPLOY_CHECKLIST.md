# Checklist Redeploy — semua fitur langsung berfungsi

Tujuan: setelah redeploy, seluruh fitur (termasuk yang baru) langsung aktif tanpa langkah manual tambahan. Dokumen ini melengkapi `docs/MARIADB_MIGRATION_RUNBOOK.md` dan `docs/DEPLOYMENT.md`.

## Apa yang otomatis vs tidak

| Hal | Otomatis saat redeploy? | Catatan |
|---|---|---|
| Migrasi database | ✅ Ya | `docker-entrypoint.sh` menjalankan `npx prisma migrate deploy` (retry bila DB belum siap). |
| Kode + build baru | ✅ Ya | Redeploy membangun image baru (`npm ci` → `prisma generate` → `npm run build`). |
| Header `Permissions-Policy` | ✅ Ya | Sudah diperbaiki di `next.config.ts`; ikut ter-build. Rekaman suara/audio-video berfungsi. |
| **Feature flag fitur baru** | ❌ Tidak | Default produksi **OFF**. Harus di-set di env. |
| **Cron `pengumuman:publish`** | ❌ Tidak | Perlu didaftarkan sebagai scheduled task. |

> Penting: **restart** container tanpa rebuild **tidak** membawa file migrasi baru. Yang benar adalah **redeploy/build ulang image** agar folder `prisma/migrations` terbaru ikut.

## 1. Env wajib (harus sudah benar sebelum deploy)

- `APP_URL` (https, tanpa slash akhir), `SESSION_SECRET` (≥32 char), `PAYMENT_CONFIG_ENCRYPTION_KEY` (base64 32 byte).
- Database: `DATABASE_URL` **atau** `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASS`.
- `PRIVATE_STORAGE_PATH`, `BACKUP_DIR` (di volume persistent).
- Notifikasi: `NOTIFICATION_PROVIDER=email` **atau** `n8n`, beserta variabelnya (SMTP_* atau N8N_*). Bila tidak lengkap, aplikasi **gagal start** (validasi env).
- Mayar produksi (satu-satunya payment gateway — Pakasir sudah dihapus dari kode): `MAYAR_ENV=production`, `MAYAR_API_KEY`, `MAYAR_MERCHANT_ID`, `MAYAR_WEBHOOK_SECRET`. Pastikan dashboard Mayar mengarah ke `https://<domain>/api/v1/webhooks/mayar?secret=...`.
- `DOKPLOY_SEED_ON_START=false` dan `DOKPLOY_DB_PUSH_ON_START=false` (nilai `true` akan ditolak/di-bypass migrasi dan berbahaya di produksi).

## 2. Env khusus fitur baru (delta yang paling sering terlewat)

Tanpa ini, fitur baru akan tampak "hilang" (menu tidak muncul / 404) walau kodenya benar:

```env
# Ujian mandiri siswa + rilis nilai per attempt
STUDENT_SELF_EXAM_ENABLED=true
# Pengumuman (kelas & sekolah) + diskusi kelas (+ menu /admin/pengumuman, /admin/diskusi-laporan)
CLASS_DISCUSSION_ENABLED=true
# Radar Intelijen (menu /admin/radar — pusat komando retensi pemilik lembaga)
RADAR_INTEL_ENABLED=true
# Generator laporan bulanan otomatis (panel di /admin/laporan-perkembangan + cron reports:autodraft)
REPORT_AUTOPILOT_ENABLED=true
# Peluang kenaikan level (menu /admin/upsell — mesin pendapatan upsell)
UPSELL_ENABLED=true
# Batas unggahan jawaban kuis (MB). 0 = tanpa batas (tidak disarankan)
MAX_QUIZ_UPLOAD_MB=25
```

Catatan:
- `STUDENT_SELF_EXAM_ENABLED` hanya berguna bila `STUDENT_PORTAL_ENABLED=true`.
- Fitur lain (`voucher`, `kuitansi`, `sertifikat`, `rekaman suara`) **tidak butuh flag**.
- Template `.env.dokploy.external-db.example` sudah diperbarui ke nilai di atas.

## 3. Langkah redeploy (Dokploy)

0. **Cek disk VPS dulu** — build Docker gagal dengan `no space left on device` bila disk penuh (tiap build menyimpan layer + cache baru, dan image lama menumpuk):
   ```bash
   df -h                      # pastikan ≥ 5 GB bebas
   docker system df           # lihat apa yang makan tempat
   # Bila penuh — hapus image & build cache lama (AMAN; JANGAN pakai --volumes,
   # volume berisi data MariaDB dan storage):
   docker image prune -af && docker builder prune -af
   ```
1. Pastikan env di dashboard Dokploy sudah memuat nilai bagian (2) di atas.
2. **Redeploy** service `web` (build ulang image) — jangan sekadar restart. Bila Dokploy mendukung build args, teruskan `LIMO_BUILD_SHA=$(git rev-parse HEAD)` dan `LIMO_BUILD_TIME=$(date -u +%FT%TZ)` agar `/api/health` menampilkan versi build (bila tidak diteruskan, `build.sha` = `null`).
3. Tunggu log startup. Cari penanda migrasi berikut di log container:
   - `Menjalankan migrasi database (prisma migrate deploy)...`
   - `Migrasi database selesai (prisma migrate deploy).`
   - lalu `Ready`.
4. Cek health: `curl -s https://<domain>/api/health/ready` → status `ok`.

Jika penanda di langkah 3 **tidak muncul**, migrasi tidak dijalankan. Penyebab umum:
- Anda menekan **Restart**, bukan **Redeploy** (image lama dipakai ulang, folder `prisma/migrations` lama).
- Start command Application diganti menjadi `next start` sehingga `docker-entrypoint.sh` (Dockerfile `ENTRYPOINT`) ter-bypass. Biarkan start command default.
- `DOKPLOY_DB_PUSH_ON_START=true` — memakai `prisma db push` dan melewati `migrate deploy`. Jadikan `false` di production.
- Jika log menampilkan `Migrasi database GAGAL`, container sengaja berhenti; perbaiki penyebabnya (lihat bagian 6) lalu redeploy.

## 4. Verifikasi pasca-deploy (semua peran)

- **Health + versi build**: `/api/health/ready` mengembalikan 200, dan `curl -s https://<domain>/api/health` → `build.sha` **harus sama** dengan `git rev-parse HEAD` di main. Bila `null`/beda → build stale: build arg `LIMO_BUILD_SHA` tidak diteruskan atau image lama masih jalan.
- **Admin**: menu **Pengumuman** dan **Laporan Diskusi** muncul; buka `/admin/pengumuman` → buat pengumuman sekolah; `/admin/tagihan` → buat voucher + lihat kuitansi pada tagihan lunas.
- **Guru**: `/guru/kuis` → buat ujian; `/guru/ujian/<id>/hasil` → tombol **Rilis nilai** ada.
- **Siswa**: menu **Ujian** muncul → kerjakan ujian → **rekam suara** (uji mikrofon) → kirim.
- **Wali**: `/wali/pengumuman`, `/wali/diskusi` (balas thread), `/wali/tagihan` (pakai voucher → rekonsiliasi admin → unduh kuitansi PDF) → **buat link pembayaran via Mayar** → bayar di sandbox → webhook mengubah status menjadi PAID.
- **Payment (Mayar-only)**: `/admin/pembayaran/pengaturan` → konfigurasi Mayar → **Simpan** (baris gateway lama `PAKASIR` otomatis dinonaktifkan) → **Uji koneksi** → salin URL webhook.
- **Fitur intelijen (bila flag aktif)**: menu **Radar Intelijen** (`/admin/radar`) menampilkan skor risiko siswa; **Peluang Lanjutan** (`/admin/upsell`) menampilkan siswa siap naik level; panel **Generator Laporan Bulanan** di `/admin/laporan-perkembangan` — jalankan **Simulasi** lalu **Generate Draf**.
- **Migrasi**: di dalam container, `npx prisma migrate status` → "Database schema is up to date!".
- (Opsional) parity: `npm run db:parity` → harus `N/N pemeriksaan lulus`.

## 5. Cron yang perlu didaftarkan

Cron **tidak terpasang otomatis** oleh redeploy — verifikasi justru bagian dari checklist ini:

- [ ] Semua **11 job** di `deploy/cron/limo.crontab` terdaftar (Schedules Dokploy atau crontab host). Cek: job mencatat baris baru di tabel `JobRun` dalam 1× interval jadwalnya — khususnya `notifications:retry` (tiap menit), `pengumuman:publish` (tiap menit), `quiz:finalize` (tiap menit), `mayar:reconcile` (tiap 30 menit), `backup:create` (02:00 WIB), `billing:generate` (tgl 1, 00:30 WIB), `reports:autodraft` (tgl 1, 01:00 WIB — periode bulan sebelumnya), `billing:mark-overdue` (06:00), `reminders:send` (07:00), `reminders:invoices` (07:10), `sessions:cleanup` (03:15). **Job `pakasir:reconcile` sudah dihapus — hapus juga baris cron lamanya bila pernah terdaftar.**
- [ ] `SELECT name, MAX(finishedAt) FROM JobRun GROUP BY name;` menampilkan seluruh job di atas dengan timestamp segar.
- [ ] `BACKUP_OFFSITE_*` terisi di env produksi (backup off-site aktif) — lihat bagian (2) dan `docs/BACKUP_RESTORE.md`.

## 6. Bila container gagal start atau migrasi gagal

- **Validasi env gagal** → pesan menyebut variabel yang kurang (mis. `SMTP_HOST`/`N8N_EMAIL_WEBHOOK_URL`). Lengkapi lalu redeploy.
- **DB belum siap** → entrypoint retry 30× (∓60 detik). Bila tetap gagal, cek host/port/kredensial DB.
- **Migrasi gagal** → **jangan** memakai `DOKPLOY_DB_PUSH_ON_START=true` (itu `prisma db push --accept-data-loss`, bisa menghapus data). Ikuti prosedur rollback di `docs/MARIADB_MIGRATION_RUNBOOK.md`.

## 7. Rollback singkat

1. **Tag setiap release sebelum deploy** agar rollback reproducible: `git tag release-$(date +%Y%m%d-%H%M) && git push --tags`. Catat tag di catatan deploy.
2. Stop service web.
3. Restore backup database terakhir (bila skema ikut bermasalah; migrasi bersifat additive sehingga biasanya cukup rollback kode).
4. Deploy ulang dari tag release sebelumnya (Dokploy: pilih branch/commit tag di deploy settings, atau `git checkout <tag>` bila build dari source).
5. Cek `/api/health/ready`, lalu smoke test ringkas.
