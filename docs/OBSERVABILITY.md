# Observability

Prinsip LIMO: logging terstruktur sudah ada (JSON + requestId ke stdout, field sensitif otomatis di-redaksi di `src/server/logging/logger.ts`). Dokumen ini merangkum lapisan alerting bawaan dan langkah menambah pemantauan eksternal.

## Sudah bawaan (tanpa layanan eksternal)

1. **Alert in-app ke admin** — kegagalan berikut otomatis muncul di pusat notifikasi dashboard Admin (template `backup-failure` / `backup-warning` / `job-failure`):
   - Backup harian gagal berjalan, unggah off-site gagal, atau backup jalan **tanpa** `BACKUP_OFFSITE_*` (`scripts/backup.ts` → `notifyBackupOutcome`).
   - Rekonsiliasi Mayar gagal memproses pembayaran (`job-service.ts`, ditulis juga ke tabel `JobRun`).
   - dedupeKey otomatis membuat peringatan permanen tidak menumpuk.
2. **Health endpoint** — `/api/health` (liveness + `build.sha`), `/api/health/ready` (env + DB + storage privat, 503 bila tidak siap). Jadikan probe utama monitoring.
3. **Jejak job** — tabel `JobRun` mencatat setiap job terjadwal (nama, status, jumlah, error). Cek cepat: `SELECT name, status, MAX(finishedAt) FROM JobRun GROUP BY name;`

## Uptime monitoring eksternal (disarankan, ±10 menit setup)

Gunakan monitor publik gratis/berbayar (UptimeRobot, Better Stack, Healthchecks.io) dengan aturan:

- Monitor **HTTPS** ke `https://<domain>/api/health/ready` — interval 1–5 menit; alert saat status ≠ 200/503 flapping.
- Tambahkan monitor **heartbeat** untuk backup: buat check di Healthchecks.io, lalu di akhir job `backup:create` panggil URL ping-nya (curl) — bila backup tidak jalan, Anda menerima email.
- Alert channel: email admin + (opsional) grup WhatsApp sekolah.

## Error tracking (Sentry) — opsional

Bila ingin stack-trace otomatis:

1. Buat project di sentry.io → dapat DSN.
2. `npm install @sentry/nextjs` dan jalankan `npx @sentry/wizard@latest -i nextjs` (wizard menyuntik `sentry.client/server.config.ts` + `next.config.ts`).
3. Set `SENTRY_DSN` (+ `SENTRY_ORG`/`SENTRY_PROJECT` untuk source map) di env produksi — tanpa DSN, SDK no-op sehingga aman di dev.
4. `requestId` LIMO sudah dikirim sebagai tag — cocokkan dengan log container saat investigasi.

## Rotasi log Docker (wajib di VPS kecil)

Log container default **tanpa batas** dan dapat memenuhi disk. Set di daemon Docker (`/etc/docker/daemon.json`):

```json
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
```

Atau per-service di Dokploy (Advanced → logging options). Berlaku untuk container baru setelah recreate.

## Yang masih backlog

- Coverage measurement (istanbul/c8) untuk suite unit+integrasi.
- Grafana/Prometheus metrics — belum ada endpoint `/metrics`; kebutuhan belum mendesak pada skala satu sekolah.
