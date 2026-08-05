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
| `MAX_ASSIGNMENT_FILE_MB` | Ya | Default 25; allowlist submission file |
| `MAYAR_ENV` | Ya | `sandbox` atau `production` |
| `MAYAR_BASE_URL` | Opsional | Override base URL Mayar V2 |
| `MAYAR_API_KEY` | Untuk payment | API key Mayar, tidak boleh `NEXT_PUBLIC_` |
| `MAYAR_MERCHANT_ID` | Production | Merchant/user ID yang divalidasi dari webhook Mayar |
| `MAYAR_WEBHOOK_SECRET` | Production | Secret webhook yang dikonfigurasi di endpoint LIMO |
| `NOTIFICATION_PROVIDER` | Ya | `console` untuk development, `email` atau `n8n` untuk production. Production tidak boleh memakai `console` |
| `N8N_EMAIL_WEBHOOK_URL` | Jika n8n | Webhook n8n untuk delivery email |
| `N8N_WHATSAPP_WEBHOOK_URL` | Jika n8n | Webhook n8n untuk delivery WhatsApp/GOWA |
| `N8N_WEBHOOK_SECRET` | Jika n8n | Secret header outbound LIMO ke n8n |
| `NEXT_PUBLIC_LIMO_CONTACT_EMAIL` | Ya | Email kontak publik landing page; bukan secret |
| `SMTP_HOST` | Jika email | Host SMTP |
| `SMTP_PORT` | Jika email | Port SMTP |
| `SMTP_SECURE` | Jika email | `true` untuk SMTPS 465, `false` untuk STARTTLS/587 |
| `SMTP_FROM` | Jika email | Alamat pengirim email. Jika kosong memakai `SMTP_USER` |
| `SMTP_USER` | Jika email | Username SMTP |
| `SMTP_PASSWORD` | Jika email | Password SMTP |
| `STUDENT_PORTAL_ENABLED` | Opsional | Portal Siswa; default development aktif dan production nonaktif |
| `LEARNING_MODULES_ENABLED` | Opsional | Modul pembelajaran terstruktur; default development aktif dan production nonaktif |
| `ASSIGNMENTS_ENABLED` | Opsional | Tugas dan submission; default development aktif dan production nonaktif |
| `GRADEBOOK_ENABLED` | Opsional | Gradebook; default development aktif dan production nonaktif |
| `CALENDAR_ENABLED` | Opsional | Kalender, To-do, dan reminder; default development aktif dan production nonaktif |
| `CLASS_DISCUSSION_ENABLED` | Opsional | Pengumuman dan diskusi kelas; default development aktif dan production nonaktif |
| `PERIODIC_REPORTS_ENABLED` | Opsional | Laporan perkembangan periodik; default development aktif dan production nonaktif |
| `GUARDIAN_ASSISTED_SUBMISSION_ENABLED` | Opsional | Bantuan submit oleh Wali; default selalu nonaktif |

## Development Seed

Untuk development tanpa Docker, jalankan `npm run sqlite:setup`. Perintah ini membuat schema SQLite turunan dan database disposable `prisma/dev.db`; schema production tetap MariaDB.

Seed development membuat akun:

- `admin@limo.local`
- `guru@limo.local`
- `wali@limo.local`
- `guru.arab@limo.local`
- `wali.demo@limo.local`
- `siswa@limo.local` (login menggunakan nomor induk `LIMO-DEV-001`)

Password development: `password-dev-only`.

Jangan memakai seed credential di production.
