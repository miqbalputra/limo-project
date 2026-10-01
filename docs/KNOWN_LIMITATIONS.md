# Known Limitations and Open Issues

Dokumen ini mencatat gap MVP saat ini agar tidak dianggap selesai diam-diam.

## Infrastruktur

- Migration database nyata belum dijalankan di environment ini karena Docker CLI/MariaDB belum tersedia.
- Acceptance test SQLite dan E2E Playwright sudah tersedia; parity test MariaDB production belum dijalankan di environment ini.
- Rate limit aplikasi masih in-process; deployment multi-instance tetap membutuhkan Redis atau rate limit di reverse proxy.

## Payment

- Mayar menjadi provider pembayaran resmi. Webhook dilindungi secret LIMO dan validasi merchant/nominal jika credential production sudah dikonfigurasi.
- Reconciliation Mayar menggunakan detail invoice API melalui `npm run mayar:reconcile`.
- Kredensial production Mayar dan UAT end-to-end di merchant nyata belum dilakukan di environment ini.
- Redirect browser tidak mengubah status pembayaran, sesuai PRD.

## Notifikasi

- Provider email SMTP tersedia melalui `NOTIFICATION_PROVIDER=email` dan script `npm run notifications:retry`.
- Provider n8n tersedia untuk email/WhatsApp; pengiriman WhatsApp tetap dilakukan oleh workflow GOWA eksternal, bukan langsung dari LIMO.

## UI/UX

- Dashboard shell sudah memakai pola TailAdmin termasuk sidebar collapse, command search, profile dropdown, breadcrumb, dan dropdown notifikasi berbasis data; polish visual per modul masih bisa dilanjutkan.
- Modul akun Guru/Wali sudah memiliki CRUD, arsip/restore, reset password, kirim ulang aktivasi, dan impor CSV; tarif SPP juga sudah punya ubah/arsip/pulihkan; modul lain belum semuanya memiliki edit/update/delete/arsip lengkap.
- Tabel besar belum semua memakai pagination UI penuh, meskipun query utama dibatasi.
- Pilihan siswa pada form tarif SPP di `/admin/tagihan` menampilkan maksimal **100 siswa** (batas `pageSize` pada `listSiswa`); bila jumlah siswa melebihi itu, perlu diganti menjadi pencarian/autocomplete.
- Aksi destruktif pada materi, ujian, sesi, dan hero carousel memakai `ConfirmDialog` in-app (bukan `window.confirm`); label enum (mis. aksi audit) tidak lagi mencetak token mentah. Sisa `window.confirm` hanya tombol bersihkan jawaban di pemutar kuis publik.
- Halaman `/guru/bank-soal` kini memberi `aria-label` pada `<select>` kelas/tipe soal, dan tombol "Simpan sesi" memenuhi target sentuh ≥44px; audit axe halaman Guru (`/guru/sesi`, `/guru/penilaian-esai`, `/guru/bank-soal`) lulus.
- Pola `event.currentTarget.reset()` **setelah** `await` (penyebab error “Cannot read properties of null (reading 'reset')” dan daftar yang tidak menyegar) sudah dibersihkan di **seluruh** form dashboard: bank soal, sesi, hasil ujian, ujian, RPP, remedial, master data, materi/LMS, modul pembelajaran, hero carousel, tarif billing, dan builder tugas. Elemen form kini di-capture sebelum `await`.

## Akademik

- Online exam kini memiliki paritas Google Forms: penegakan jawaban wajib di server, grace window + auto-submit, kunci alternatif, validasi kotak centang/paragraf, branching semua tipe pilihan, email responden + limit per email, salinan/notifikasi respons, rilis nilai tertunda, mode satu soal per halaman, dan impor soal (termasuk impor per-butir dari formulir sumber). Rekaman suara (speaking) sudah tersedia di pemutar publik/wali/siswa. Yang masih backlog: interaksi menjodohkan/urutan berbasis drag di pemutar (pengurutan lewat tombol sudah tersedia).
- Ujian mandiri siswa: siswa dapat mengerjakan ujian daring dari akun sendiri (mode `ONLINE_VIA_SISWA`/`BOTH`) melalui portal `/siswa/ujian`; attempt ter-scope ke `siswaAccountId`. Mode aman (`Ujian.secureMode`) mencatat perpindahan tab pada attempt, nilai dapat ditahan guru lewat `Ujian.showResultToSiswa`, dan siswa dapat mengunduh berkas jawabannya sendiri. Mode aman diperkuat (layar penuh + blokir tempel/salin/klik-kanan) dan nilai dapat dirilis per attempt lewat `HasilUjian.releasedAt`.
- Hasil `NEEDS_REVIEW`, `FINAL`, dan `CORRECTED` memiliki jalur review/koreksi Guru; hasil final tetap dikunci dari input biasa.
- Gradebook Siswa/Wali hanya menampilkan nilai final yang sudah dipublikasikan: skor provisional (`calculatedScore`, skor kategori/item, `letterGrade`) tidak dikirim ke klien sebelum `FinalGrade` dipublikasikan (`exposeProvisionalScores:false`), diverifikasi `npm run test:week7`.
- Pengumuman & diskusi kelas tersedia (fase A/B/C dari Fase 9 `rencana.md`): pengumuman dengan audience, prioritas, jadwal terbit/berakhir, dan status baca; thread + balasan dengan pin/kunci/sembunyikan/soft-delete + audit; lapor konten ke antrean admin; lampiran thread berpenyimpanan privat, lampiran pada balasan, dan pengumuman sekolah-wide (`kelasId` null) untuk Admin. Yang masih backlog: Q&A per materi/modul (entri `ModuleItemType.DISCUSSION` masih ditolak service), notifikasi langsung saat materi baru dipublikasikan, dan laporan konten dengan bukti per balasan.
- Laporan perkembangan berkala (Fase 10 `rencana.md`) tersedia: model `ProgressReport` + `ProgressReportRead`, snapshot data periode (dikunci saat draf dibuat sehingga koreksi sumber tidak mengubah laporan lama), narasi Guru, alur draf/terbit/revisi ber-audit, read tracking, notifikasi ke wali/siswa, dan PDF terotorisasi (`/api/v1/reports/[reportId]/pdf`).
- Sesi Guru memiliki workflow finalisasi yang mengunci presensi dan progres setelah data lengkap.

## Operasional

- Backup/restore terjadwal, SQL import, ZIP checksum, dan endpoint n8n sudah tersedia; belum diuji nyata terhadap MariaDB staging serta storage off-site.
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
