# Dokploy Deployment

Gunakan ini untuk staging/demo client. Jangan pakai data pribadi asli sebelum hardening production final selesai.

## Opsi A: Dockerfile App + Database Dokploy

1. Buat application dari Git repository.
2. Pilih Dockerfile build.
3. Set exposed port ke `3000`.
4. Buat MariaDB service internal di Dokploy.
5. Tambahkan persistent storage untuk `/app/storage/private`.
6. Isi environment aplikasi:

```env
NODE_ENV=production
APP_URL=https://limo-demo.example.com
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/limo_db
SESSION_SECRET=replace-with-random-secret-minimum-32-chars
SESSION_COOKIE_NAME=limo_session
SESSION_ABSOLUTE_DAYS=30
SESSION_IDLE_MINUTES=10080
PRIVATE_STORAGE_PATH=/app/storage/private
MAX_REGISTRATION_FILE_MB=10
MAX_MATERIAL_FILE_MB=25
NOTIFICATION_PROVIDER=console
NEXT_PUBLIC_LIMO_CONTACT_EMAIL=admin@limo.local
DOKPLOY_SEED_ON_START=false
```

Container menjalankan `prisma migrate deploy` otomatis sebelum `npm run start`.

Untuk demo sementara, jika migration pernah gagal dan database masih memblokir startup dengan `P3009`, gunakan sementara:

```env
DOKPLOY_DB_PUSH_ON_START=true
```

Mode ini menjalankan `prisma db push --accept-data-loss`, bukan migration deploy. Gunakan hanya untuk staging/demo disposable, bukan production final.

## Opsi B: Compose

Gunakan `docker-compose.dokploy.yml` jika ingin app dan MariaDB dikelola bersama oleh Dokploy Compose.

1. Pakai file compose `docker-compose.dokploy.yml`.
2. Salin nilai dari `.env.dokploy.example` ke environment Dokploy.
3. Pastikan domain HTTPS diarahkan ke service `web` port `3000`.
4. Jangan expose service `mariadb` ke internet.

## Seed Demo

Jika database masih kosong dan butuh akun demo, set sementara:

```env
DOKPLOY_SEED_ON_START=true
```

Set kembali ke `false` setelah deploy pertama berhasil.

Akun seed:

```text
admin@limo.local / password-dev-only
guru@limo.local / password-dev-only
wali@limo.local / password-dev-only
```

Untuk demo publik, segera ganti password setelah login.

## Smoke Test

1. Buka `/api/health`, pastikan HTTP 200.
2. Login Admin.
3. Coba pendaftaran publik.
4. Upload dokumen dan pastikan file tidak bisa diakses dari URL publik.
