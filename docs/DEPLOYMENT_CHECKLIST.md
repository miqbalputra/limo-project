# Deployment Checklist

Gunakan checklist ini sebelum production/UAT staging.

## Environment

- [ ] `NODE_ENV=production`.
- [ ] `APP_URL` memakai HTTPS domain final.
- [ ] `DATABASE_URL` mengarah MariaDB private/local.
- [ ] `SESSION_SECRET` acak minimal 32 karakter.
- [ ] `PRIVATE_STORAGE_PATH` di luar repository dan di luar `public/`.
- [ ] `MAYAR_ENV`, `MAYAR_API_KEY`, `MAYAR_MERCHANT_ID`, dan `MAYAR_WEBHOOK_SECRET` sesuai sandbox/production.
- [ ] `NOTIFICATION_PROVIDER=email` untuk production.
- [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM`/`SMTP_USER`, dan `SMTP_PASSWORD` valid.
- [ ] Tidak ada secret dengan prefix `NEXT_PUBLIC_`.

## Database

- [ ] Backup database sebelum migration.
- [ ] `npx prisma generate` berhasil.
- [ ] `npx prisma migrate deploy` berhasil.
- [ ] Seed development tidak dijalankan di production.
- [ ] Volume `BACKUP_DIR` persistent dan hanya dapat diakses service yang diperlukan.

## Build

- [ ] `npm ci` dari lockfile.
- [ ] `npm run typecheck` lulus.
- [ ] `npm run lint` lulus.
- [ ] `npm test` lulus.
- [ ] `npm run build` lulus.

## Security

- [ ] HTTPS aktif.
- [ ] MariaDB tidak terbuka publik.
- [ ] Private storage tidak diekspos Nginx.
- [ ] Rate limit Nginx untuk login, pendaftaran, upload, webhook.
- [ ] Payload limit upload sesuai PRD.
- [ ] Security headers aktif.

## Smoke Test

- [ ] `/api/health` 200.
- [ ] Login Admin berhasil.
- [ ] Pendaftaran publik berhasil.
- [ ] Upload dokumen berhasil dan tidak tersedia lewat URL public.
- [ ] Guru hanya melihat kelas sendiri.
- [ ] Wali hanya melihat anak sendiri.
- [ ] Generate tagihan dry-run berhasil.
- [ ] Webhook fixture valid berhasil di staging.
- [ ] `npm run notifications:retry -- --dry-run` berhasil.
- [ ] Email test staging benar-benar diterima inbox tujuan.

## Backup

- [ ] Backup database harian terjadwal.
- [ ] Backup private storage terjadwal.
- [ ] n8n mengunduh `database.sql` dan `backup.zip` ke storage off-site.
- [ ] Restore drill berhasil diuji.
