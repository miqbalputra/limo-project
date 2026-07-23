# Environment Variables

Dokumen ini menjelaskan variable yang dibutuhkan aplikasi LIMO. Jangan menaruh secret production di repository.

| Variable | Wajib | Keterangan |
|---|---:|---|
| `NODE_ENV` | Ya | `development`, `test`, atau `production` |
| `APP_URL` | Ya | Origin aplikasi, misalnya `https://limo.example.com` |
| `DATABASE_URL` | Ya | MariaDB connection string Prisma |
| `SESSION_SECRET` | Ya | Secret acak minimal 32 karakter |
| `SESSION_COOKIE_NAME` | Ya | Default `limo_session` |
| `SESSION_ABSOLUTE_DAYS` | Ya | Masa berlaku absolut session, default 30 hari |
| `SESSION_IDLE_MINUTES` | Ya | Idle timeout session, default 10080 menit (7 hari) |
| `PRIVATE_STORAGE_PATH` | Ya | Path privat di luar `public/` dan tidak diekspos Nginx |
| `MAX_REGISTRATION_FILE_MB` | Ya | Default 10 |
| `MAX_MATERIAL_FILE_MB` | Ya | Default 25 |
| `PAKASIR_PROJECT` | Untuk payment | Project/merchant identifier Pakasir |
| `PAKASIR_API_KEY` | Untuk payment | API key Pakasir, tidak boleh `NEXT_PUBLIC_` |
| `PAKASIR_WEBHOOK_SECRET` | Untuk webhook | Secret HMAC webhook Pakasir |
| `NOTIFICATION_PROVIDER` | Ya | Saat ini `console`; email/whatsapp menyusul |
| `NEXT_PUBLIC_LIMO_CONTACT_EMAIL` | Ya | Email kontak publik landing page; bukan secret |
| `SMTP_HOST` | Jika email | Host SMTP |
| `SMTP_PORT` | Jika email | Port SMTP |
| `SMTP_USER` | Jika email | Username SMTP |
| `SMTP_PASSWORD` | Jika email | Password SMTP |

## Development Seed

Untuk development tanpa Docker, jalankan `npm run sqlite:setup`. Perintah ini membuat schema SQLite turunan dan database disposable `prisma/dev.db`; schema production tetap MariaDB.

Seed development membuat akun:

- `admin@limo.local`
- `guru@limo.local`
- `wali@limo.local`

Password development: `password-dev-only`.

Jangan memakai seed credential di production.
