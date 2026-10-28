# Known Limitations and Open Issues

Dokumen ini mencatat gap MVP saat ini agar tidak dianggap selesai diam-diam.

## Infrastruktur

- Migration database nyata belum dijalankan di environment ini karena Docker CLI/MariaDB belum tersedia.
- Acceptance test SQLite dan E2E Playwright sudah tersedia; parity test MariaDB production belum dijalankan di environment ini.
- Rate limit kini tersimpan di database (`RateLimitCounter`, migration `20261011010000`) sehingga efektif untuk multi-instance. Bila store DB gagal sesaat, throttle **fail-open** (dilewati + warning) demi ketersediaan — reverse proxy rate limit tetap dianjurkan untuk lapisan tambahan.
- Alamat klien throttle/audit diambil dari `x-forwarded-for`; di belakang satu proxy terpercaya set `RATE_LIMIT_TRUST_PROXY=true` agar dipakai hop terakhir (tahan spoof). Wajib memastikan proxy menimpa/menambah XFF.

## Payment

- Mayar menjadi provider pembayaran resmi. **Webhook secret Mayar kini wajib** — bila secret belum dikonfigurasi (DB maupun `MAYAR_WEBHOOK_SECRET`), webhook ditolak, bukan diproses tanpa verifikasi. Validasi merchant/nominal tetap berlaku.
- Rekonsiliasi Mayar menggunakan detail invoice/transaksi API (`npm run mayar:reconcile`) dan kini **ber-guard status**: webhook yang mengubah pembayaran/tagihan lebih dulu tidak akan ditimpa oleh rekonsiliasi (dan sebaliknya). Pakasir sudah dihentikan oleh providernya dan **dihapus dari kode** — Mayar menjadi satu-satunya payment gateway; transaksi Pakasir historis tetap tersimpan di database tetapi tidak lagi direkonsiliasi.
- Kredensial production Mayar dan UAT end-to-end di merchant nyata belum dilakukan di environment ini.
- Redirect browser tidak mengubah status pembayaran, sesuai PRD.
- `npm audit` tinggal melaporkan 3 temuan high pada rantai **prisma CLI** (`prisma → @prisma/config → deepmerge-ts`) — hanya alat CLI dev, tidak termasuk runtime `@prisma/client` di produksi; "perbaikan" yang tersedia justru downgrade Prisma, jadi risiko ini sengaja diterima. Temuan high **zod** sudah ditutup dengan migrasi **zod v4.6.7** (oktober 2026): skema di 36 file sudah kompatibel, default numerik `env.ts` diubah ke tipe output, dan `apiError` kini memetakan `ZodError` ke 400 `VALIDATION_ERROR` sebagai jaring pengaman.
- **Gotcha zod v4 yang perlu dijaga**: `.partial()` di v4 menembakkan `.default()` field yang tidak dikirim (v3 membiarkan `undefined`), sehingga update parsial bisa menimpa nilai lama dengan default. Semua schema update (`assignment`, `calendar`, `hero-carousel`, `gradebook`, `settings`) kini memakai helper `partialWithoutDefaults()` (`src/server/validation/common.ts`); jangan menambah `createXSchema.partial()` baru untuk skema ber-default.

## Notifikasi

- Provider email SMTP tersedia melalui `NOTIFICATION_PROVIDER=email` dan script `npm run notifications:retry`.
- Provider n8n tersedia untuk email/WhatsApp; pengiriman WhatsApp tetap dilakukan oleh workflow GOWA eksternal, bukan langsung dari LIMO.

## UI/UX

- Dashboard shell sudah memakai pola TailAdmin termasuk sidebar collapse, command search, profile dropdown, breadcrumb, dan dropdown notifikasi berbasis data; polish visual per modul masih bisa dilanjutkan.
- Modul akun Guru/Wali sudah memiliki CRUD, arsip/restore, reset password, kirim ulang aktivasi, dan impor CSV; tarif SPP juga sudah punya ubah/arsip/pulihkan; **voucher kini juga punya edit** (nilai diskon, kuota, cakupan, masa berlaku, keterangan); modul lain belum semuanya memiliki edit/update/delete/arsip lengkap.
- Tabel besar belum semua memakai pagination UI penuh, meskipun query utama dibatasi. Laporan perkembangan Admin/Guru kini sudah memakai `PaginationControls`.
- Izin granular guru kini ditegakkan pada layar terkait: `guru.gradebook.manage` (gradebook), `guru.remedial.manage` (remedial), `guru.announcement.manage` (buat/ubah pengumuman), dan `guru.discussion.manage` (buat/moderasi diskusi) — dicabut di `/admin/akses` atau editor akun berartinya nyata.
- Halaman ber-flag (kalender, todo) untuk semua role menampilkan `notFound()` bila flag dimatikan dan URL dibuka langsung, bukan error boundary.
- Pemilih siswa pada form tarif SPP di `/admin/tagihan` (tambah & ubah) kini memakai pencarian (`StudentSearchSelect`): daftar awal 100 siswa tetap tersedia, dan mengetik nama/NIS mencari lewat `GET /api/v1/admin/siswa?search=` sehingga sekolah dengan siswa >100 tetap bisa dipilih; siswa terpilih di luar 100 besar kini juga tampil namanya saat mengubah tarif.
- Aksi destruktif pada materi, ujian, sesi, dan hero carousel memakai `ConfirmDialog` in-app (bukan `window.confirm`); label enum (mis. aksi audit) tidak lagi mencetak token mentah. Tidak ada lagi sisa `window.confirm` native — termasuk tombol bersihkan jawaban di pemutar kuis publik kini memakai dialog in-app.
- Halaman `/guru/bank-soal` kini memberi `aria-label` pada `<select>` kelas/tipe soal, dan tombol "Simpan sesi" memenuhi target sentuh ≥44px; audit axe halaman Guru (`/guru/sesi`, `/guru/penilaian-esai`, `/guru/bank-soal`) lulus.
- Pola `event.currentTarget.reset()` **setelah** `await` (penyebab error “Cannot read properties of null (reading 'reset')” dan daftar yang tidak menyegar) sudah dibersihkan di **seluruh** form dashboard: bank soal, sesi, hasil ujian, ujian, RPP, remedial, master data, materi/LMS, modul pembelajaran, hero carousel, tarif billing, dan builder tugas. Elemen form kini di-capture sebelum `await`.

## Akademik

- Online exam kini memiliki paritas Google Forms: penegakan jawaban wajib di server, grace window + auto-submit, kunci alternatif, validasi kotak centang/paragraf, branching semua tipe pilihan, email responden + limit per email, salinan/notifikasi respons, rilis nilai tertunda, mode satu soal per halaman, dan impor soal (termasuk impor per-butir dari formulir sumber). Rekaman suara (speaking) sudah tersedia di pemutar publik/wali/siswa, dan menjodohkan/urutan sudah memakai drag & drop di pemutar (komponen bersama `matching-sequence-input.tsx`) lengkap dengan alternatif tap-to-pair dan keyboard.
- Ujian mandiri siswa: siswa dapat mengerjakan ujian daring dari akun sendiri (mode `ONLINE_VIA_SISWA`/`BOTH`) melalui portal `/siswa/ujian`; attempt ter-scope ke `siswaAccountId`. Mode aman (`Ujian.secureMode`) mencatat perpindahan tab pada attempt, nilai dapat ditahan guru lewat `Ujian.showResultToSiswa`, dan siswa dapat mengunduh berkas jawabannya sendiri. Mode aman diperkuat (layar penuh + blokir tempel/salin/klik-kanan) dan nilai dapat dirilis per attempt lewat `HasilUjian.releasedAt`.
- Hasil `NEEDS_REVIEW`, `FINAL`, dan `CORRECTED` memiliki jalur review/koreksi Guru; hasil final tetap dikunci dari input biasa.
- Gradebook Siswa/Wali hanya menampilkan nilai final yang sudah dipublikasikan: skor provisional (`calculatedScore`, skor kategori/item, `letterGrade`) tidak dikirim ke klien sebelum `FinalGrade` dipublikasikan (`exposeProvisionalScores:false`), diverifikasi `npm run test:week7`.
- Pengumuman & diskusi kelas tersedia (fase A/B/C dari Fase 9 `rencana.md`): pengumuman dengan audience, prioritas, jadwal terbit/berakhir, dan status baca; thread + balasan dengan pin/kunci/sembunyikan/soft-delete + audit; lapor konten ke antrean admin; lampiran thread berpenyimpanan privat, lampiran pada balasan, dan pengumuman sekolah-wide (`kelasId` null) untuk Admin. Yang masih backlog: Q&A per materi/modul (entri `ModuleItemType.DISCUSSION` masih ditolak service), notifikasi langsung saat materi baru dipublikasikan, dan laporan konten dengan bukti per balasan.
- Laporan perkembangan berkala (Fase 10 `rencana.md`) tersedia: model `ProgressReport` + `ProgressReportRead`, snapshot data periode (dikunci saat draf dibuat sehingga koreksi sumber tidak mengubah laporan lama), narasi Guru, alur draf/terbit/revisi ber-audit, read tracking, notifikasi ke wali/siswa, dan PDF terotorisasi (`/api/v1/reports/[reportId]/pdf`).
- Sesi Guru memiliki workflow finalisasi yang mengunci presensi dan progres setelah data lengkap.

## Operasional

- Backup/restore terjadwal, SQL import, ZIP checksum, dan endpoint n8n sudah tersedia; belum diuji nyata terhadap MariaDB staging serta storage off-site. Variabel `BACKUP_OFFSITE_*` kini tercantum di `.env.dokploy*.example` dan diteruskan `docker-compose.dokploy.yml` — wajib diisi di produksi agar backup tidak hanya ada di VPS yang sama dengan database. Kegagalan backup kini juga memunculkan alert in-app di dashboard Admin (`docs/OBSERVABILITY.md`).
- Jadwal cron lengkap (11 job, termasuk `mayar:reconcile`/`pakasir:reconcile`) ada di `deploy/cron/limo.crontab` + `docs/DEPLOYMENT.md`. Cron TIDAK terpasang otomatis saat redeploy — verifikasi ada di `docs/REDEPLOY_CHECKLIST.md` bagian 5.
- `/api/health` menampilkan `build.sha`/`build.builtAt` (dari build args `LIMO_BUILD_SHA`/`LIMO_BUILD_TIME`) untuk mendeteksi build stale; Dockerfile sudah siap, Dokploy perlu meneruskan build args. CMD sekarang menjalankan `next start` langsung via node agar SIGTERM sampai ke Next (graceful shutdown).
- Runner image kini memakai `npm ci --omit=dev` (stage `prod-deps`) + `.dockerignore` mengecualikan docs/tests/zip — `prisma` CLI dipindah ke dependencies karena dipakai `migrate deploy` saat start.
- Arsip siswa kini menonaktifkan akun login (User INACTIVE + sesi dicabut), selaras arsip guru/wali; arsip lewat PATCH status siswa dan pulih/restore juga menyesuaikan akun.
- Index untuk tabel besar (Notifikasi, AuditLog, Session, Pembayaran) ditambahkan via migration `20261011020000`; `UjianAttempt.attemptNumber` unik per (ujian, siswa) via `20261011030000` menutup race maxAttempts.
- Dialog builder kuis (Sheet/pratinjau) kini punya Escape + focus trap + pemulihan fokus (`useDialogA11y`); reorder opsi jawaban punya tombol naik/turun keyboard.

## Backlog yang disengaja (dari audit P2, risiko > nilai sebelum UAT)

- **Konversi status varchar → enum DB** (`QuizResponse.status`, `UjianAttempt.status`, `Pembayaran.provider`): menyentuh data produksi; integritas sudah dijaga layer service. Kerjakan setelah UAT dengan audit data dulu.
- **Dedup `formatDate`/`formatDateTime`** (±45 file dengan variasi tanda tangan): penyatuan buta berisiko mengubah format tampilan; butuh review per halaman.
- **E2E browser-level untuk notifikasi/sertifikat/rapor**: modul tersebut sudah tercakup runner integrasi di CI; spec Playwright menyusul.
- **Spec `mobile-layout.spec.ts` tidak berjalan di CI**: asersi geometri piksel (overflow 360-390px) sensitif metrik font OS — baseline snapshot-nya dibuat di Windows (-win32) dan render linux berbeda. Spec tetap lulus di mesin dev; aktifkan di CI setelah baseline snapshot per-platform tersedia (mis. generate di runner linux + cache).
- **Spec `guru-workspace.spec.ts` dikarantina di CI (sementara)**: klik interaksinya menggantung bermenit-menit pada server dev yang mengompilasi dingin (flaky antar run; stabil di mesin dev). Dua kelas race sudah dibereskan (marker hidrasi + waitForResponse POST koreksi); perbaikan arsitektural yang tersisa adalah menjalankan e2e di atas `next start` (produksi) alih-alih `next dev`, atau server dev persisten untuk seluruh suite.
- **Pemecahan service >1.300 baris** (quiz-builder, exam) dan dedup billing workspace admin/wali: refactor murni, jadwalkan pasca-UAT.
- Nginx/PM2 config final belum dibuat sebagai file deploy siap pakai.
- Domain/staging/credential provider masih open decision.

## Pembaruan Kematangan Dashboard (Sep 2026)

- **Umpan balik sukses global**: sistem toast (`src/components/ui/toast-provider.tsx`, dipasang di root layout). `useAsyncAction` dan komponen aksi manual kini menampilkan toast sukses/gagal selain error inline.
- **Proteksi berlapis**: `src/proxy.ts` diperluas — selain halaman dashboard, kini mengembalikan 401 untuk API terproteksi bila cookie sesi tidak ada (rute publik/auth/webhooks/health dikecualikan). Validasi sesi database tetap di `requireActor`.
- **Audit guard otomatis**: `npm run test:guards` (`tests/run-route-guard-audit.mjs`) memastikan setiap route API terproteksi memanggil guard auth, dan route admin/guru memakai cek role/permission eksplisit (route admin/guru kini memakai `requireRole`/`requireActorWithRole`).
- **Matriks izin granular**: katalog izin + default per role + override per-role/per-user (`RolePermissionOverride`, `UserPermissionOverride`), halaman `/admin/akses` dan editor izin di `/admin/users/[id]`. Seluruh halaman Admin, Guru, Wali, dan Siswa memakai `requirePermission`; navigasi disaring per izin. Service admin juga memakai `requirePermission`, sehingga override lintas-role berfungsi (lihat `docs/ROLE_ACCESS_MATRIX.md`).
- **CRUD Guru dilengkapi**: Pustaka Soal (arsip/pulihkan/duplikat/hapus dengan `archivedAt` + toggle "Tampilkan arsip"; soal dibuat & diubah di dalam formulir), Materi (ubah isi + hapus), RPP (ubah isi), Remedial (ubah, tutup, sinkronkan nilai peserta).
- **Konsistensi daftar**: Level, Program, dan Kelas (cari + pagination); Kuis & Ujian (cari); empty state Hero Carousel. Daftar terbatas (roster, gradebook, submissions, todo, jadwal) sengaja tanpa pagination.
- **Pengaturan sekolah & tahun ajaran**: model `SchoolSetting` + `AcademicYear`, halaman `/admin/pengaturan`. Identitas sekolah dipakai pada kop invoice, kuitansi, sertifikat, invoice PNG, dan email (nama pengirim, subject, footer) + payload n8n. Tahun ajaran aktif menjadi default periode generate tagihan dan tampil di halaman laporan.
- **Validasi form client-side**: form Program/Level/Kelas/Guru/Wali/Siswa memvalidasi dengan schema zod yang sama di klien (error per-field) sebelum dikirim ke server. Modul lain (tarif, voucher, users, dsb.) masih memakai validasi HTML + error server.
- **Perbaikan**: nav `/guru/todo` tidak lagi salah gerbang `calendarEnabled`; halaman progres aktivitas dan koreksi hasil ujian memakai `notFound()` alih-alih `return null`; copy halaman audit diselaraskan dengan pagination.

**Wajib saat deploy**: jalankan `npx prisma migrate deploy` untuk migrasi `20260929010000_bank_soal_archive`, `20260929020000_school_settings_academic_year`, dan `20260929030000_permission_matrix`. Untuk dev lokal, `npm run sqlite:setup`.
