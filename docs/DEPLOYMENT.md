# Deployment Runbook

Runbook ini mengikuti arsitektur satu aplikasi Next.js di belakang Nginx + PM2 + MariaDB lokal/private. Untuk deployment berbasis Dokploy dengan database terpisah, gunakan `docs/DOKPLOY.md`.

Panduan terkait: `docs/REDEPLOY_CHECKLIST.md` (agar semua fitur aktif setelah redeploy, termasuk flag & cron), `docs/MARIADB_MIGRATION_RUNBOOK.md` (migrasi + parity database).

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

**File jadwal lengkap siap-pakai: `deploy/cron/limo.crontab`** — memuat SELURUH 11 job dengan jadwal WIB konkret. Cron **tidak terpasang otomatis** oleh redeploy Dokploy; pemasangan adalah langkah manual wajib (lihat juga `docs/REDEPLOY_CHECKLIST.md`). Pilih SATU model:

**Model A — Host/VPS (app berjalan langsung via npm/PM2):**

```bash
crontab -u <user-app> deploy/cron/limo.crontab   # sesuaikan APP_DIR di file
crontab -l -u <user-app>                          # verifikasi
```

**Model B — Docker/Dokploy:** daftarkan tiap perintah di fitur **Schedules** Dokploy (dieksekusi dalam container), atau dari crontab host via `docker exec -w /app <container> npm run ...`. Jadwalnya sama persis dengan file crontab.

Ringkasan jadwal (semua pakai `flock -n` anti-dobel, idempoten):

| Job | Jadwal (WIB) | Lock |
|---|---|---|
| `notifications:retry -- --limit=50` | setiap menit | `limo-notification-retry` |
| `pengumuman:publish` | setiap menit | `limo-pengumuman-publish` |
| `quiz:finalize` | setiap menit | `limo-quiz-finalize` |
| `mayar:reconcile -- --limit=50` | `*/30 * * * *` | `limo-mayar-reconcile` |
| `pakasir:reconcile -- --limit=50` | `7,37 * * * *` | `limo-pakasir-reconcile` |
| `backup:create` | harian 02:00 | `limo-backup` |
| `sessions:cleanup` | harian 03:15 | `limo-session-cleanup` |
| `billing:mark-overdue` | harian 06:00 | `limo-overdue` |
| `reminders:send` | harian 07:00 | `limo-deadline-reminders` |
| `reminders:invoices` | harian 07:10 | `limo-invoice-reminders` |
| `billing:generate -- --period="$(date +\%Y-\%m)" --due-date="$(date +\%Y-\%m-10)"` | bulanan tgl 1, 00:30 | `limo-invoice` |

Catatan penting:

- Jadwalkan `notifications:retry` **setiap menit** (senyap saat idle). `reminders:send` dan `reminders:invoices` harian pagi WIB untuk reminder deadline tugas/ujian dan tagihan (H-3/H-1/jatuh tempo/terlambat) lewat email + WhatsApp ke wali.
- Jadwalkan `pengumuman:publish` **setiap menit**: mengirim notifikasi untuk pengumuman kelas berjadwal yang sudah lewat waktu terbit. Idempoten (klaim atomik kolom `notifiedAt`); tampilan pengumuman tidak bergantung pada job karena visibilitas dihitung dari `publishAt`/`expiresAt` saat query.
- Jadwalkan `quiz:finalize` **setiap menit** (idempoten): menilai draf kuis publik yang ditinggalkan melewati grace window 20 detik sehingga respons kedaluwarsa terselesaikan otomatis (`NEEDS_REVIEW` bila ada jawaban manual) tanpa menunggu input.
- Jadwalkan `mayar:reconcile` dan `pakasir:reconcile` **tiap 30 menit**: mengonfirmasi pembayaran PENDING langsung ke API provider (jaring pengaman bila webhook gagal; webhook tetap jalur utama).
- Jadwalkan `backup:create` **harian** (02:00 WIB). Isi `BACKUP_OFFSITE_*` (lihat `docs/BACKUP_RESTORE.md`) agar salinan off-site otomatis diunggah; tanpa itu backup hanya tersimpan lokal di `BACKUP_DIR` dan job tetap sukses. Uji `npm run backup:restore` ke target staging secara berkala.
- **Verifikasi pasca-deploy**: job mencatat jejak di tabel `JobRun` — cek baris terbaru per job (`SELECT name, status, finishedAt FROM JobRun ORDER BY finishedAt DESC LIMIT 20;`) atau periksa log `/var/log/limo-*.log`.

## Rollback

- Simpan artefak release sebelumnya.
- Backup database sebelum migration.
- Rollback kode dapat dilakukan dengan restore release sebelumnya dan reload PM2.
- Migration destructive membutuhkan rencana manual; jangan otomatis rollback schema tanpa validasi data.
