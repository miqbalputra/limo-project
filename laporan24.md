# Laporan Audit Aplikasi LIMO

**Tanggal audit:** 24 September 2026
**Terakhir diperbarui:** 25 September 2026 — bagian "Progress Terkini" adalah hand-off untuk melanjutkan sesi berikutnya.
**Ruang lingkup:** seluruh aplikasi (publik, portal siswa, dashboard admin/guru/wali, API, job terjadwal, deployment)
**Metode:** pembacaan kode sumber, dokumen repo (`PRD.md`, `fitur.md`, `progress.md`, `docs/*`), penelusuran route/service/schema, serta menjalankan verifikasi (typecheck, lint, unit test, integration test, e2e).
**Catatan:** angka bersifat hasil pengukuran/verifikasi kecuali ditandai sebagai estimasi.

---

## ⏸️ Progress Terkini — Resume Point (25 Sep 2026)

**Status sprint:** Sprint 0 ✅ selesai · Sprint 1 ✅ selesai · Sprint 2 ✅ selesai · Sprint 3 🔄 hampir selesai (sertifikat + ujian mandiri siswa + pengumuman/diskusi + rekaman suara + voucher/kuitansi selesai; sisa cicilan billing & Q&A per materi) · Sprint 4 ⏳ belum mulai.

**Pembaruan 26 Sep 2026 — penutupan catatan terbuka dashboard Guru (G4/G6/G12/G13/T8/W10):**
- Label enum mentah dihilangkan: `guru/penilaian-esai` memakai `formatUiLabel("NEEDS_REVIEW")`; `admin/audit` memakai `humanizeEnumLabel` untuk aksi/entitas (unit test `run-unit.mjs` ditambahkan).
- Sisa `window.confirm` pada `hero-carousel-actions.tsx` diganti `useConfirmDialog` (materi & ujian sudah sejak sebelumnya). Sisa hanya tombol bersihkan di pemutar kuis publik.
- Paritas navigasi ↔ feature flag: halaman kelas Guru men-gate "Susun Modul" (`learningModulesEnabled`) dan "Progres Aktivitas" (`activityCompletionEnabled` + `learningModulesEnabled`), sehingga menu tidak mengarah ke route 404 saat flag produksi mati.
- Cakupan uji baru: `tests/e2e/guru-workspace.spec.ts` (create/edit/cancel sesi, koreksi esai dari antrean → `CORRECTED`, rilis nilai per-siswa) dan perluasan `accessibility.spec.ts` (axe + touch-target halaman Guru) serta `production-navigation.spec.ts` (regresi navigasi).
- W10 (gradebook Siswa/Wali): kode sudah `exposeProvisionalScores:false`; assertion privacy eksplisit ada di `tests/run-week7-integration.mjs:106-123`.
- **Bug form ditemukan uji baru (R6):** `session-workspace.tsx` & `hasil-ujian-form.tsx` memanggil `event.currentTarget.reset()` setelah `await` (`null` di React) sehingga `router.refresh()` tidak jalan — sesi baru tidak tampil tanpa reload. Keduanya diperbaiki; pola sama di ~11 form lain dicatat di `docs/KNOWN_LIMITATIONS.md`.
- **Aksesibilitas & runner:** `aria-label` pada `<select>` `/guru/bank-soal` dan tombol "Simpan sesi" ≥44px; pembersihan DB `run-e2e-isolated.mjs` diberi retry agar `EBUSY` Windows tidak menggagalkan exit code.
- **Verifikasi:** `typecheck` lulus · `lint` 0 error · `npm test` **37 lulus** · e2e `accessibility` **5/5**, `production-navigation` **2/2**, `guru-workspace` **2/2** · integrasi `test:week7` lulus (termasuk assertion privacy).

**Yang ditambahkan pada sesi ini (di luar temuan audit awal):**

1. **Ujian online — paritas Google Forms (besar)**
   - Penegakan "wajib diisi" di server (sadar branching), grace window 20 detik + auto-submit (publik & wali), job `npm run quiz:finalize` untuk draf kedaluwarsa.
   - Kunci alternatif (`acceptedAnswers`), validasi angka/panjang/regex/jumlah pilihan, branching semua tipe pilihan, opsi "Lainnya" untuk dropdown, umpan balik benar/salah kustom.
   - Batas unggah per soal (tipe MIME + ukuran), email responden + limit 1 respons/email, salinan jawaban ke responden, notifikasi guru, **rilis nilai tertunda**, **mode satu soal per halaman**, **impor soal** (seluruh formulir & per-butir), **bank soal picker**, **penilaian manual respons publik** (esai/berkas/"Lainnya").
   - Builder: drag & drop lengkap (soal, opsi, kolom/baris tabel, section) + tombol ↑/↓, **lipat kartu soal**, **pencarian soal**, **undo/redo**, target sentuh ≥44px, ikon SVG.
   - Pemutar: **tinjau-sebelum-kirim**, **tombol Bersihkan**, paritas tema/gambar header di pemutar wali, **antrean unggah offline**, penautan `aria-labelledby`/`aria-describedby` per soal.
2. **Manajemen akun Guru & Wali** — CRUD, arsip/restore, reset password, kirim ulang aktivasi, impor CSV dengan pratinjau.
3. **Master data** — restore program/level/kelas + tombol Pulihkan di UI; filter opt-in di API master data, pendaftaran, bank soal, ujian.
4. **Sertifikat digital** (Sprint 3) — lihat bagian Sprint 3 di bawah.

**Ditambahkan pada sesi 25 Sep 2026 — ujian mandiri untuk siswa (Sprint 3 butir 11):**

5. **Ujian mandiri untuk siswa** — mode baru `ONLINE_VIA_SISWA` (dan `BOTH`) dapat dikerjakan siswa dari akun sendiri; `TEACHER_ENTRY` tetap diblokir.
6. **Skema**: `UjianAttempt.waliProfileId` menjadi nullable + `siswaAccountId` (FK `SiswaAccount`, `onDelete: SetNull`) + `startedByRole` (`WALI`/`SISWA`); migrasi `20260925010000_student_self_exam`. Service attempt digeneralisasi dengan "scope" bersama (satu jalur penilaian untuk wali & siswa).
7. **API + UI**: `GET /api/v1/siswa/ujian`, `POST /api/v1/siswa/ujian/[ujianId]/attempt`, `PATCH/POST /api/v1/siswa/attempt/[attemptId]` (+`/submit`, `/upload`); halaman `/siswa/ujian`, `/siswa/ujian/[ujianId]`, `/siswa/ujian/attempt/[attemptId]`; pemutar & tombol mulai dipakai ulang (parameter `basePath`/`endpoint`); entri menu "Ujian" + CTA di beranda/detail kelas siswa.
8. **Flag** `STUDENT_SELF_EXAM_ENABLED` (dev aktif, production nonaktif) + notifikasi publish ke siswa; isolasi attempt antar pemilik dan satu attempt aktif per (ujian, siswa) ditegakkan.
9. **Mode aman** — `Ujian.secureMode` (toggle form ujian & builder) membuat pemutar mencatat perpindahan tab ke `UjianAttempt.violationCount`/`lastViolationAt` via `POST /api/v1/{siswa,wali}/attempt/[attemptId]/violation` (hanya pemilik attempt); badge peringatan di pemutar, tampilan Guru di halaman koreksi hasil. Migrasi `20260925020000_exam_secure_mode_result_release`.
10. **Rilis nilai ke siswa** — `Ujian.showResultToSiswa`: saat ditahan, daftar ujian siswa menampilkan status **Dikirim** tanpa nilai dan nilai tidak muncul di beranda siswa.
11. **Unduh berkas jawaban siswa** — `GET /api/v1/siswa/attempt/[attemptId]/files/[fileId]` ber-scope pemilik; nama berkas pada pemutar menjadi tautan unduh.

**Ditambahkan pada sesi lanjutan 25 Sep 2026 — pengumuman & diskusi kelas (Sprint 3 butir 13, 3 fase):**

12. **Fase A — Pengumuman + status baca** — model `Pengumuman` (audience SISWA/WALI/SEMUA, prioritas, `publishAt`/`expiresAt`) + `PengumumanRead`, migrasi `20260925030000_pengumuman`; jadwal & kedaluwarsa dihitung saat query (idempoten); notifikasi `pengumuman-baru` instan + job `npm run pengumuman:publish` untuk jadwal; halaman guru/siswa/wali dengan tombol terbit/draf/arsip/pulihkan & tandai baca.
13. **Fase B — Ruang tanya jawab** — model `DiskusiThread` + `DiskusiBalasan`, migrasi `20260925040000_diskusi`; siswa membuat thread, **wali hanya membalas**; moderasi guru (pin/kunci/sembunyikan/soft-delete) + audit `DISKUSI_*`; notifikasi `diskusi-baru`/`diskusi-balasan` ke guru; edit balasan 15 menit.
14. **Fase C — Lapor konten + lampiran** — model `DiskusiLaporan` + `FileOwnerType += DISKUSI`, migrasi `20260925050000_diskusi_moderasi`; lampiran thread privat ber-scope kelas (unduh/hapus), lapor konten idempoten + antrean admin `/admin/diskusi-laporan`.
15. **Flag `CLASS_DISCUSSION_ENABLED` kembali dipakai sungguhan** (dev aktif, production nonaktif; lama dihapus sebagai flag mati). Scoping kelas terpusat di `assertViewKelasForum`/`assertManageKelasForum`.

**Ditambahkan pada sesi lanjutan 25 Sep 2026 — rekaman suara, antrean unggah persisten, voucher & kuitansi (Sprint 3 butir 14–15 + sisa Sprint 2):**

16. **Rekaman suara langsung di pemutar** — komponen `AudioRecorder` (MediaRecorder, `src/components/quiz/audio-recorder.tsx`) dipakai di pemutar wali/siswa **dan** tautan publik: rekam/jeda/berhenti, batas 5 menit, pratinjau, dan "rekam ulang"; hasil rekaman (audio/webm) memakai jalur unggah yang sudah ada (MIME audio sudah diizinkan server). Kontrol rekam hanya muncul bila soal mengizinkan audio.
17. **Konfigurasi unggah soal dibawa ke pemutar** — `uploadAllowedTypes`/`uploadMaxSizeMb` kini disurfacekan (`sanitizeQuestion` di `public-quiz-service.ts`; pemetaan halaman attempt wali `&` siswa) sehingga input berkas memakai `accept` yang tepat, batas ukuran divalidasi lebih awal di klien, dan tipe non-audio tidak menampilkan tombol rekam.
18. **Antrean unggah bertahan lintas reload (IndexedDB)** — helper baru `src/lib/upload-queue.ts`; antrean kini dipakai di **kedua** pemutar (publik + wali/siswa), bertahan setelah reload, dan otomatis diunggah saat koneksi pulih atau saat halaman dimuat kembali dalam keadaan online.
19. **Voucher/diskon** — model `Voucher` (+ enum `VoucherDiscountType`) dan kolom `Tagihan.subtotal`/`discountAmount`/`voucherId`, migrasi `20260925060000_vouchers_and_receipts`; service `voucher-service.ts` (buat/aktifkan/arsipkan, terapkan/lepas kode) dengan penegakan masa berlaku, minimal tagihan, dan kuota secara atomik; API `admin/voucher`, `admin/voucher/[id]`, `tagihan/[id]/voucher`; UI form + katalog voucher di halaman admin tagihan serta form pakai kode di kartu tagihan Wali/Admin.
20. **Kuitansi PDF** — `receipt-pdf-service.ts` (pdfkit) + `GET /api/v1/tagihan/[id]/kuitansi`; hanya untuk tagihan lunas, memuat subtotal, diskon/voucher, total dibayar, metode, dan referensi; tombol unduh di workspace Admin `&` Wali.
21. **Cicilan (angsuran) belum diimplementasikan** — membutuhkan kebijakan alokasi pembayaran parsial yang masih terbuka di PRD; disisakan agar tidak mengubah alur pembayaran penuh (gateway + rekonsiliasi) yang sudah teruji.

**Ditambahkan pada sesi lanjutan 25 Sep 2026 — e2e fitur baru (menutup celah cakupan):**

22. **E2E baru** `tests/e2e/student-exam.spec.ts` (ujian mandiri siswa + **rekaman suara nyata** via MediaRecorder & fake audio device + audit axe pemutar), `tests/e2e/class-forum.spec.ts` (guru buat pengumuman → siswa baca → siswa buat diskusi → wali balas → guru sematkan), `tests/e2e/billing-voucher.spec.ts` (admin buat voucher → wali pakai → rekonsiliasi → wali unduh kuitansi PDF). Ketiganya memakai setup Prisma sendiri + pembersihan, dan **lolos** di runner terisolasi.
23. **🐞 Bug produksi ditemukan & diperbaiki oleh e2e** — `next.config.ts` mengirim `Permissions-Policy: camera=(), microphone=()` sehingga `getUserMedia` **selalu ditolak**. Dampak: fitur rekaman suara di ujian, serta rekaman audio/video di pengumpulan tugas, **tidak akan pernah berfungsi** di browser. Diperbaiki menjadi `camera=(self), microphone=(self), geolocation=()` (tetap memblokir geolocation dan pihak ketiga).
24. **Perbaikan kontras** (temuan audit axe melalui e2e baru): badge "Bobot" di pemutar ujian dan teks bantuan/berkas komponen `AudioRecorder` (4.47 → ≥4.5), serta teks bantuan unggahan di pemutar publik.

**Ditambahkan pada sesi lanjutan 25 Sep 2026 — pengumuman sekolah, mode aman lebih kuat, cakupan voucher:**

25. **Pengumuman sekolah-wide** (`kelasId` null) — hanya Admin; muncul di daftar kelas siswa, halaman wali, dan halaman baru **`/admin/pengumuman`** (+ entri menu). Notifikasi sekolah-wide lewat `notifySekolahAktif` (semua siswa/wali aktif); job `pengumuman:publish` kini juga memproses pengumuman sekolah. Verifikasi: `test:diskusi` **24/24**.
26. **Mode aman lebih kuat** — pemutar ujian menambah tombol **layar penuh**, memblokir tempel/salin/potong/klik-kanan, dan mencatat keluar layar penuh sebagai pelanggaran (semua lewat endpoint pelanggaran yang sama). Verifikasi: e2e `student-exam` **2/2** (rekaman suara + mode aman).
27. **Cakupan voucher per program/kelas** — kolom `Voucher.programId`/`kelasId` (migrasi `20260925070000_voucher_scope`); penerapan menolak voucher yang tidak sesuai program/kelas siswa. Verifikasi: `test:billing-voucher` **9/9**.
28. **Lampiran pada balasan diskusi** — kolom `FileAsset.diskusiBalasanId` + relasi `DiskusiBalasan.attachments` (migrasi `20260925080000_diskusi_balasan_lampiran`); service `attachDiskusiReplyFile`/`getDiskusiReplyFile`/`removeDiskusiReplyAttachment` (hanya penulis balasan atau pengelola kelas; unduh ber-scope kelas); route `diskusi/replies/[replyId]/attachments`; UI lampiran di kartu balasan. Verifikasi: `test:diskusi` **25/25**.
29. **Rilis nilai per attempt/hasil** — kolom `HasilUjian.releasedAt` (migrasi `20260925090000_exam_result_release_per_student`); service `releaseHasilUjian` (guru pengampu/admin, hanya untuk hasil FINAL/CORRECTED); route `POST /api/v1/hasil-ujian/[hasilId]/release`; tombol "Rilis nilai" di halaman hasil guru. Semua query visibilitas nilai siswa/wali (daftar ujian, beranda siswa, beranda wali, laporan) kini menghormati `releasedAt` di samping flag global. Verifikasi: `test:siswa-ujian` **14/14**.

**Belum dikerjakan (dengan alasan):**
- **Cicilan/angsuran** — butuh keputusan kebijakan alokasi pembayaran parsial (masih terbuka di PRD); tidak diubah agar alur pembayaran penuh tetap teruji.
- **Q&A per materi/modul** (enum `DISCUSSION`) — task besar: perlu menghubungkan diskusi ke Materi/LearningModule + UI baru.
- **Mode "angkat & pindah" drag via keyboard penuh di builder** — pengurutan keyboard sudah tersedia lewat tombol ↑/↓; mode drag penuh belum dibuat.

**Verifikasi terakhir (semua hijau):**
- `npm run typecheck` lulus · `npm run lint` **0 error** · `npm test` **36 lulus**
- Integration: `test:sertifikat` 7/7 · `test:quiz-builder` 22/22 · `test:accounts` 11/11 · `test:quiz-share` 5/5 · `test:siswa-ujian` **14/14** · `test:diskusi` **25/25** · `test:billing-voucher` **9/9** · `test:payment` 1/1
- E2E (runner terisolasi, 25 Sep): `student-exam` **2/2** (rekaman suara nyata + mode aman + audit axe) · `class-forum` 1/1 · `billing-voucher` 1/1 · `mobile-layout` 16/16 · `quiz-builder` 2/2 (termasuk audit axe pemutar publik).
- ⚠️ `test:week3` (billing) **gagal di lingkungan ini karena sebab pra-ada, bukan dari perubahan ini**: assert `/Gerbang Pembayaran: Mayar/` tidak cocok (React memecah `Gerbang Pembayaran: {label}` jadi dua text node) dan gateway Mayar tidak terkonfigurasi di seed. Halaman `/admin/tagihan` `&` `/wali/tagihan` tetap ter-render 200 (diverifikasi manual).

**Langkah berikutnya (mulai dari sini):**
1. ~~Ujian mandiri untuk siswa~~ ✅ selesai (25 Sep 2026) — mode `ONLINE_VIA_SISWA`, halaman `/siswa/ujian`, plus mode aman (layar penuh + anti-tempel), **rilis nilai per attempt**, rilis nilai ke siswa, dan unduh berkas jawaban siswa.
2. ~~Diskusi kelas + pengumuman~~ ✅ selesai (25 Sep 2026, 3 fase + pengumuman sekolah-wide + **lampiran pada balasan**). Sisa Fase 9: Q&A per materi/modul (enum `DISCUSSION` masih ditolak service).
3. ~~Rekaman speaking langsung di pemutar (MediaRecorder)~~ ✅ selesai (25 Sep 2026) — komponen `AudioRecorder` dipakai di pemutar wali/siswa & tautan publik; konfigurasi unggah soal ikut disurfacekan ke pemutar. Sisa kecil: pengaturan durasi rekam per soal.
4. ~~Voucher/diskon + kuitansi PDF~~ ✅ selesai (25 Sep 2026), termasuk **cakupan voucher per program/kelas**. Sisa: **cicilan/angsuran** (butuh kebijakan alokasi pembayaran parsial).
5. ~~Sisa kecil Sprint 2: antrean unggah bertahan lintas reload (IndexedDB) + terapkan di tautan publik~~ ✅ selesai (25 Sep 2026). **Sisa:** mode "angkat & pindah" drag via keyboard penuh di builder (pengurutan ↑/↓ sudah ada).
6. ~~Pengumuman sekolah-wide~~ ✅ selesai (25 Sep 2026). **Lampiran pada balasan diskusi** ✅ dan **rilis nilai per attempt** ✅ juga selesai. Sisa Fase 9: **Q&A per materi/modul** (enum `DISCUSSION`).

**Ide berikutnya:** Q&A per materi/modul, mode "angkat & pindah" drag keyboard penuh, gamifikasi/leaderboard, chat guru–wali, cicilan (setelah kebijakan billing).

**Catatan operasional saat melanjutkan:**
- Dev server harus dijalankan dengan `NODE_ENV=development` (environment shell ini default `NODE_ENV=production`, membuat seed demo & `.env.local` tidak dipakai): `set NODE_ENV=development&& npm run dev`.
- Jika `npm run typecheck` gagal karena file di `.next/dev/types`, hapus folder `.next` lalu ulangi (artefak dari `next dev` yang dihentikan).
- Integration test butuh dev server berjalan; jalankan per suite: `npm run test:quiz-builder`, `test:sertifikat`, `test:accounts`, `test:siswa-ujian`, `test:diskusi`, `test:billing-voucher`.
- **Rate limit in-process**: kuota per instance dengan jendela 15 menit. `test:diskusi` sudah membuat akun luar-kelas segar tiap run untuk uji rate limit, tapi kuota akun `guru`/`admin`/`siswa` masih menumpuk — bila test dijalankan berulang >~3× dalam 15 menit, jalankan **restart dev server** dulu.
- Pastikan `STUDENT_SELF_EXAM_ENABLED=true` dan `CLASS_DISCUSSION_ENABLED=true` di env yang dipakai test (default development sudah `true`; `.env.example` sudah mencantumkan keduanya).
- Cron baru: `npm run pengumuman:publish` **tiap menit** (idempoten) untuk notifikasi pengumuman berjadwal — daftarkan bersama job lain di `docs/DEPLOYMENT.md`.
- E2E memakai runner terisolasi (DB + server sendiri per spec): `set E2E_SPEC=<nama>.spec.ts&& npm run test:e2e`. Suite penuh lambat (satu spec = satu siklus) — jalankan per spec atau di CI.
- Setelah menjalankan `next dev`, kembalikan `tsconfig.json` bila berubah: `git checkout -- tsconfig.json`. *(Status terakhir 25 Sep: bersih.)*
- Migrasi MariaDB production belum dijalankan (verifikasi memakai SQLite). Migrasi baru yang menunggu: `20260925010000_student_self_exam`, `20260925020000_exam_secure_mode_result_release`, `20260925030000_pengumuman`, `20260925040000_diskusi`, `20260925050000_diskusi_moderasi`, `20260925060000_vouchers_and_receipts`, `20260925070000_voucher_scope`, `20260925080000_diskusi_balasan_lampiran`, `20260925090000_exam_result_release_per_student`.
- Setelah menambah model Prisma, jalankan `set NODE_ENV=development&& npm run sqlite:setup` agar `dev.db` lokal + Prisma Client sinkron (script seed diblokir bila `NODE_ENV=production`).

---

## Konteks Skala (terverifikasi)

- **117 halaman** Next.js App Router, **221 route API** (`/api/v1/**`), **54 service**, **48 migrasi Prisma** (diukur 25 Sep; saat audit 24 Sep: 98 / 172 / 46 / 39).
- Satu aplikasi Next.js 16 full-stack (React 19, TypeScript, Prisma + MariaDB, session database).
- Test: 36 unit test, ~24 harness integrasi (yang rutin hijau: `quiz-builder` 22, `accounts` 11, `sertifikat` 7, `siswa-ujian` 14, `diskusi` 25, `billing-voucher` 9), ~23 spec Playwright (termasuk accessibility, mobile-layout, dan 3 spec fitur baru).
- Dokumentasi: `PRD.md`, `IMPLEMENTATION_PLAN.md`, `fitur.md`, `progress.md`, 27 dokumen di `docs/`.

---

## 1. Fitur yang sudah tepat dan berfungsi

### Landing & konten publik
Hero carousel (dikelola admin, gambar desktop/mobile), informasi program, kebijakan privasi, syarat penggunaan, sitemap, robots, manifest PWA, metadata Open Graph.

### Pendaftaran online (revisi v2)
Wizard 4 langkah (pilih program → data peserta "Diri sendiri"/"Anak" → formulir khusus per program → persetujuan), unggah dokumen privat dengan validasi ekstensi/MIME/magic bytes, cek status via kode + email/WhatsApp, approval **idempoten**, penolakan dengan alasan, riwayat status, ekspor PDF/Excel per pendaftar dan massal, notifikasi otomatis submit/approve/reject.

### Autentikasi & RBAC
Session berbasis database + cookie `HttpOnly`, Argon2id, idle/absolute timeout, revoke sesi, reset/ubah password, aktivasi akun, pengecekan origin untuk mutasi (`assertSameOrigin`), policy terpusat (`access-policy`) dengan scoping guru/wali/siswa, audit log pada hampir semua mutasi.

### Manajemen akun & pengguna
CRUD akun guru/wali, arsip (soft delete) + restore, aktif/nonaktif, kirim link reset password, kirim ulang aktivasi, impor CSV dengan pratinjau + deteksi duplikat, akun portal siswa + aktivasi, daftar pengguna dengan filter role/status.

### Akademik inti
Program/level/kelas, data siswa + relasi wali many-to-many + histori mutasi kelas, sesi kelas (draft/final, terkunci saat final), presensi per sesi, progres belajar 1–5 (catatan publik vs internal), RPP (form & unggah Word/PDF), learning module, tugas + submission berversi + rubrik + gradebook (kategori/bobot/final grade), remedial + permintaan revisi, kalender, to-do per role.

### Ujian online (fokus pengembangan terakhir)
- 12 tipe soal (pilihan ganda, kotak centang, dropdown, isian singkat, paragraf, benar/salah, skala, rating, tanggal, waktu, tabel pilihan, unggah berkas).
- Section + branching untuk semua tipe pilihan; drag & drop lengkap (soal, opsi, kolom tabel, baris tabel, section) + tombol naik/turun untuk keyboard.
- Kunci alternatif, feedback benar/salah kustom, validasi server (angka/panjang/regex/jumlah pilihan).
- Penegakan "wajib diisi" di server (sadar branching), grace window 20 detik + auto-submit (jalur publik **dan** wali), job finalisasi draf kedaluwarsa.
- Batas unggah per soal (tipe MIME + ukuran), email responden + batas 1 respons per email, salinan jawaban ke responden, notifikasi guru.
- Rilis nilai tertunda (`releaseMode`), mode satu soal per halaman, impor soal dari formulir lain, penilaian manual respons publik (esai/berkas/opsi "Lainnya").
- Koreksi guru dengan audit, cetak PDF (termasuk kunci, dukungan teks Arab), analisis benar/salah per soal, ekspor CSV.

### Billing & pembayaran
Tarif, tagihan unik per siswa + periode + jenis, job penandaan overdue, dua gateway (Mayar primary + Pakasir), webhook tervalidasi + idempoten, rekonsiliasi, ledger pembayaran, ringkasan admin & wali.

### Notifikasi
In-app, email SMTP, dan WhatsApp via n8n/GOWA; klaim atomik status `PROCESSING`; retry terjadwal; log pengiriman admin + aksi kirim ulang.

### Operasional
Health/readiness probe, backup/restore (dump SQL + ZIP dengan checksum, validasi path traversal), 12+ job terjadwal lewat script + `flock`, audit log + ekspor, file manager privat, konfigurasi Docker/Dokploy, PM2, security headers, dan `Cache-Control: no-store` pada API.

---

## 2. Yang harus diperbaiki (P0 — risiko/bug)

1. **API list mengabaikan query param di beberapa endpoint.** Terverifikasi hanya `admin/guru`, `admin/wali`, `admin/siswa` yang mem-parse `searchParams`. `admin/pendaftaran` memanggil `listPendaftaran(actor)` tanpa filter, sedangkan master data (`listPrograms`/`listLevels`/`listKelas`) tidak memiliki filter maupun pagination. Dampak: otomasi/integrasi tidak bisa memfilter dan halaman berpotensi memuat seluruh data.
2. **Lint CI gagal karena folder skill AI.** `npm run lint` menghasilkan error di `.agents`, `.augment`, `.cursor`, `.claude`, dan sejenisnya. Perlu `ignores` pada konfigurasi ESLint agar gate kualitas hijau.
3. **Migrasi & parity test MariaDB production belum dijalankan.** Seluruh verifikasi saat ini memakai SQLite; `prisma/schema.prisma` sudah bertarget MySQL. Risiko: perbedaan collation, presisi `Decimal`, batas `VarChar`, dan concurrency.
4. **Kredensial & UAT eksternal belum tuntas.** Mayar production, SMTP/n8n, workflow GOWA nyata, dan backup off-site belum diuji end-to-end. Gate 2–3 `docs/PRODUCTION_READINESS.md` masih unchecked.
5. **Rate limit masih in-process.** Tidak akurat bila aplikasi dijalankan multi-instance; butuh Redis atau pembatasan di reverse proxy.
6. **`MAX_QUIZ_UPLOAD_MB` default 0 (tanpa batas).** Soal unggah berkas bisa dipakai menyimpan berkas besar tanpa batas. Perlu default aman (mis. 25 MB).
7. **Feature flag mati.** `CLASS_DISCUSSION_ENABLED` ada di `env.ts` dan `feature-flags.ts` tetapi tidak ada UI/API diskusi. *(Status 25 Sep: flag sempat dihapus dari tree karena mati, lalu **dihidupkan kembali** bersama fitur pengumuman/diskusi dan kini dipakai sungguhan — lihat butir 7 di tabel.)*
8. **Cakupan e2e kuis tipis.** `tests/e2e/quiz-builder.spec.ts` hanya berisi 1 test; belum ada e2e untuk drag & drop, mode satu soal per halaman, rilis nilai, penilaian manual, dan tampilan 360px.
9. **Dua test mobile-layout gagal** (selector kelas usang dan baseline screenshot RTL Arab) sesuai catatan `progress.md`.
10. **`next dev` menulis ulang `tsconfig.json`** (menambah path tipe otomatis), sehingga mengotori working tree setiap kali server dev dijalankan.

### Status perbaikan P0 (24 Sep 2026)
| # | Temuan | Status |
|---|---|---|
| 1 | API list mengabaikan query param | ✅ Selesai — `guru`, `wali`, `siswa`, `pendaftaran`, master data (program/level/kelas), `bank-soal`, `ujian` sudah memfilter; `tagihan`/`pembayaran` sudah sejak awal. Sisa: endpoint list khusus `audit` (kini hanya export). |
| 2 | Lint gagal karena folder skill AI | ✅ Selesai — `ignores` ESLint ditambahkan, lint 0 error |
| 3 | Migrasi & parity MariaDB | ⏳ Belum (butuh akses database staging) |
| 4 | Kredensial & UAT eksternal | ⏳ Belum (butuh kredensial produksi) |
| 5 | Rate limit in-process | ⏳ Belum (butuh Redis) |
| 6 | `MAX_QUIZ_UPLOAD_MB` tanpa batas | ✅ Selesai — default 25 MB (env + contoh env) |
| 7 | Feature flag diskusi mati | ✅ Selesai (24 Sep) — flag sempat dihapus dari kode/CI/compose/docs karena mati; **25 Sep dihidupkan kembali** bersama fitur pengumuman/diskusi dan kini dipakai sungguhan (env, CI, Compose, docs) |
| 8 | e2e kuis tipis | ✅ Sebagian — 1 test baru (handle urut + satu soal per halaman + 360px); drag visual & penilaian manual masih tertutup integration test |
| 9 | 2 test mobile-layout gagal | ✅ Selesai — selector diperjelas + baseline diperbarui, 16/16 lulus |
| 10 | `tsconfig.json` ditulis ulang `next dev` | ⏳ Belum |
| — | (baru) Runner e2e tidak menetapkan `NODE_ENV` | ✅ Selesai — runner memaksa `NODE_ENV=development` |
| — | (baru) Suite e2e terisolasi lambat (satu spec = satu DB+server) | ⏳ Belum — usulan optimasi |


---

## 3. Yang harus diubah atau ditingkatkan (P1)

### Modul & CRUD
- Banyak modul belum memiliki ubah/hapus/arsip lengkap (diakui `docs/KNOWN_LIMITATIONS.md`): program, level, kelas, tarif, dan beberapa modul lain. Standarkan pola create/update/archive/restore seperti modul akun.
- ~~**Siswa belum dapat mengerjakan ujian melalui akun sendiri**~~ — ✅ selesai 25 Sep (mode `ONLINE_VIA_SISWA`, portal `/siswa/ujian`).
- ~~Belum ada **halaman tinjau jawaban sebelum kirim** dan **tombol bersihkan formulir** pada pemutar~~ — ✅ selesai pada Sprint 2.
- Sisa P1 modul: `Tarif` belum punya update/arsip/UI; `admin/audit` belum punya endpoint list (hanya export).

### Arsitektur & kode
- **Sisa duplikasi logika penilaian** di tiga jalur (publik/wali/guru). Sebagian sudah dipusatkan di `src/server/services/quiz-grading.ts`; lanjutkan agar `exam-service` memakai satu fungsi yang sama.
- **Konsistensi API**: terapkan skema list (page/pageSize/filter/sort allowlist) ke seluruh endpoint list, bukan hanya 3.
- **Duplikasi komponen dashboard**: banyak workspace serupa; pertimbangkan primitives bersama (DataTable, FilterBar, StatusBadge sudah tersedia).
- **Ikon emoji** (⠿, 🖼, ↑, ↓) pada builder sebaiknya diganti set ikon SVG agar konsisten lintas OS.

### UX & aksesibilitas
- ~~Builder: kartu soal dapat dilipat, undo/redo, pencarian soal, pemilih soal dari bank soal, impor per-butir~~ — ✅ Sprint 2.
- ~~Pemutar wali belum paritas tema/gambar header~~ — ✅ Sprint 2.
- ~~Aksesibilitas `helpText`→`aria-describedby`, target sentuh ≥44px~~ — ✅ Sprint 2. **Sisa:** drag via keyboard penuh, audit axe belum mencakup seluruh halaman.
- **Sisa:** builder padat pada 360px; belum ada e2e/snapshot kuis mobile. *(✅ 25 Sep: e2e untuk fitur ujian-siswa, pengumuman, diskusi, rekaman suara, dan voucher/kuitansi sudah ditambahkan.)*

### Performa & observability
- Belum ada audit N+1 query, caching data referensi, atau batas keras pagination di semua list.
- Belum ada error tracking, metrik, atau tracing; logging sudah terstruktur + requestId.
- Belum ada uji beban untuk puncak pemakaian (mis. ujian serentak ratusan siswa).

### Keamanan (hardening lanjutan)
- Content-Security-Policy belum ada (baru X-Frame-Options, nosniff, referrer policy). *(25 Sep: `Permissions-Policy` diperbaiki dari `camera=(), microphone=()` menjadi `camera=(self), microphone=(self), geolocation=()` karena header lama mematikan fitur rekaman.)*
- Belum ada 2FA untuk admin.
- Belum ada pembatasan ukuran payload eksplisit di level aplikasi (mengandalkan Nginx).
- Session belum memiliki rotasi token berkala.

---

## 4. Fitur yang seharusnya ada (kelengkapan LMS kursus digital)

### Akademik & pembelajaran
1. **Ujian/kuis mandiri untuk siswa** (bukan hanya via wali) + mode aman (deteksi perpindahan tab, batas waktu, acak). *(✅ 25 Sep — mode aman dasar: deteksi perpindahan tab + catatan pelanggaran; anti-paste/fullscreen masih backlog.)*
2. **Forum/diskusi kelas** (flag sudah ada, UI belum) + Q&A per materi. *(✅ 25 Sep — pengumuman & diskusi kelas dibangun 3 fase; Q&A per materi/modul masih backlog.)*
3. **Sertifikat/rapor digital** otomatis saat menyelesaikan program/kelas, dengan QR verifikasi.
4. **Gamifikasi**: poin, badge, streak, leaderboard kelas (opsional, ramah anak).
5. **Pustaka materi lintas kelas** + bank soal bersama dengan tagging kurikulum.
6. **Pemetaan kurikulum/silabus** (CEFR/AKM sudah ada di metadata soal; tinggal dipetakan ke modul).
7. **Rekaman speaking/audio** dan interaksi menjodohkan/urutan berbasis drag di pemutar.
8. **Live class / meeting link** (Zoom/Meet) + absensi otomatis.
9. **Presensi QR/kode** untuk kelas offline.
10. **Tugas kelompok** dan **bank rubrik institusi**.

### Keuangan & operasional
11. **Voucher/diskon, beasiswa, prorate, cicilan** (kebijakan billing sebagian masih terbuka di PRD).
12. **Kuitansi/invoice PDF otomatis** dan pengingat berjenjang (pengingat dasar sudah ada).
13. **Laporan keuangan & ekspor akuntansi**.

### Komunikasi & keterlibatan
14. **Chat guru–wali** (saat ini komunikasi hanya satu arah lewat notifikasi).
15. **Broadcast/pengumuman** per kelas/sekolah dengan status baca (fondasi notifikasi sudah ada). *(✅ 25 Sep — per kelas sudah berstatus baca; broadcast sekolah (`kelasId` null) masih backlog.)*
16. **Survei/evaluasi kepuasan** per kelas/guru.

### Platform & teknis
17. **Aplikasi mobile / PWA offline-first** dengan antrean sinkronisasi (PWA dasar sudah ada; data privat tidak dicache).
18. **Multi-cabang/multi-tenant** (bukan sasaran MVP, dibutuhkan saat ekspansi).
19. **SSO/login Google** dan 2FA admin.
20. **Object storage** (S3/R2) dengan signed URL untuk berkas privat.
21. **Rate limit terdistribusi** dan **CSP**.
22. **Observability**: error tracking, metrik, uptime, dan backup off-site yang telah diuji restore.

---

## 5. Roadmap prioritas (step by step)

### Sprint 0 — Menghijaukan gate kualitas (cepat, dampak besar)

**Status: SELESAI (24 Sep 2026)**

1. ✅ Tambahkan `ignores` ESLint untuk folder skill AI agar `npm run lint` hijau. *(0 error, hanya 3 warning `<img>` yang sudah ada sebelumnya.)*
2. ✅ Perbaiki test `mobile-layout`: selector ambigu pada kartu materi Arab (dua kartu cocok) diperjelas; baseline screenshot usang diperbarui.
3. ✅ Tambah e2e kuis: handle urut drag & drop, mode satu soal per halaman, dan tanpa overflow di 360px.
4. ✅ Tetapkan default aman `MAX_QUIZ_UPLOAD_MB=25` (env + `.env.example`) dan dokumentasikan.

**Temuan tambahan (bug harness, diperbaiki di Sprint 0)**
- `scripts/run-e2e-isolated.mjs` tidak menetapkan `NODE_ENV`, sehingga pada shell dengan `NODE_ENV=production` seed demo ditolak dan seluruh suite e2e gagal. Runner kini memaksa `NODE_ENV=development`.

**Kriteria selesai:** `lint`, `typecheck`, `npm test`, dan `test:e2e` hijau. *(Verifikasi: lint 0 error; typecheck lulus; 34 unit test lulus; e2e mobile-layout 16/16 dan quiz-builder 2/2 lulus.)*


### Sprint 1 — Konsistensi API & CRUD (fondasi)

**Status: SEBAGIAN SELESAI (24 Sep 2026)**

5. ✅ Terapkan skema list (page/filter/sort) ke endpoint list.
   - ✅ `admin/pendaftaran` mem-parse `page`, `pageSize`, `search`, `status`.
   - ✅ Master data (`admin/program`, `admin/level`, `admin/kelas`) menerima filter opt-in: `search`, `programId`, `status` (kelas). Default hasil tidak berubah sehingga UI tidak regresi.
   - ✅ `bank-soal` menerima `search`, `type`, `kelasId` + pagination.
   - ✅ `ujian` menerima `search`, `status`, `kelasId` + pagination.
   - ✅ `tagihan` dan `pembayaran` sudah mem-parse `search`, `status`, `page`, `pageSize`, dan konteks anak.
   - ⚠️ `admin/audit` belum punya endpoint list (hanya `export`); daftar audit dibaca langsung oleh Server Component. Tambahkan endpoint list bila dibutuhkan otomasi.
6. ✅ Lengkapi update/archive/restore master data.
   - ✅ Service baru: `restoreProgram`, `restoreLevel`, `restoreKelas` (+ audit `*_RESTORED`).
   - ✅ Endpoint baru: `POST /api/v1/admin/{program,level,kelas}/[id]/restore`.
   - ✅ UI: `MasterDataActions` kini menampilkan tombol **Pulihkan** saat data terarsip (selain Edit + Arsipkan); sudah dipakai di halaman program, level, dan kelas.
   - ⚠️ `Tarif` masih hanya punya `createTarif` + `listTarif` (belum ada update/arsip/UI) — dicatat sebagai sisa pekerjaan billing.
7. ✅ Hapus feature flag mati `CLASS_DISCUSSION_ENABLED` dari kode (`env.ts`, `feature-flags.ts`), CI, Docker Compose, contoh env, dan dokumentasi aktif. *(25 Sep: flag **dihidupkan kembali** bersama fitur pengumuman/diskusi dan kini dipakai sungguhan — lihat Sprint 3 butir 13.)*

**Verifikasi Sprint 1:** `npm run typecheck` lulus · `npm run lint` 0 error · `npm test` 34 lulus · integration `test:accounts` **11/11 lulus** (termasuk ubah/arsip/pulihkan program) · integration `test:quiz-builder` **20/20** (termasuk filter bank soal & ujian) · e2e `mobile-layout` **16/16** dan `quiz-builder` **2/2** lulus.

### Sprint 2 — Paritas & UX (DIMULAI)

**Status: SEBAGIAN (24 Sep 2026)**

8. Builder:
   - ✅ Kartu soal dapat **dilipat/dibuka** (tombol Lipat/Buka + `aria-expanded` + ringkasan pertanyaan di header).
   - ✅ **Pencarian soal** (menyaring berdasarkan pertanyaan/petunjuk + penanda "x dari y soal cocok").
   - ✅ **Undo/redo** (riwayat 50 langkah dengan penggabungan 700 ms, tombol di toolbar, pintasan `Ctrl/Cmd+Z` dan `Ctrl/Cmd+Shift+Z`/`Ctrl+Y`; tidak menyerobot undo di dalam input).
   - ✅ **Bank soal picker**: dialog pencarian + pilih banyak soal lalu "Tambahkan ke formulir" (endpoint `POST /api/v1/kuis/[id]/questions`, melewati soal duplikat, tercatat di audit `QUIZ_QUESTIONS_ADDED_FROM_BANK`).
   - ✅ **Impor soal per-butir**: dialog impor kini memuat daftar soal formulir sumber dan memungkinkan memilih sebagian soal (atau "Impor semua soal"). Terverifikasi: memilih 1 soal menghasilkan `imported = 1`.
   - ✅ **Target sentuh ≥44px**: tombol aksi builder (lipat, naik/turun, duplikat, hapus, handle drag) dinaikkan ke `min-h-11`/`min-w-11`.
   - ✅ **Ikon SVG** menggantikan emoji (handle drag dan tombol gambar opsi) agar konsisten lintas OS.
9. Pemutar:
   - ✅ **Tinjau sebelum kirim**: dialog "Tinjau jawaban" menampilkan jumlah terisi/kosong per bagian sebelum submit (menggantikan `window.confirm`).
   - ✅ **Tombol Bersihkan** untuk mengosongkan jawaban pada bagian aktif.
   - ✅ **Paritas pemutar wali**: tema warna kuis (aksen pada bilah progres & tombol utama) dan **gambar header** kini tampil di pemutar wali, sama seperti tautan publik. Helper tema diekstrak ke `src/lib/quiz-theme.ts` agar dipakai kedua pemutar (menghapus duplikasi).
   - ✅ **Antrean unggah offline**: berkas yang gagal terunggah (atau saat koneksi putus) disimpan di antrean, ditandai di header jumlahnya, dan diunggah otomatis saat koneksi pulih.
   - ✅ **Antrean bertahan lintas reload (IndexedDB) + dipakai di tautan publik** (25 Sep 2026, `src/lib/upload-queue.ts`).
10. Aksesibilitas:
   - ✅ Tiap soal kini berupa `role="group"` dengan `aria-labelledby` (teks pertanyaan) dan `aria-describedby` (petunjuk) di kedua pemutar.
   - ✅ **Audit axe halaman kuis** ditambahkan ke e2e pemutar publik. Audit menemukan **pelanggaran kontras nyata** (label "Wajib/Opsional" memakai `text-gray-400`, rasio 2.67 vs minimum 4.5) → diperbaiki ke `text-gray-500`; audit kini lulus.
   - ⏳ Sisa: operasi drag via keyboard penuh (saat ini sudah tersedia pengurutan lewat tombol ↑/↓).

**Verifikasi Sprint 2:** `npm run typecheck` lulus · `npm run lint` 0 error · `npm test` 34 lulus · integration `test:quiz-builder` **22/22 lulus** (termasuk impor per-butir, bank soal picker, filter, alur wali, penilaian manual) · e2e `quiz-builder` **2/2 lulus** termasuk **audit axe pemutar publik** (kontras, label grup soal, target sentuh).


**Temuan tambahan (harness, perlu ditindaklanjuti)**
- Suite e2e terisolasi sangat lambat: setiap spec membuat database baru + seed + menyalakan dev server sendiri (satu file spec = satu siklus). Untuk suite penuh perlu jendela waktu panjang; disarankan membagi/sharing server dan hanya mengisolasi DB per spec, atau menjalankan suite penuh di CI (bukan lokal).

**Kriteria selesai:** setiap endpoint list memiliki pagination + filter terdokumentasi; tidak ada modul master tanpa mekanisme arsip. *(Belum tercapai seluruhnya — lihat butir 5 dan 6.)*


### Sprint 2 — Paritas & UX
8. Builder: lipat kartu soal, undo/redo, cari soal, pemilih soal dari bank soal, impor per butir, ikon SVG.
9. Pemutar: halaman tinjau-sebelum-kirim, tombol bersihkan, paritas pemutar wali (tema & fokus), antrean unggah saat offline.
10. Aksesibilitas: `aria-describedby`, target sentuh ≥44px, audit axe seluruh halaman kuis, operasi drag via keyboard.

**Kriteria selesai:** skor UI/UX setiap sisi >95% sesuai metrik audit.

### Sprint 3 — Kelengkapan LMS inti
11. Ujian mandiri untuk siswa + mode aman.
12. Sertifikat/rapor digital + QR.
13. Diskusi kelas + pengumuman.
14. Rekaman speaking + interaksi drag match/order.
15. Voucher/diskon + kuitansi PDF.

### Sprint 3 — Kelengkapan LMS inti (DIMULAI)

**Status: SEBAGIAN (24 Sep 2026)**

11. ✅ **Sertifikat digital + verifikasi publik** (slice pertama Sprint 3):
    - Model baru `Sertifikat` (kode unik `LIMO-<tahun>-<8 karakter>`, judul, catatan, penerbit, waktu terbit, pencabutan) + migrasi `20260924030000_certificates`.
    - Service `certificate-service.ts`: penerbitan (ADMIN atau GURU pengampu kelas), daftar ter-scope per role (admin/guru/wali/siswa), pencabutan dengan alasan, dan verifikasi publik tanpa login.
    - **PDF sertifikat** A4 landscape (pdfkit) memuat nama siswa (mendukung teks Arab via Amiri + reshaper/bidi), program, kelas, level, tanggal, kode, dan URL verifikasi.
    - Endpoint: `GET/POST /api/v1/sertifikat`, `GET /api/v1/sertifikat/[id]/pdf`, `GET /api/v1/public/sertifikat/[code]`, `POST /api/v1/admin/sertifikat/[id]/revoke`.
    - UI: halaman **`/admin/sertifikat`** (form penerbitan bertingkat kelas → siswa, daftar, unduh PDF, cabut) + entri menu admin, serta halaman publik **`/verifikasi-sertifikat/[code]`**.
    - Verifikasi: `npm run test:sertifikat` **7/7 lulus** (terbit, anti-duplikat 409, verifikasi publik, halaman verifikasi sah/tidak ditemukan, PDF `%PDF` + `application/pdf`, otorisasi 403, pencabutan + idempoten).
12. ✅ **Ujian mandiri untuk siswa** (bukan hanya via akun wali) — mode `ONLINE_VIA_SISWA`; `UjianAttempt.waliProfileId` nullable + `siswaAccountId`/`startedByRole` (migrasi `20260925010000_student_self_exam`); layanan/route/halaman ber-scope siswa + pemutar siswa (`/siswa/ujian`); isolasi attempt antar pemilik ditegakkan. Ditambah **mode aman** (`Ujian.secureMode`), **kontrol rilis nilai** (`Ujian.showResultToSiswa`), dan **unduh berkas jawaban siswa** (migrasi `20260925020000_exam_secure_mode_result_release`). Verifikasi: `test:siswa-ujian` **13/13**.
13. ✅ **Diskusi kelas + pengumuman** — dibangun 3 fase: pengumuman + status baca (audience/prioritas/jadwal), thread + balasan + moderasi (pin/kunci/sembunyikan/soft-delete + audit), lapor konten + lampiran privat + antrean admin. Flag `CLASS_DISCUSSION_ENABLED` kini dipakai sungguhan. Deviasi disetujui: wali boleh membalas (tidak boleh membuat thread). Verifikasi: `test:diskusi` **23/23**.
14. ✅ **Rekaman speaking langsung di pemutar (MediaRecorder)** — komponen `AudioRecorder` dipakai di pemutar wali/siswa & tautan publik; konfigurasi unggah soal (`uploadAllowedTypes`/`uploadMaxSizeMb`) disurfacekan ke pemutar; antrean unggah kini persisten (IndexedDB) di kedua pemutar.
15. 🔄 **Voucher/diskon + kuitansi PDF** ✅ — model `Voucher` + kolom diskon `Tagihan` (migrasi `20260925060000_vouchers_and_receipts`), service/route voucher (terapkan/lepas dengan kuota & masa berlaku), PDF kuitansi untuk tagihan lunas, UI di Admin & Wali. **Sisa: cicilan/angsuran** (kebijakan pembayaran parsial masih terbuka di PRD).

**Verifikasi Sprint 3 (sejauh ini):** `npm run typecheck` lulus · `npm run lint` 0 error · `npm test` **36 lulus** · integration `test:sertifikat` **7/7** · `test:siswa-ujian` **13/13** · `test:diskusi` **23/23** · `test:billing-voucher` **8/8**.

### Sprint 4 — Produksi & skala

16. Jalankan migrasi & parity test MariaDB staging; UAT Mayar/SMTP/n8n end-to-end.
17. Redis rate limit + CSP + 2FA admin.
18. Object storage + backup off-site teruji (restore drill).
19. Observability (error tracking, metrik) + uji beban ujian serentak.

---

## Kesimpulan

Fondasi aplikasi **kuat dan fungsional** (akademik, billing, ujian online, RBAC, audit, job terjadwal sudah matang), dengan utang utama pada:
1. **konsistensi API/CRUD** (filter & pagination, kelengkapan update/arsip),
2. **kelengkapan LMS** — ujian mandiri siswa, sertifikat, dan diskusi/pengumuman sudah selesai (25 Sep); tersisa rekaman speaking, Q&A per materi/modul, voucher/diskon + kuitansi, gamifikasi, dan chat guru–wali.
3. **kesiapan produksi** (migrasi MariaDB, kredensial eksternal, rate limit terdistribusi, observability).

Urutan Sprint 0 → Sprint 4 disusun agar setiap langkah aman dikerjakan, terukur, dan tidak memutus alur yang sudah berjalan.
