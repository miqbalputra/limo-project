# Backup and Restore

LIMO membuat dua artefak backup dalam satu folder run:

- `database.sql`: dump MariaDB yang siap di-import ke database target.
- `backup.zip`: berisi `database.sql`, seluruh private storage, `manifest.json`, dan SHA-256 checksum setiap file.

Backup lokal disimpan pada `BACKUP_DIR` dan volume backup harus persistent. Salinan lokal bukan pengganti salinan off-site.

## Environment

```env
BACKUP_DIR=/app/backups
BACKUP_RETENTION_DAYS=14
BACKUP_WEBHOOK_SECRET=ganti-dengan-secret-acak-minimal-32-karakter
```

`BACKUP_WEBHOOK_SECRET` hanya digunakan oleh endpoint internal yang dipanggil n8n. Jangan memakai `N8N_WEBHOOK_SECRET` yang sama.

## Off-site Otomatis (S3-compatible)

Selain workflow n8n, aplikasi dapat mengunggah `backup.zip` + `manifest.json` langsung ke storage off-site yang kompatibel S3 (AWS S3, Cloudflare R2, MinIO) menggunakan SigV4 tanpa dependency tambahan. Isi variabel berikut (semua wajib agar off-site aktif):

```env
BACKUP_OFFSITE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
BACKUP_OFFSITE_BUCKET=limo-backups
BACKUP_OFFSITE_REGION=us-east-1
BACKUP_OFFSITE_ACCESS_KEY_ID=...
BACKUP_OFFSITE_SECRET_ACCESS_KEY=...
BACKUP_OFFSITE_PREFIX=limo-backups
```

Catatan:

- `BACKUP_OFFSITE_ENDPOINT` memakai path-style URL (`<endpoint>/<bucket>/<key>`) — kompatibel R2, MinIO, dan S3 region endpoint. Untuk AWS S3 gunakan endpoint regional seperti `https://s3.us-east-1.amazonaws.com`.
- Untuk R2, `BACKUP_OFFSITE_REGION` boleh dibiarkan `us-east-1` (R2 mengabaikannya).
- Saat off-site aktif, `npm run backup:create` dan `POST /api/internal/backup` otomatis mengunggah setelah backup lokal selesai. Jika unggah gagal, command keluar dengan error (exit non-zero / HTTP 500) meski artefak lokal tetap tersimpan — jangan abaikan: backup dianggap sukses hanya jika salinan off-site berhasil.
- Objek disimpan pada `<prefix>/<backupId>/backup.zip` dan `<prefix>/<backupId>/manifest.json`.
- Catatan keamanan: gunakan credential dengan hak tulis-saja (write-only) pada bucket khusus backup, dan aktifkan lifecycle/retention di sisi bucket agar salinan off-site tidak bisa dihapus dari aplikasi.

## Manual Backup

```bash
npm run backup:create
```

Contoh output:

```text
/app/backups/20260805T020000Z/database.sql
/app/backups/20260805T020000Z/backup.zip
```

Backup memakai `mariadb-dump` atau `mysqldump` dengan `--single-transaction`, routines, triggers, dan hex blob. Aplikasi production image sudah menyediakan `mariadb-client`, `zip`, dan `unzip`.

## Import SQL

Restore SQL ke database kosong atau database staging yang sudah disiapkan:

```bash
mariadb --host=127.0.0.1 --port=3306 --user=limo --password limo_db < database.sql
```

Gunakan database target yang sengaja dibuat untuk restore. Jangan mengarahkan command ini ke production aktif tanpa backup dan maintenance window.

## Restore ZIP

Restore membutuhkan konfirmasi eksplisit, URL database target, dan path storage target. Ini mencegah salah restore ke database/path aplikasi yang sedang berjalan.

```bash
npm run backup:restore -- \
  /app/backups/20260805T020000Z/backup.zip \
  --confirm=RESTORE_LIMO_BACKUP \
  --target-database-url='mysql://limo:password@127.0.0.1:3306/limo_restore' \
  --target-storage-path=/app/storage/restore-private
```

Restore akan:

1. Memvalidasi entry ZIP agar tidak ada path traversal.
2. Memvalidasi manifest dan SHA-256 semua file.
3. Meng-import `database.sql` ke database target.
4. Mengganti isi target private storage dengan isi backup.

Lakukan restore drill pada database dan storage staging kosong. Backup dianggap valid hanya setelah login, download file privat, pendaftaran, presensi, nilai, dan tagihan berhasil diuji.

## n8n Scheduled Workflow

Endpoint internal yang dipanggil n8n:

```text
POST /api/internal/backup
Authorization: Bearer BACKUP_WEBHOOK_SECRET
```

Response berisi `backupId`, `sqlDownloadPath`, dan `zipDownloadPath`. Endpoint download juga membutuhkan header Authorization:

```text
GET /api/internal/backup/download?backupId=...&format=sql
GET /api/internal/backup/download?backupId=...&format=zip
```

Konfigurasi workflow n8n:

1. `Schedule Trigger`: setiap hari pukul 02:00, timezone `Asia/Jakarta`.
2. `HTTP Request`: `POST` ke `https://limo.example.com/api/internal/backup` dengan Bearer `BACKUP_WEBHOOK_SECRET`; timeout minimal 30 menit.
3. `HTTP Request`: `GET` ke `APP_URL + data.sqlDownloadPath`, response format `File`.
4. `HTTP Request`: `GET` ke `APP_URL + data.zipDownloadPath`, response format `File`.
5. Upload kedua binary ke S3-compatible storage, Google Drive, atau storage off-site lain menggunakan node credential n8n.
6. Kirim notifikasi sukses/gagal ke Admin melalui email atau WhatsApp.


## Retention and Security

- Default retention lokal adalah 14 hari; ubah `BACKUP_RETENTION_DAYS` sesuai kebutuhan RPO.
- Backup directory dan private storage harus memakai volume persistent dengan permission ketat.
- Endpoint backup tidak menyediakan list backup dan tidak boleh dipublikasikan tanpa HTTPS serta secret Bearer.
- Simpan minimal satu salinan off-site dan uji restore secara berkala.
- Jangan mencetak `DATABASE_URL`, password, atau `BACKUP_WEBHOOK_SECRET` ke log n8n.
