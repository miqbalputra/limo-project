# Deployment Checklist

Gunakan checklist ini sebelum production/UAT staging.

## Environment

- [ ] `NODE_ENV=production`.
- [ ] `APP_URL` memakai HTTPS domain final.
- [ ] `DATABASE_URL` mengarah MariaDB private/local.
- [ ] `SESSION_SECRET` acak minimal 32 karakter.
- [ ] `PRIVATE_STORAGE_PATH` di luar repository dan di luar `public/`.
- [ ] `PAKASIR_PROJECT` dan `PAKASIR_WEBHOOK_SECRET` sesuai sandbox/production.
- [ ] Tidak ada secret dengan prefix `NEXT_PUBLIC_`.

## Database

- [ ] Backup database sebelum migration.
- [ ] `npx prisma generate` berhasil.
- [ ] `npx prisma migrate deploy` berhasil.
- [ ] Seed development tidak dijalankan di production.

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

## Backup

- [ ] Backup database harian terjadwal.
- [ ] Backup private storage terjadwal.
- [ ] Restore drill berhasil diuji.
