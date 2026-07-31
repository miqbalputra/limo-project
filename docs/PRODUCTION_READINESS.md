# Production Readiness Plan

Dokumen ini adalah checklist kerja menuju klaim 100% production-ready. Item yang membutuhkan kredensial, domain, atau server nyata tidak bisa ditutup hanya dari repository lokal.

## Gate 1: Repo Ready

- [x] Build Next.js production berhasil.
- [x] Typecheck, lint, unit test, acceptance test, dan E2E utama tersedia.
- [x] Auth memakai database session dan cookie `HttpOnly`.
- [x] Dashboard role Admin/Guru/Wali memakai data scoping dasar.
- [x] Payment Pakasir mendukung create transaction, fallback link resmi, webhook, dan verifikasi detail transaksi saat API key tersedia.
- [x] Notification retry mendukung provider email SMTP.
- [ ] Vulnerability audit dependency ditindaklanjuti tanpa breaking change. `npm audit fix` non-breaking sudah dijalankan; sisa advisory terkait Next/PostCSS/sharp dan lint dependency masih membutuhkan rilis upstream atau perubahan breaking yang harus diuji terpisah.
- [ ] Warning Turbopack NFT private storage diselesaikan atau diterima eksplisit sebagai non-blocking.

## Gate 2: Staging Ready

- [ ] Domain HTTPS staging aktif.
- [ ] MariaDB staging berjalan private/internal.
- [ ] `prisma migrate deploy` sukses di MariaDB staging.
- [ ] Private storage berada di volume persistent dan tidak terekspos public web.
- [ ] `NOTIFICATION_PROVIDER=email` dengan SMTP sandbox/staging berhasil mengirim email.
- [ ] Pakasir sandbox/staging create payment, simulation, webhook, dan reconcile diuji end-to-end.
- [ ] Smoke test role Admin/Guru/Wali lulus di browser mobile dan desktop.

## Gate 3: Production Launch

- [ ] Konten LIMO final: kontak, jadwal, program, testimoni, biaya, dan materi awal.
- [ ] Credential production Pakasir aktif dan webhook URL production tersimpan di dashboard Pakasir.
- [ ] Credential SMTP production aktif dan reputasi pengirim dicek.
- [ ] Backup database dan private storage harian aktif.
- [ ] Restore drill berhasil dilakukan minimal sekali.
- [ ] Admin LIMO mengganti semua password seed/demo.
- [ ] Seed demo tidak dijalankan di production final.
- [ ] UAT owner LIMO sign-off untuk pendaftaran, kelas, nilai, progres, tagihan, dan notifikasi.

## Definition Of Done 100%

Project boleh diklaim 100% production-ready hanya jika semua Gate 1, Gate 2, dan Gate 3 sudah selesai dan hasil UAT disetujui oleh owner LIMO.
