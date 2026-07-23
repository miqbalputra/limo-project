# Deployment Runbook

Runbook ini mengikuti arsitektur satu aplikasi Next.js di belakang Nginx + PM2 + MariaDB lokal/private. Untuk staging/demo berbasis Dokploy, gunakan `docs/DOKPLOY.md`.

## Persiapan VPS

- Node.js 22+ dan npm 10+.
- MariaDB 11 tidak diekspos ke internet.
- Nginx sebagai TLS termination dan reverse proxy.
- PM2 untuk proses aplikasi.
- User Linux khusus aplikasi.
- Direktori privat untuk upload, contoh `/var/lib/limo/private-storage`.
- Direktori backup database dan file privat dengan permission ketat.

## Build dan Release

1. Pull/upload release.
2. Pastikan `.env.production` tersedia dan hanya bisa dibaca user aplikasi.
3. Install dependency dari lockfile: `npm ci`.
4. Generate Prisma client: `npx prisma generate`.
5. Jalankan migration: `npx prisma migrate deploy`.
6. Build aplikasi: `npm run build`.
7. Reload PM2.
8. Cek health: `curl https://domain.example/api/health`.
9. Smoke test login dan flow utama.

## PM2

Contoh konsep:

```text
limo-web -> npm run start -> 127.0.0.1:3000
```

Gunakan satu instance terlebih dahulu untuk MVP.

## Nginx

Prinsip konfigurasi:

- Redirect HTTP ke HTTPS.
- Proxy hanya ke `127.0.0.1:3000`.
- Jangan expose `PRIVATE_STORAGE_PATH`.
- Jangan expose MariaDB.
- Rate limit endpoint rawan: login, pendaftaran, status lookup, upload, webhook.
- Payload limit normal kecil, upload disesuaikan batas PRD.

## Cron/Systemd Timer

Gunakan lock eksternal:

```text
flock -n /var/lock/limo-invoice.lock npm run billing:generate -- --period=YYYY-MM --due-date=YYYY-MM-10
flock -n /var/lock/limo-overdue.lock npm run billing:mark-overdue
flock -n /var/lock/limo-session-cleanup.lock npm run sessions:cleanup
flock -n /var/lock/limo-notification-retry.lock npm run notifications:retry -- --limit=50
```

Jadwal final mengikuti timezone operasional `Asia/Jakarta`.

## Rollback

- Simpan artefak release sebelumnya.
- Backup database sebelum migration.
- Rollback kode dapat dilakukan dengan restore release sebelumnya dan reload PM2.
- Migration destructive membutuhkan rencana manual; jangan otomatis rollback schema tanpa validasi data.
