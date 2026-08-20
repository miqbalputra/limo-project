# Deploy Production LIMO di Dokploy

Runbook ini memakai arsitektur production yang direkomendasikan: satu Dokploy Application untuk LIMO dan satu database MariaDB terpisah yang dikelola Dokploy. Database tidak digabungkan ke Compose aplikasi dan tidak dibuka ke internet.

Gunakan file `.env.dokploy.external-db.example` sebagai checklist environment. Jangan menyalin secret contoh apa adanya dan jangan menyimpan secret production di Git.

## Arsitektur Target

| Komponen | Konfigurasi |
|---|---|
| Application | Git repository LIMO, build type Dockerfile, port internal `3000` |
| Database | Service MariaDB `11`, internal port `3306`, volume `/var/lib/mysql` |
| App private storage | Persistent volume ke `/app/storage/private` |
| App backup storage | Persistent volume ke `/app/backups` |
| Domain publik | Hanya diarahkan ke Application port `3000` |
| Database exposure | Internal credentials saja; jangan membuat external port |

`docker-compose.dokploy.yml` tetap tersedia untuk demo atau environment gabungan. Untuk deployment client production, gunakan Dockerfile Application dan database service terpisah seperti langkah di bawah.

## Prasyarat Sebelum Deploy

- Repository sudah berisi commit release yang akan dipakai dan branch yang benar, biasanya `main`.
- Dokploy server memiliki resource cukup untuk Next.js, MariaDB, dan volume upload.
- Domain final memiliki DNS `A`/`AAAA` ke server Dokploy.
- Kredensial SMTP atau workflow n8n sudah tersedia.
- Kredensial Mayar production dan webhook URL sudah siap jika pembayaran diaktifkan.
- Tentukan apakah deployment ini memakai database baru atau migrasi dari deployment lama.
- Jika ada data lama, buat backup database dan private storage sebelum menghapus atau mengganti service apa pun.

Jangan memakai database demo lama sebagai database client tanpa audit data. Deployment production harus memakai database baru atau database hasil restore yang sudah diverifikasi.

## 1. Buat Project dan Environment

Nama menu dapat sedikit berbeda antarversi Dokploy, tetapi konsepnya sama.

1. Buka `Projects` lalu buat project baru, misalnya `LIMO Production`.
2. Buat environment `production`.
3. Pastikan Application dan Database dibuat pada server, project, dan environment yang sama agar internal network dapat digunakan.
4. Jangan memasukkan credential database atau provider ke repository.

## 2. Buat Database Terpisah di Dokploy

### 2.1 Buat service database

1. Di environment `production`, pilih `Create Service` lalu pilih database `MariaDB`.
2. Gunakan image atau versi MariaDB `11`, agar sama dengan schema dan image development LIMO.
3. Beri nama service, misalnya `limo-db`.
4. Isi database awal:

   - Database name: `limo_db`
   - Database user: `limo_app`
   - Database password: password acak yang panjang
   - Root password: password acak yang berbeda

5. Tambahkan persistent volume database ke `/var/lib/mysql`.
6. Jangan menambahkan external port atau domain untuk database.
7. Deploy service database dan tunggu statusnya `running`/`healthy`.

### 2.2 Ambil koneksi internal

1. Buka service `limo-db`, lalu buka `Connection` atau `Internal Credentials`.
2. Catat `Internal Host`, `Internal Port`, database name, username, dan password.
3. Gunakan nilai tersebut hanya pada environment Application.
4. Isi `DB_HOST` dengan hostname saja. Jangan menambahkan `mysql://`, `http://`, atau `:3306`.
5. Isi `DB_PORT` dengan internal port yang ditampilkan Dokploy, biasanya `3306`.

LIMO akan membentuk `DATABASE_URL` sendiri dari `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, dan `DB_PASS`. Jika `DB_*` dan `DATABASE_URL` sama-sama tersedia, `DB_*` diprioritaskan.

## 3. Buat Application LIMO

1. Pilih `Create Service` lalu `Application`.
2. Hubungkan Git provider dan pilih repository LIMO.
3. Pilih branch release, misalnya `main`.
4. Pilih build type `Dockerfile`.
5. Isi konfigurasi build:

   - Dockerfile path: `Dockerfile`
   - Build context: repository root atau `.`
   - Exposed/internal port: `3000`
   - Start command: biarkan default dari Dockerfile

6. Deploy Database lebih dulu, lalu deploy Application.

`docker-entrypoint.sh` akan menunggu database siap, menjalankan `prisma migrate deploy`, lalu menjalankan `npm run start`. Jangan mengganti start command menjadi `next start` langsung karena entrypoint diperlukan untuk migration dan pembentukan connection string.

## 4. Tambahkan Persistent Volume Application

Di konfigurasi volume Application, buat volume persistent berikut:

| Volume | Mount path | Kegunaan |
|---|---|---|
| `limo-private-storage` | `/app/storage/private` | Dokumen pendaftaran, materi, RPP, dan file submission |
| `limo-backups` | `/app/backups` | Artefak `database.sql` dan `backup.zip` |

`PRIVATE_STORAGE_PATH` harus tetap `/app/storage/private` dan `BACKUP_DIR` harus tetap `/app/backups`. Jangan mount private storage ke folder `public`.

## 5. Isi Environment Application

Salin struktur dari `.env.dokploy.external-db.example` ke Environment Variables Application, lalu ganti seluruh placeholder.

### 5.1 Core dan database

```env
NODE_ENV=production
LIMO_DEMO_MODE=false
APP_URL=https://limo.example.com
DB_HOST=internal-host-dari-service-limo-db
DB_PORT=3306
DB_NAME=limo_db
DB_USER=limo_app
DB_PASS=secret-database
SESSION_SECRET=secret-acak-minimal-32-karakter
SESSION_COOKIE_NAME=limo_session
SESSION_ABSOLUTE_DAYS=30
SESSION_IDLE_MINUTES=10080
PRIVATE_STORAGE_PATH=/app/storage/private
BACKUP_DIR=/app/backups
BACKUP_RETENTION_DAYS=14
BACKUP_WEBHOOK_SECRET=secret-backup-acak-minimal-32-karakter
```

### 5.2 Feature flag

Jika seluruh modul yang sudah disetujui client akan dibuka pada release ini, gunakan:

```env
STUDENT_PORTAL_ENABLED=true
LEARNING_MODULES_ENABLED=true
ASSIGNMENTS_ENABLED=true
GRADEBOOK_ENABLED=true
CALENDAR_ENABLED=true
ACTIVITY_COMPLETION_ENABLED=true
REMEDIAL_ENABLED=true
CLASS_DISCUSSION_ENABLED=true
PERIODIC_REPORTS_ENABLED=true
GUARDIAN_ASSISTED_SUBMISSION_ENABLED=false
```

Jika suatu modul belum termasuk scope final, ubah flag modul tersebut menjadi `false`. `GUARDIAN_ASSISTED_SUBMISSION_ENABLED` tetap `false` kecuali sudah ada UAT dan kebijakan akses yang jelas.

### 5.3 Pembayaran Mayar

```env
MAYAR_ENV=production
MAYAR_BASE_URL=
MAYAR_API_KEY=isi-credential-mayar-production
MAYAR_MERCHANT_ID=isi-merchant-id
MAYAR_WEBHOOK_SECRET=isi-secret-webhook-mayar
PAYMENT_CONFIG_ENCRYPTION_KEY=isi-base64-key-32-byte
```

Atur webhook Mayar ke endpoint:

```text
https://limo.example.com/api/v1/webhooks/mayar
```

Setelah deploy, konfigurasi Mayar dan/atau Pakasir melalui menu Admin → Pembayaran → Integrasi Pembayaran. `PAYMENT_CONFIG_ENCRYPTION_KEY` wajib stabil karena digunakan untuk membuka credential yang disimpan dari dashboard. URL webhook Pakasir tersedia pada halaman yang sama:

```text
https://limo.example.com/api/v1/webhooks/pakasir?secret=<PAKASIR_WEBHOOK_SECRET>
```

### 5.4 Notifikasi

Pilih salah satu provider. Production tidak boleh memakai `console`.

Untuk SMTP:

```env
NOTIFICATION_PROVIDER=email
NEXT_PUBLIC_LIMO_CONTACT_EMAIL=admin@limo.example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_FROM=no-reply@limo.example.com
SMTP_USER=no-reply@limo.example.com
SMTP_PASSWORD=isi-password-smtp
```

Untuk n8n:

```env
NOTIFICATION_PROVIDER=n8n
NEXT_PUBLIC_LIMO_CONTACT_EMAIL=admin@limo.example.com
N8N_EMAIL_WEBHOOK_URL=https://n8n.example.com/webhook/limo-email
N8N_WHATSAPP_WEBHOOK_URL=https://n8n.example.com/webhook/limo-whatsapp
N8N_WEBHOOK_SECRET=secret-n8n-acak
```

### 5.5 Guardrail production

Pastikan variable berikut tetap seperti ini:

```env
DOKPLOY_SEED_ON_START=false
LIMO_ALLOW_DEMO_SEED=false
DOKPLOY_DB_PUSH_ON_START=false
DOKPLOY_SQLITE_DEMO=false
```

Jangan mengaktifkan `DOKPLOY_DB_PUSH_ON_START=true` pada database client. Flag tersebut menggunakan `prisma db push --accept-data-loss` dan hanya boleh dipakai untuk demo disposable setelah ada persetujuan eksplisit.

## 6. Domain dan Health Check

1. Tambahkan domain final ke Application, misalnya `limo.example.com`.
2. Arahkan domain ke Application port `3000`, bukan ke service database.
3. Aktifkan HTTPS certificate dan redirect HTTP ke HTTPS.
4. Gunakan readiness endpoint berikut untuk health check Dokploy:

```text
GET /api/health/ready
```

Endpoint tersebut memeriksa environment, koneksi database, dan private storage. Endpoint liveness yang lebih ringan adalah:

```text
GET /api/health
```

Dockerfile juga sudah memiliki `HEALTHCHECK` ke `/api/health/ready`.

## 7. Deploy dan Verifikasi Migration

1. Deploy database dan tunggu sampai sehat.
2. Deploy Application.
3. Baca deployment log dan pastikan terdapat pesan `Using split database settings`.
4. Pastikan `prisma migrate deploy` selesai tanpa error.
5. Pastikan Next.js listen pada `0.0.0.0:3000` dan deployment menjadi `healthy`.
6. Buka `https://limo.example.com/api/health`; hasil harus HTTP `200`.
7. Buka `https://limo.example.com/api/health/ready`; hasil harus HTTP `200` dengan semua check `ok`.

Jangan menjalankan `prisma migrate dev`, `prisma db push`, atau seed demo pada database production.

## 8. Buat Admin Production Satu Kali

Production tidak memakai akun seed `admin@limo.local`. Setelah Application berhasil terhubung ke database kosong, buka terminal container Application di Dokploy dan jalankan:

```sh
export LIMO_ALLOW_ADMIN_BOOTSTRAP=true
export LIMO_BOOTSTRAP_ADMIN_EMAIL=admin@client.example.com
export LIMO_BOOTSTRAP_ADMIN_NAME="Admin LIMO"
export LIMO_BOOTSTRAP_ADMIN_PASSWORD='buat-password-kuat-minimal-12-karakter'
npm run admin:bootstrap
unset LIMO_ALLOW_ADMIN_BOOTSTRAP LIMO_BOOTSTRAP_ADMIN_EMAIL LIMO_BOOTSTRAP_ADMIN_NAME LIMO_BOOTSTRAP_ADMIN_PASSWORD
```

Script hanya bekerja jika `LIMO_ALLOW_ADMIN_BOOTSTRAP=true`, menolak jika sudah ada admin, dan tidak menimpa user yang sudah ada. Environment bootstrap harus dihapus segera setelah command berhasil.

Login dengan admin tersebut, lalu:

1. Ganti password jika diperlukan.
2. Buat akun Guru dan Wali dari menu Admin.
3. Atur program, level, kelas, tarif, dan data master client.
4. Kirim atau uji link aktivasi akun melalui provider notifikasi production.
5. Jangan menggunakan akun `*.local` dari seed demo.

## 9. Smoke Test Client

- Landing page, kontak, program, kebijakan privasi, dan syarat penggunaan tampil benar.
- Pendaftaran publik menghasilkan kode pendaftaran.
- Status pendaftaran dapat dicek menggunakan kode dan email Wali.
- Admin dapat meninjau dan menyetujui pendaftaran.
- Admin dapat membuat Guru dan Wali.
- Guru hanya melihat kelas yang ditugaskan.
- Guru dapat membuat materi, sesi, presensi, progres, RPP, ujian, tugas, dan nilai sesuai feature flag.
- Wali hanya melihat anak yang terhubung.
- Upload dan download file authorized berhasil.
- File privat tidak dapat diakses melalui URL public langsung.
- Endpoint pembayaran dan webhook diuji pada environment yang sesuai.
- Email atau workflow n8n menerima notifikasi uji.
- Browser desktop dan mobile tidak menampilkan error console yang menghambat flow utama.

## 10. Backup dan Operasional

1. Aktifkan backup terjadwal pada service database Dokploy.
2. Pastikan volume `/app/storage/private` ikut dibackup; backup database saja tidak mencakup file upload.
3. Jadwalkan endpoint internal backup melalui n8n atau worker terpisah:

```text
POST /api/internal/backup
Authorization: Bearer BACKUP_WEBHOOK_SECRET
```

4. Simpan `database.sql` dan `backup.zip` ke storage off-site.
5. Uji restore pada database dan storage staging kosong sebelum menyatakan backup valid.
6. Jalankan job billing, cleanup session, reminder, dan retry notifikasi dari scheduler terpisah; jangan menjalankan cron di lifecycle web container.

## 11. Redeploy dan Rollback

- Untuk rilis kode baru, deploy ulang Application saja.
- Jangan menghapus atau recreate service database ketika hanya ingin redeploy aplikasi.
- Backup database sebelum release yang membawa migration.
- `prisma migrate deploy` berjalan otomatis saat container start.
- Jika migration gagal, perbaiki penyebabnya dan deploy ulang; jangan langsung memakai `db push`.
- Rollback image aplikasi tidak otomatis me-rollback schema database. Migration destructive membutuhkan rencana manual.

## Troubleshooting

### `P1001`, `P1008`, atau database tidak terjangkau

- Pastikan database sudah `healthy`.
- Pastikan Application dan Database berada pada network/server Dokploy yang sama.
- Pastikan `DB_HOST` memakai `Internal Host` Dokploy, bukan external host.
- Pastikan `DB_PORT` adalah internal port, biasanya `3306`.
- Pastikan database name, user, dan password sama dengan Connection panel.

### `P3009` migration sebelumnya gagal

- Baca log migration untuk menemukan migration yang gagal.
- Backup database sebelum perbaikan.
- Jangan mengaktifkan `DOKPLOY_DB_PUSH_ON_START` pada production.

### `Invalid application environment`

- Pastikan `APP_URL` adalah URL HTTPS yang valid.
- Production memerlukan credential Mayar.
- `NOTIFICATION_PROVIDER=email` memerlukan SMTP.
- `NOTIFICATION_PROVIDER=n8n` memerlukan tiga variable n8n.

### Readiness check gagal pada `privateStorage`

- Pastikan volume terpasang ke `/app/storage/private`.
- Pastikan `PRIVATE_STORAGE_PATH` sama dengan mount path.
- Pastikan container user dapat menulis ke volume.

### Halaman 502 atau container unhealthy

- Pastikan exposed port Application `3000`.
- Jangan mengarahkan domain ke port database.
- Jangan mengganti entrypoint Dockerfile.

## Referensi Repository

- `.env.dokploy.external-db.example`: template environment production dengan database terpisah.
- `Dockerfile`: build image dan health check.
- `docker-entrypoint.sh`: pembentukan URL database dan migration startup.
- `scripts/bootstrap-admin.ts`: bootstrap admin production satu kali.
- `docs/ENVIRONMENT.md`: seluruh environment variable.
- `docs/BACKUP_RESTORE.md`: backup database dan private storage.
- `docs/DEPLOYMENT_CHECKLIST.md`: checklist sebelum go-live.
