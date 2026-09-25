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
- Mayar produksi: `MAYAR_ENV=production`, `MAYAR_API_KEY`, `MAYAR_MERCHANT_ID`, `MAYAR_WEBHOOK_SECRET`.
- `DOKPLOY_SEED_ON_START=false` dan `DOKPLOY_DB_PUSH_ON_START=false` (nilai `true` akan ditolak/di-bypass migrasi dan berbahaya di produksi).

## 2. Env khusus fitur baru (delta yang paling sering terlewat)

Tanpa ini, fitur baru akan tampak "hilang" (menu tidak muncul / 404) walau kodenya benar:

```env
# Ujian mandiri siswa + rilis nilai per attempt
STUDENT_SELF_EXAM_ENABLED=true
# Pengumuman (kelas & sekolah) + diskusi kelas (+ menu /admin/pengumuman, /admin/diskusi-laporan)
CLASS_DISCUSSION_ENABLED=true
# Batas unggahan jawaban kuis (MB). 0 = tanpa batas (tidak disarankan)
MAX_QUIZ_UPLOAD_MB=25
```

Catatan:
- `STUDENT_SELF_EXAM_ENABLED` hanya berguna bila `STUDENT_PORTAL_ENABLED=true`.
- Fitur lain (`voucher`, `kuitansi`, `sertifikat`, `rekaman suara`) **tidak butuh flag**.
- Template `.env.dokploy.external-db.example` sudah diperbarui ke nilai di atas.

## 3. Langkah redeploy (Dokploy)

1. Pastikan env di dashboard Dokploy sudah memuat nilai bagian (2) di atas.
2. **Redeploy** service `web` (build ulang image) — jangan sekadar restart.
3. Tunggu log startup: cari `prisma migrate deploy` sukses dan `Ready`.
4. Cek health: `curl -s https://<domain>/api/health/ready` → status `ok`.

## 4. Verifikasi pasca-deploy (semua peran)

- **Health**: `/api/health/ready` mengembalikan 200.
- **Admin**: menu **Pengumuman** dan **Laporan Diskusi** muncul; buka `/admin/pengumuman` → buat pengumuman sekolah; `/admin/tagihan` → buat voucher + lihat kuitansi pada tagihan lunas.
- **Guru**: `/guru/kuis` → buat ujian; `/guru/ujian/<id>/hasil` → tombol **Rilis nilai** ada.
- **Siswa**: menu **Ujian** muncul → kerjakan ujian → **rekam suara** (uji mikrofon) → kirim.
- **Wali**: `/wali/pengumuman`, `/wali/diskusi` (balas thread), `/wali/tagihan` (pakai voucher → rekonsiliasi admin → unduh kuitansi PDF).
- **Migrasi**: di dalam container, `npx prisma migrate status` → "Database schema is up to date!".
- (Opsional) parity: `npm run db:parity` → harus `N/N pemeriksaan lulus`.

## 5. Cron yang perlu didaftarkan

- `pengumuman:publish` — **setiap menit** (idempoten). Wajib agar notifikasi pengumuman berjadwal terkirim. Tampilan pengumuman tetap muncul walau cron belum jalan (visibilitas dihitung saat query).
- Job lain (lihat `docs/DEPLOYMENT.md`): `notifications:retry` tiap menit; `reminders:send`, `reminders:invoices` harian; `billing:generate`, `billing:mark-overdue`, `sessions:cleanup` sesuai jadwal; `quiz:finalize` untuk draf kuis kedaluwarsa.

## 6. Bila container gagal start atau migrasi gagal

- **Validasi env gagal** → pesan menyebut variabel yang kurang (mis. `SMTP_HOST`/`N8N_EMAIL_WEBHOOK_URL`). Lengkapi lalu redeploy.
- **DB belum siap** → entrypoint retry 30× (∓60 detik). Bila tetap gagal, cek host/port/kredensial DB.
- **Migrasi gagal** → **jangan** memakai `DOKPLOY_DB_PUSH_ON_START=true` (itu `prisma db push --accept-data-loss`, bisa menghapus data). Ikuti prosedur rollback di `docs/MARIADB_MIGRATION_RUNBOOK.md`.

## 7. Rollback singkat

1. Stop service web.
2. Restore backup database terakhir.
3. Deploy ulang image release sebelumnya.
4. Cek `/api/health/ready`, lalu smoke test ringkas.
