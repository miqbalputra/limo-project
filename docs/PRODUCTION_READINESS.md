# Production Readiness Plan

Dokumen ini adalah checklist kerja menuju klaim 100% production-ready. Item yang membutuhkan kredensial, domain, atau server nyata tidak bisa ditutup hanya dari repository lokal.

## Gate 1: Repo Ready

- [x] Build Next.js production berhasil.
- [x] Typecheck, lint, unit test, acceptance test, dan E2E utama tersedia.
- [x] Auth memakai database session dan cookie `HttpOnly`.
- [x] Dashboard role Admin/Guru/Wali memakai data scoping dasar.
- [x] Payment Mayar mendukung create invoice, webhook, status reconciliation, dan validasi merchant/nominal.
- [x] Notification retry mendukung provider email SMTP dan n8n untuk email/WhatsApp eksternal.
- [x] Readiness probe tersedia di `/api/health/ready` untuk environment, database, dan private storage.
- [ ] Vulnerability audit dependency ditindaklanjuti tanpa breaking change. `npm audit fix` non-breaking sudah dijalankan; sisa advisory terkait Next/PostCSS/sharp dan lint dependency masih membutuhkan rilis upstream atau perubahan breaking yang harus diuji terpisah.

## Gate 2: Staging Ready

- [ ] Domain HTTPS staging aktif.
- [ ] MariaDB staging berjalan private/internal.
- [ ] `prisma migrate deploy` sukses di MariaDB staging.
- [ ] Private storage berada di volume persistent dan tidak terekspos public web.
- [ ] `NOTIFICATION_PROVIDER=email` atau `n8n` dengan provider staging berhasil mengirim notifikasi.
- [ ] Mayar sandbox create invoice, simulation, webhook, dan reconciliation diuji end-to-end.
- [ ] Smoke test role Admin/Guru/Wali lulus di browser mobile dan desktop.

## Gate 3: Production Launch

- [ ] Konten LIMO final: kontak, jadwal, program, testimoni, biaya, dan materi awal.
- [ ] Credential production Mayar aktif, merchant ID terdaftar, dan webhook URL production tersimpan di dashboard Mayar.
- [ ] Credential SMTP/n8n production aktif dan reputasi pengirim dicek.
- [ ] Backup database dan private storage harian aktif.
- [ ] n8n workflow backup berhasil mengunggah SQL dan ZIP ke storage off-site.
- [ ] Restore drill berhasil dilakukan minimal sekali.
- [ ] Admin LIMO mengganti semua password seed/demo.
- [ ] Seed demo tidak dijalankan di production final.
- [ ] UAT owner LIMO sign-off untuk pendaftaran, kelas, nilai, progres, tagihan, dan notifikasi.

## Definition Of Done 100%

Project boleh diklaim 100% production-ready hanya jika semua Gate 1, Gate 2, dan Gate 3 sudah selesai dan hasil UAT disetujui oleh owner LIMO.
