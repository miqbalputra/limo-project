# LIMO System

Sistem informasi kursus LIMO dibangun sebagai satu aplikasi Next.js App Router sesuai `PRD.md` dan `IMPLEMENTATION_PLAN.md`.

## Stack

- Next.js 16 App Router, React 19, TypeScript strict
- MariaDB 11 + Prisma
- Route Handlers di `src/app/api/**/route.ts`
- Session database dengan cookie `HttpOnly`
- Cron/systemd timer untuk job terjadwal; tidak memakai Express atau `node-cron`

## Prasyarat Lokal

- Node.js 22+
- npm 10+
- Docker untuk MariaDB development

Di PowerShell Windows, gunakan `npm.cmd` bila `npm.ps1` terblokir oleh execution policy.

## Setup Lokal

### SQLite Sementara

SQLite dapat dipakai untuk development dan acceptance test Minggu 1 tanpa Docker. Schema SQLite dibuat otomatis dari schema MariaDB dan tidak menjadi source of truth production.

```bash
npm install
npm run sqlite:setup
npm run dev
```

Database lokal dibuat di `prisma/dev.db`. Jangan membuat migration SQLite; migration production tetap dibuat dari `prisma/schema.prisma` saat MariaDB tersedia.

### MariaDB

1. Salin `.env.example` menjadi `.env`.
2. Jalankan MariaDB:

   ```bash
   docker compose up -d
   ```

3. Install dependency:

   ```bash
   npm install
   ```

4. Jalankan development server:

   ```bash
   npm run dev
   ```

5. Cek health endpoint:

   ```bash
   curl http://localhost:3000/api/health
   ```

## Verifikasi

```bash
npm run lint
npm run typecheck
npm test
```

Unit test saat ini mencakup helper keamanan, sanitasi filename, dan schema validasi penting yang tidak membutuhkan database. Integration test dan E2E membutuhkan MariaDB test yang sudah dimigrasikan; jalankan setelah Docker/MariaDB tersedia.

Target test berikutnya sesuai `IMPLEMENTATION_PLAN.md`:

- Auth/session dengan database test.
- Approval pendaftaran idempoten.
- Authorized file download.
- Scoping Guru/Wali.
- Generate tagihan dua kali tanpa duplikasi.
- Webhook Mayar duplicate/secret/merchant/amount mismatch.
- Flow E2E pendaftaran sampai pembayaran.

## Job Terjadwal

Jalankan job melalui cron VPS atau systemd timer dengan lock eksternal, bukan dari proses web Next.js.

Contoh manual:

```bash
npm run billing:generate -- --period=2026-07 --due-date=2026-07-10 --dry-run
npm run billing:mark-overdue -- --dry-run
npm run sessions:cleanup -- --dry-run
npm run notifications:retry -- --limit=50 --dry-run
npm run reminders:send -- --dry-run
```

Contoh konsep cron production:

```text
flock -n /var/lock/limo-invoice.lock npm run billing:generate -- --period=YYYY-MM --due-date=YYYY-MM-10
flock -n /var/lock/limo-overdue.lock npm run billing:mark-overdue
flock -n /var/lock/limo-session-cleanup.lock npm run sessions:cleanup
flock -n /var/lock/limo-notification-retry.lock npm run notifications:retry -- --limit=50
flock -n /var/lock/limo-deadline-reminders.lock npm run reminders:send
```

Jadwal final harus mengikuti timezone operasional `Asia/Jakarta` dan kebijakan billing LIMO.

## Guardrail Arsitektur

- Jangan menambahkan Express/custom server.
- Jangan menyimpan secret dengan prefix `NEXT_PUBLIC_`.
- Jangan menyimpan file privat di `public/`.
- Jangan melakukan fetch HTTP ke API sendiri dari Server Component untuk read server-side.
- Jangan menjalankan cron di lifecycle proses web.

## Dokumen Operasional

- `docs/ENVIRONMENT.md`
- `docs/DEPLOYMENT.md`
- `docs/BACKUP_RESTORE.md`
- `docs/DEPLOYMENT_CHECKLIST.md`
- `docs/ROLE_ACCESS_MATRIX.md`
- `docs/UAT_SCRIPT.md`
- `docs/KNOWN_LIMITATIONS.md`
