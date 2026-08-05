# LMS Extension Baseline

Baseline ini dibuat sebelum implementasi Fase 1 dari `rencana.md`. Tujuannya adalah membedakan kegagalan existing dari regresi yang muncul setelah fitur LMS baru dikembangkan.

## Environment

- Platform: Windows development environment.
- Runtime: Node.js 22+.
- Database baseline: SQLite lokal `prisma/dev.db`.
- Server test: `http://127.0.0.1:3000`.
- Browser E2E: Chromium melalui Playwright.
- Database production MariaDB belum tersedia pada environment ini.

## Hasil Verifikasi

| Command | Hasil | Catatan |
|---|---|---|
| `npm test` | Lulus | Unit test security, filename, billing, LMS, exam, dan RPP validation. |
| `npm run test:week1` | Lulus | Health/readiness, auth, pendaftaran, upload, approval, siswa, scoping, session, dan user management. |
| `npm run test:week2` | Lulus | LMS materi, lifecycle materi, bank soal, ujian, lifecycle ujian, hasil, koreksi, RPP, dan private file scoping. |
| `npm run test:week3` | Lulus | Backup guard, dashboard, billing, laporan, audit, roster, sesi, presensi, progres, materi Wali, Mayar webhook, dan notifikasi. |
| `npm run test:e2e` | Lulus, `12/12` | Landing, login role, dashboard mobile, LMS/exam mobile, Wali exam, progres, billing, selector anak, materi, dan bantuan. |
| `npm run typecheck` | Lulus | TypeScript strict check. |
| `npm run lint` | Lulus | ESLint tanpa error. |
| `npm run build` | Lulus | Production build Next.js berhasil. |

## Existing Behavior Confirmed

- Login Admin, Guru, dan Wali tetap berjalan.
- Proteksi role dan scope kelas/siswa tetap berjalan.
- Pendaftaran, upload file privat, approval, dan rejection tetap berjalan.
- Materi, presensi, progres, bank soal, ujian, hasil, billing, notifikasi, audit, dan backup tetap berjalan.
- RPP existing tetap dapat dibuat dalam mode form atau upload dan diakses Wali sesuai enrollment.

## Baseline Limitations

- Migration dan parity test MariaDB belum dijalankan karena Docker CLI/MariaDB tidak tersedia pada environment ini.
- Pembayaran Mayar nyata belum diuji karena credential production tidak tersedia.
- Delivery SMTP/n8n dan backup off-site belum diuji terhadap provider eksternal.
- Baseline belum mencakup fitur yang direncanakan tetapi belum ada: akun Siswa, modul, assignment, submission, recording, rubrik, gradebook, kalender terpadu, completion, remedial, discussion, dan laporan perkembangan periodik.

## Baseline Decision

Baseline existing dinyatakan **lulus untuk melanjutkan Step 0.3 dan Fase 1**. Setiap kegagalan test setelah perubahan database atau behavior harus dibandingkan dengan hasil pada dokumen ini.
