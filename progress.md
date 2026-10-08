# Progress Implementasi LIMO

Terakhir diperbarui: 8 Oktober 2026

## Resume Point (8 Okt 2026, lanjutan — drag & drop menjodohkan/urutan)

**Selesai (belum di-commit):** backlog menjodohkan dari 7247c35 — drag & drop antar kartu + acak urutan jodoh di pemutar.

- **Komponen bersama baru** `src/components/quiz/matching-sequence-input.tsx` (`MatchingInput` + `SequenceInput`), dipakai `public-quiz-runner.tsx` (kuis publik) dan `online-exam-player.tsx` (siswa/wali) — menggantikan blok dropdown duplikat.
- **MENJODOHKAN**: kartu jodoh (kanan) bisa **drag & drop** ke kartu soal (kiri), plus **tap-to-pair** (klik kartu jodoh → klik slot tujuan; Enter/Space + `aria-pressed` untuk keyboard, Escape tak perlu — toggle). Tombol "Hapus pasangan" per kartu. Semantik jawaban tidak berubah: tetap `structuredAnswer[anchor-kiri] = anchor-kanan` (`pairLeftAnchor`/`pairRightAnchor`), jadi grading lama tetap valid.
- **URUTAN**: baris posisi bisa **drag & drop** untuk menukar urutan (semantik move/insert), plus tombol ▲▼ per baris (aksesibilitas keyboard) dan dropdown pilih item per posisi (fallback sentuh).
- **Acak urutan jodoh**: daftar jodoh diacak deterministik per soal (seed = id soal, PRNG LCG + FNV-1a) — urutan tampil tidak lagi sama dengan urutan builder; anchor kunci tetap dari indeks asli sehingga penilaian aman.
- **Verifikasi (hijau)**: `typecheck` ✓ · `lint` 0 error ✓ · `npm test` 45 ✓ · `test:quiz-builder` 25/25 ✓ · `test:siswa-ujian` 14/14 ✓ · `test:quiz-share` 5/5 ✓ (semua di dev server `NODE_ENV=development`).
- **Backlog tersisa**: bukti deploy staging `demo.limoedu.id`, `db:parity` MariaDB, P2 lain (filter level/kelas admin, dsb.).

## Resume Point (8 Okt 2026)

**Selesai & ter-push (`7247c35`):** soal menjodohkan teks/gambar + status publikasi kuis.

- **Menjodohkan teks & gambar**: pasangan kiri/kanan kini bisa teks saja, gambar saja, atau keduanya — `QuizPair {left, right, leftMediaUrl, rightMediaUrl}`; editor kartu menjodohkan punya upload gambar per sisi (`/api/v1/kuis/media`, tombol hapus/ganti). Tanpa migrasi DB: pasangan tersimpan di `BankSoal.structuredPayload.pairs`. Kunci `answerKey` memakai anchor teks kiri bila ada, else `#L-<index>`; identitas jodoh = teks kanan bila ada, else `#R-<index>` (helper `pairLeftAnchor`/`pairRightAnchor`/`pairIsComplete` di `src/lib/quiz-builder.ts`, dipakai service & client agar selalu konsisten).
- **Validasi menjodohkan diperketat**: Zod + client (`form-state.ts`) menolak pasangan setengah-isi (satu sisi teks/gambar kosong) dan tetap minta minimal 2 pasangan lengkap; ringkasan kartu soal kini bertuliskan "N/M pasangan berkunci" (sebelumnya selalu "kunci belum diatur" karena membaca `expectedAnswer`).
- **UI pengerjaan MENJODOHKAN & URUTAN ditambahkan** di runner publik (`public-quiz-runner.tsx`) dan `OnlineExamPlayer` (siswa/wali) — sebelumnya keduanya jatuh ke textarea esai sehingga tidak bisa dijawab (bug lama). Layout dua kolom: daftar soal kiri dengan dropdown "Pilih jodoh", daftar jodoh bernomor dengan thumbnail; URUTAN pakai dropdown item per posisi. Jawaban `structuredAnswer` tersimpan di DB (`QuizResponse.finalAnswers` / `JawabanUjian.structuredAnswer`), dinilai otomatis poin parsial oleh grader tunggal.
- **Serialisasi publik** (`public-quiz-service.ts`) kini mengirim `matchingPairs` + `sequenceItems` (tanpa `answerKey`, kunci tidak bocor); dua halaman attempt (siswa & wali) memetakan payload yang sama menjadi `bankSoal.matchingPairs`/`sequenceItems`.
- **Status publikasi**: badge "Sudah publish" di builder (`form-builder.tsx`) + badge berwarna di daftar `/guru/ujian` (Sudah publish/Draft/Diarsipkan). Tombol **"Tutup publikasi"** → `POST /api/v1/kuis/[id]/unpublish` → `closeQuizPublication` (PUBLISHED → DRAFT, audit `QUIZ_FORM_PUBLICATION_CLOSED`): link publik & portal berhenti menerima pengerjaan (gate `status !== "PUBLISHED"`), dan bisa dibuka lagi kapanpun lewat tombol Kirim (publish revalidasi soal & kunci). Hasil yang sudah ada tidak terhapus.
- **Koreksi kecil terkait**: teks jawaban MENJODOHKAN/URUTAN di detail respons (`getQuizResponseDetail`) kini berarti (pasangan → jodoh, urutan bernomor), placeholder `#R-n` dirender jadi teks jodoh; `MatchingPreview` di koreksi guru menampilkan thumbnail gambar; pratinjau builder menampilkan thumbnail kiri.
- **Verifikasi (semua hijau)**: `typecheck` ✓ · `lint` 0 error ✓ · `npm test` 45 ✓ · `test:quiz-builder` **25/25** ✓ · `test:quiz-share` **5/5** ✓ · `test:siswa-ujian` **14/14** ✓ (semua setelah perubahan ini).
- **Catatan lingkungan (validasi integrasi)**: test di atas butuh dev server `NODE_ENV=development` — `NODE_ENV` mesin ini ter-set global production sehingga login 500; jalankan `cmd /c "set NODE_ENV=development&& npm run dev"` takarir, lalu tes. Artefak `.next/dev/types/` bisa korup saat server mati di tengah generate — hapus dua file tersebut lalu `typecheck` ulang.
- **Deploy**: tanpa migrasi & env baru. Cukup **Redeploy** (build ulang image) di Dokploy — jangan restart-saja.
- **Backlog lanjutan menjodohkan**: drag & drop antar kartu dan acak urutan jodoh di pemutar (kini dropdown), aksesibilitas drag handle.

## Resume Point (7 Okt 2026, akhir hari)

**Selesai & ter-push:**
- `f72dbab` — penilaian otomatis diperkuat: grader tunggal (`exam-service` pakai `gradeObjectiveAnswer`, kunci kosong → needsReview), GRID multi-pilih, poin parsial (multi-select/grid/menjodohkan/urutan), SKALA/RATING fallback `expectedAnswer`, KKM `HasilUjian.passed` (migrasi `20261007010000_hasil_passed`), cron `quiz:finalize` didokumentasikan, overflow mobile builder 390px diperbaiki.
- `fa75117` — audit menu & fitur Admin/Guru (53 halaman runtime hijau, tanpa P0) + perbaikan: gate flag → `notFound()` di 7 halaman kalender/todo, 4 izin guru "mati" kini ditegakkan (gradebook/remedial/pengumuman/diskusi), **fitur edit voucher** (service + schema + UI + audit `VOUCHER_UPDATED`), pagination laporan perkembangan admin & guru, metrik `/admin/audit` dari DB, spec e2e `billing-voucher` dikoreksi ke label "Siswa (opsional)".

**Verifikasi terakhir (semua hijau):** `typecheck` · `lint` 0 error · `npm test` 44 · `test:guards` 232 · `test:billing-voucher` 14/14 · `test:diskusi` 25/25 · `test:laporan` 14/14 · `test:quiz-builder` 25/25 · `test:week2` · `test:siswa-ujian` 14/14 · `test:quiz-share` 5/5 · `build` (159 halaman) · e2e: quiz-builder, editors 2/2, sections 3/3, week2 3/3, student-exam 2/2, bank-soal-library 3/3, mobile-layout 16/16, production-navigation 2/2, accessibility 5/5, billing-voucher 4/4.

**Catatan lingkungan:**
- `NODE_ENV` di mesin ini **set global = production** → dev server harus dijalankan dengan `set NODE_ENV=development&& ...` atau semua route 500 (`env.ts` menolak `NOTIFICATION_PROVIDER=console` di produksi). Error ini terlihat sebagai 500 generik.
- Log dev Next 16 tidak masuk ke stdout/capture; untuk debug pakai bukti dari response atau instrumentasi file (jangan andalkan log console).
- `npx prisma db push` menjalankan generate dan mengunci `query_engine` DLL saat dev server hidup — hentikan dev server dulu sebelum e2e (`EPERM`).
- Next 16 dev: hanya **satu** server dev per project dir (lock proyek); server kedua gagal start.

**Wajib saat deploy:** `npx prisma migrate deploy` untuk `20261006010000_kuis_kelas_nullable` + `20261007010000_hasil_passed`; tambahan cron: `quiz:finalize` tiap menit (lihat `docs/DEPLOYMENT.md`).

**Blocked (butuh akses infra):** migrasi/parity MariaDB staging + backup off-site, UAT Mayar/Pakasir merchant nyata + GOWA nyata, deploy staging `demo.limoedu.id`, hardening lanjutan (CSP, 2FA, observability, rate limit Redis).

**Backlog P2 (berikutnya dipilih bila lanjut):** filter level/kelas `/admin/siswa`, dropdown siswa tarif maks 100 (autocomplete), CRUD SesiKelas di `/admin/jadwal`, tabel Admin default kartu di mobile, e2e RTL Arab, Q&A per materi/modul (sumber remedial QUIZ/EXAM/COMPETENCY), drag & drop menjodohkan/urutan di pemutar kuis.

## Audit Menu & Fitur Dashboard Admin + Guru (7 Okt 2026)

- **Audit lengkap**: 24 item menu Admin + 14 item menu Guru dipetakan vs halaman nyata (`navigation.ts`, permissions, service), lalu diverifikasi runtime via browser sesi nyata — **53 halaman** (menu + detail: kelas/tugas/modul/remedial/gradebook/progres/pengumuman/diskusi, presensi/progres per sesi, submissions, hasil, respons, detail pendaftaran/siswa/akun/user, impor CSV) semua HTTP 200, tanpa error boundary/console error. **Tidak ada temuan P0** (tidak ada tombol mati, layar kosong, atau hardcoded placeholder).
- **Gate flag → notFound()**: akses URL langsung saat flag mati tadinya jatuh ke error boundary; kini 7 halaman (admin/guru/wali/siswa × kalender/todo) memakai `notFound()` — diverifikasi server `CALENDAR_ENABLED=false`: semua tampil 404 rapi.
- **Izin guru yang "mati" kini ditegakkan**: `guru.gradebook.manage` (baca/tulis gradebook + kategori/item/entry/publish), `guru.remedial.manage` (buat/ubah/status/tutup/sinkron), `guru.announcement.manage` (buat/ubah pengumuman), `guru.discussion.manage` (buat thread + moderasi) — ditegakkan di service `gradebook-service`, `remedial-service`, `pengumuman-service`, `diskusi-service` dengan pola `role === "GURU"` sehingga jalur admin/wali/siswa tidak berubah.
- **Fitur baru — edit voucher**: `updateVoucher` + schema patch parsial (description, nilai/jenis diskon + validasi persen ≤ 100 gabungan, minAmount, maxUses, cakupan program/kelas, masa berlaku) via `PATCH /api/v1/admin/voucher/[id]` (menggantikan `setVoucherActive`; patch `isActive` tetap memicu audit VOUCHER_ACTIVATED/ARCHIVED, perubahan lain → VOUCHER_UPDATED). UI tombol "Ubah" inline di katalog voucher `/admin/tagihan`.
- **Pagination**: `/admin/laporan-perkembangan` (page param + PaginationControls) dan `/guru/laporan-perkembangan` (pageSize 50 eksplisit — sebelumnya default 20 dan tanpa kontrol).
- **Metrik halaman `/admin/audit`** tidak lagi dihitung dari item halaman aktif: Autentikasi/Akademik/Operasional kini dihitung langsung dari database untuk 7 hari terakhir (label mencantumkan rentang) + kartu "Cocok Filter".
- **Koreksi spec stale ditemukan saat e2e**: `billing-voucher.spec.ts` menunggu label "Siswa tarif" yang sudah tidak ada → disesuaikan ke "Siswa (opsional)" (4/4 hijau). Flaky pra-ada pada `week2` "resumes autosave" lulus di retry (3/3).
- **Verifikasi (hijau)**: `typecheck` ✓ · `lint` 0 error ✓ · `npm test` 44 ✓ · `test:guards` 232 ✓ · `test:billing-voucher` **14/14** ✓ · `test:diskusi` 25/25 ✓ · `test:laporan` 14/14 ✓ · build ✓ (159 halaman) · e2e production-navigation 2/2 ✓, week2 3/3 ✓, accessibility 5/5 ✓, billing-voucher 4/4 ✓.
- **Sisa backlog (P2, tercatat)**: filter level/kelas `/admin/siswa`, dropdown siswa tarif 100, admin jadwal CRUD SesiKelas, tabel Admin default kartu di mobile, RTL E2E, Q&A per materi/modul (sumber remedial QUIZ/EXAM/COMPETENCY).

## Penilaian Otomatis Diperkuat (grader tunggal, poin parsial, KKM HasilUjian) (7 Okt 2026)

- **Grader tunggal `submitHasilUjian`**: jalur guru (TEACHER_ENTRY + koreksi) kini memakai `gradeObjectiveAnswer` terpusat — setelah sebelumnya memakai blok if/else duplikat yang menyebabkan (a) pilihan ganda/dropdown tanpa kunci dinilai **0 "salah"** alih-alih `needsReview`, dan (b) tipe GAMBAR/LISTENING/READING tidak konsisten antar jalur.
- **Konsistensi tipe manual**: `isManualReviewType()` di `quiz-grading.ts` kini sumber tunggal (preflight `isManualReviewQuestion` ikut memakainya); grader mengembalikan `null` untuk soal objektif tanpa kunci → needsReview di semua jalur.
- **GRID multi-pilih**: grader membaca `payload.multiple` (jawaban array per baris dibanding kunci baris).
- **Poin parsial proporsional**: MULTI_SELECT (`correct−wrong` per kunci), GRID per baris, MENJODOHKAN per pasangan, URUTAN per posisi — dulunya all-or-nothing (jawaban 2 dari 4 benar = 0). `correct: true` hanya saat skor penuh.
- **SKALA/RATING tanpa opsi bertanda benar** kini dinilai dari `expectedAnswer` (sebelumnya selalu 0 karena `correctLabels` kosong).
- **KKM pada `HasilUjian`**: kolom baru `passed` (migrasi `20261007010000_hasil_passed`) terisi saat finalisasi wali/siswa dan input/koreksi guru; badge "Lulus/Tidak lulus KKM" di halaman `/guru/ujian/[id]/hasil` & koreksi; `db:parity` + `schema.sqlite.prisma` ikut diupdate.
- **Cron `quiz:finalize`** didokumentasikan di `docs/DEPLOYMENT.md` (tiap menit, idempoten) agar respons kuis publik kedaluwarsa terfinalisasi otomatis.
- **Perbaikan ikut-ikut**: `gradeAnswer` halaman respons kini mengembalikan hasil grader terpusat; **overflow horizontal baru di builder ala Google Forms pada 390px** (baris opsi + baris aksi kartu soal tanpa `flex-wrap`) diperbaiki di `question-card.tsx`/`editors.tsx`; `week2.spec.ts` disesuaikan ke builder baru (heading "Formulir baru", tombol "+ Pertanyaan").
- **Assert grading baru**: unit test (kunci kosong→null, parsial multi/grid/menjodohkan/urutan, fallback rating, GRID ganda) + integrasi (formulir 9 tipe full-score 100 + passed true; respons parsial 58.3 & KKM gagal; wali HasilUjian `passed` lulus).
- **Verifikasi (hijau)**: `typecheck` ✓ · `lint` 0 error ✓ · `npm test` **44** ✓ · `test:guards` 232 route ✓ · `test:quiz-builder` **25/25** ✓ · `test:week2` ✓ · `test:siswa-ujian` 14/14 ✓ · `test:quiz-share` 5/5 ✓ · build ✓ (159 halaman) · e2e quiz-builder ✓, editors 2/2 ✓, sections 3/3 ✓, week2 3/3 ✓, student-exam 2/2 ✓, bank-soal-library 3/3 ✓, mobile-layout 16/16 ✓, production-navigation 2/2 ✓, accessibility 5/5 ✓.
- **Wajib saat deploy**: `npx prisma migrate deploy` untuk `20261007010000_hasil_passed`.

## Builder Asesmen ala Google Forms — Audit + Rewrite Total (6 Okt 2026)

- **Audit dashboard guru (fitur builder soal/ujian/kuis)** vs Google Forms: paritas inti sudah ada (21 tipe soal, auto-grading terpusat `quiz-grading.ts`, sections + branching, validasi jawaban, share publik + anti-duplikat, ekspor CSV/PDF, rilis nilai). Gap yang ditemukan: autosave hanya menyala setelah simpan pertama (risiko kehilangan draf baru), GRID bisa publish tanpa kunci per baris (nilai 0 semua), tidak ada verifikasi pra-publikasi, ringkasan respons tanpa distribusi opsi, kelas wajib untuk semua formulir, dan belum ada "kirim respons lain".
- **Builder ditulis ulang total** ke `src/components/forms-builder/` (9 file baru) sesuai keputusan pengguna: kartu aktif tunggal ala Google Forms, tambah soal lewat menu tipe, drag handle soal/opsi, blok **Kunci jawaban** per kartu (opsi benar, kunci per baris GRID, umpan balik benar/salah, pembahasan), **autosave instan sejak perubahan pertama** (draf dibuat otomatis tanpa tombol simpan + backup localStorage + indikator "Semua perubahan tersimpan"), undo/redo 100 langkah, pratinjau ala responden, sheet pengaturan 4 tab (Umum/Kuis/Respons/Lanjutan). Builder lama dihapus (`quiz-builder.tsx`, `use-form-builder.ts`, `src/components/builder/*` kecuali `builder-card.tsx` yang masih dipakai tugas/modul).
- **Preflight/verifikasi semua**: `GET /api/v1/kuis/[id]/preflight` + sheet verifikasi sebelum tombol "Kirim" — rincian soal objektif vs manual, cakupan % bobot auto-nilai, dan **publish diblokir** bila GRID/tipe objektif belum punya kunci (`assertQuizAnswerKeys` dipanggil `publishQuizForm`).
- **Formulir publik tanpa kelas**: `Ujian.kelasId` nullable (migration `20261006010000_kuis_kelas_nullable`, FK → SetNull); `assertClassScope` null-safe (±20 call site); publish mode online wali/siswa tanpa kelas ditolak dengan pesan jelas; scope daftar guru mencakup formulir milik sendiri tanpa kelas; hub menampilkan label "Tanpa kelas (tautan publik)".
- **Ringkasan respons ala GF**: distribusi pilihan per soal (bar dengan penanda kunci hijau) di `getQuizResponses` + halaman `/guru/kuis/[ujianId]/responses`.
- **Pemutar publik**: tombol "Kirim respons lain" pasca-submit (sembunyi bila `oneResponsePerEmail` aktif) + satu kali retry transien saat memuat intro (SQLite busy).
- **Perbaikan ikut audit**: label 7 tipe soal yang tampil "Tidak diketahui" (DROPDOWN/SKALA/RATING/GRID/TANGGAL/WAKTU/FILE_UPLOAD), race autosave vs tambah/impor soal pustaka (flush simpan SEBELUM POST agar PATCH full-replace tidak menghapus soal baru), rubrik awal tipe manual saat soal baru dibuat, ekor Kartu GRID kembali punya kolom editor.
- **Verifikasi (hijau)**: `typecheck` ✓ · `lint` 0 error ✓ · `npm test` 43 ✓ · `test:guards` 232 route ✓ · `test:quiz-builder` **24/24** ✓ (termasuk kasus baru: formulir tanpa kelas, penolakan GRID tanpa kunci & mode online tanpa kelas) · `test:quiz-share` 5/5 ✓ · e2e Playwright 7/7 ✓ (quiz-builder, editors, sections, bank-soal).
- **Deploy**: migrasi otomatis sudah disiapkan lewat `docker-entrypoint.sh` (`prisma migrate deploy` + retry 30x saat container start). Commit `0741cea` ter-push ke `origin/main`.
- **Sisa backlog**: drag & drop MENJODOHKAN/URUTAN di pemutar (tombol ↑↓ ada), bukti deploy staging `demo.limoedu.id` (screenshot `masalah/1.PNG` dari build lama), dan `npm run db:parity` MariaDB.

## Laporan Perkembangan Berkala (rencana.md Fase 10) — 1 Okt 2026

- **Model baru**: `ProgressReport` + `ProgressReportRead` (read receipt); migrasi `20261001010000_progress_reports`.
- **Snapshot dikunci saat draf dibuat** dari data periode (kehadiran, penyelesaian aktivitas wajib, rata-rata pemahaman/ujian, tugas, nilai akhir); koreksi data setelah terbit tidak mengubah laporan lama.
- **Service** `progress-report-service.ts`: generate draf, ubah draf, terbit (idempoten + notifikasi ke wali/siswa), revisi wajib alasan + audit before/after, daftar per peran, read tracking/unread count. **PDF** `progress-report-pdf-service.ts` (A4, Amiri untuk nama Arab) dibangun dari snapshot terbit.
- **API**: `GET/POST /api/v1/guru/reports`, `GET/PATCH /api/v1/guru/reports/[reportId]`, `.../publish`, `.../revise`, `GET /api/v1/admin/reports`, `GET /api/v1/wali/reports` + `.../read`, `GET /api/v1/siswa/reports` + `.../read`, `GET /api/v1/reports/[reportId]/pdf`.
- **UI**: Guru `/guru/laporan-perkembangan` (buat/ubah/terbit/revisi + PDF), Wali `/wali/laporan`, Siswa `/siswa/laporan`, Admin `/admin/laporan-perkembangan`. Navigasi di-gate flag `periodicReportsEnabled`; izin baru `guru.report.manage`, `wali.report.view`, `siswa.report.view`.
- **Verifikasi (hijau)**: `typecheck` ✓ · `lint` 0 error ✓ · `npm test` 43 ✓ · `test:guards` 231 route ✓ · `npm run build` ✓ (159 halaman) · integrasi **`test:laporan` 14/14**.
- **Wajib saat deploy**: `npx prisma migrate deploy` untuk `20261001010000_progress_reports`.
- **Sisa** (bukan bagian fase ini): Q&A per materi/modul, sumber remedial QUIZ/EXAM/COMPETENCY.

## Resume Point (29 Sep 2026) — Kematangan Dashboard Admin & Guru

**Selesai (belum di-commit):**

- **Toast/umpan balik global** (`src/components/ui/toast-provider.tsx` di root layout) + integrasi `useAsyncAction` (`successMessage`) dan ±14 komponen aksi manual.
- **Proteksi berlapis**: `src/proxy.ts` diperluas ke API (401 tanpa cookie; rute publik/auth/webhooks/health dikecualikan). `src/middleware.ts` yang sempat dibuat dihapus karena Next 16 memakai `proxy.ts`.
- **Audit guard otomatis**: `npm run test:guards` (semua route terproteksi punya guard; admin/guru wajib cek role/permission). 65 route admin/guru memakai `requireRole`/`requireActorWithRole` hasil codemod.
- **Matriks izin granular**: `src/server/auth/permissions.ts`, `permission-service.ts`, model `RolePermissionOverride` + `UserPermissionOverride`, halaman `/admin/akses`, editor izin di `/admin/users/[id]`; 69 halaman admin/guru dikonversi ke `requirePermission`; navigasi via `getNavigationForActor`.
- **Pengaturan sekolah & tahun ajaran**: model `SchoolSetting` + `AcademicYear`, halaman `/admin/pengaturan`, identitas dipakai pada kop invoice.
- **CRUD Guru dilengkapi**: Bank Soal (ubah/arsip/pulihkan/duplikat/hapus + `archivedAt`), Materi (ubah/hapus), RPP (ubah), Remedial (ubah/tutup/sinkron nilai).
- **Konsistensi daftar**: Level cari+pagination; Program/Kelas/Kuis/Ujian cari; empty state Hero Carousel; `listLevels` terpaginasi (`{ pageSize: 100 }` di Kelas).
- **Perbaikan bug**: nav `/guru/todo`, `notFound()` pada progres aktivitas & koreksi hasil, copy audit.

**Migrasi baru (wajib `prisma migrate deploy`):** `20260929010000_bank_soal_archive`, `20260929020000_school_settings_academic_year`, `20260929030000_permission_matrix`.

**Verifikasi (hijau):** `npm run typecheck` ✓ · `npm run lint` 0 error ✓ · `npm test` **43** ✓ · `npm run test:guards` ✓ · `npm run build` ✓ (153 halaman, `ƒ Proxy (Middleware)` terdeteksi) · `npm run sqlite:setup` schema valid & sinkron (seed demo sengaja diblokir).

**Lanjutan (29 Sep 2026, sesi yang sama):**

- **Guard WALI/SISWA** kini `requirePermission`; katalog izin ditambah `wali.*`/`siswa.*` (41 halaman wali/siswa dikonversi, `/siswa/tugas` diberi `siswa.tugas.view`).
- **Override lintas-role berfungsi**: 18 service admin mengganti `requireAdmin` dengan `requirePermission` (master-data, people, auth, student-account, account-password, billing, voucher, payment-gateway, payment, hero-carousel, admin-material, certificate, notification-log, report, settings, pendaftaran, pengumuman, diskusi).
- **Identitas sekolah** dipakai di kuitansi, sertifikat, invoice PNG, dan email (nama pengirim/subject/footer) + payload n8n (dynamic import agar aman untuk skrip/unit test).
- **Tahun ajaran aktif** jadi default periode pada form generate tagihan (diklamp ke rentang tahun ajaran) dan ditampilkan di halaman laporan.
- **Bank Soal**: toggle "Tampilkan arsip" + pulihkan dari UI (`?arsip=1`, `listBankSoal` menyertakan `archivedAt`).
- **Validasi form client-side** memakai schema zod yang sama (Program/Level/Kelas/Guru/Wali/Siswa) dengan pesan error per-field.
- **Pagination Program & Kelas** (aktif hanya saat `page` dikirim, sehingga dropdown pemanggil tetap utuh).

**Backlog:** test integrasi permission/settings & e2e bank soal edit; identitas sekolah pada export laporan/pendaftaran; validasi client-side modul lain (tarif, voucher, users).

## Resume Point (27 Sep 2026)

**Selesai & sudah ter-push** (`main` = `89d8baa`, tree bersih):

- `89d8fc6` — hotfix produksi: kontensi baris `Session` (MariaDB 1020 "Record has changed since last read") saat request paralel.
- `0e13ff7` — bank soal: perbaikan simpan (`event.currentTarget.reset()` setelah `await` dibersihkan di seluruh form dashboard) + builder khusus `/guru/bank-soal/baru` + pratinjau di tab baru (draft & tersimpan, dengan kunci jawaban).
- `514fcde` — admin: set password langsung untuk akun Guru/Wali/Admin di `/admin/users` dan `/admin/guru`.
- `7a0bdc7` — billing tahap 1: invoice tagihan **PDF & PNG** untuk semua status (admin & wali).
- `d940017` — billing tahap 2: **ubah / arsip / pulihkan** tarif SPP.
- `89d8baa` — billing tahap 3: **tarif per siswa** + **nominal khusus & biaya tambahan** di form generate.

**Wajib dijalankan saat deploy berikutnya:**

- `npx prisma migrate deploy` → menjalankan migrasi `20260927010000_tarif_per_siswa` (kolom `Tarif.siswaId`). Tanpa ini, tarif per siswa gagal.
- Untuk dev lokal: `npm run sqlite:setup` agar `dev.db` ikut punya kolom baru.

**Verifikasi terakhir (semua hijau):**

- `npm run typecheck` lulus · `npm run lint` 0 error · `npm test` **43 lulus**
- e2e: `billing-voucher` 4/4 · `bank-soal-builder` 3/3 · `guru-workspace` 2/2 · `accessibility` 5/5 · `week11` 3/3 · `mobile-layout` 16/16 · `quiz-builder` 2/2 · `production-navigation` 2/2 (baseline screenshot kartu bank soal diperbarui karena ada tautan pratinjau)
- integrasi: `test:week7` lulus · `test:accounts` 11/11 · `test:billing-voucher` 13/13

**Belum dikerjakan / blocked (butuh akses infra):** migrasi + `npm run db:parity` MariaDB staging, UAT kredensial nyata (Mayar/SMTP/WhatsApp, backup off-site), serta harden lanjutan yang sudah tercatat (CSP, 2FA, observability, rate limit Redis).

**Catatan lokal:** folder `masalah/` (screenshot bukti dari pemilik produk) sengaja **tidak** di-commit. Bila `tsc` memberi error aneh di `.next/dev/types/*`, itu artefak dev basi (isu lama) — hapus `.next` lalu ulang.

## Status Saat Ini

Aplikasi LIMO telah dibangun sebagai satu aplikasi Next.js 16 App Router dengan Route Handlers pada `/api/v1/**`, Prisma, MariaDB sebagai target database, database session, dan UI berbasis TailAdmin/Tailwind CSS v4.

Landing page terbaru tersedia di `http://127.0.0.1:3000` saat development server berjalan.

## Penutupan Catatan Terbuka Dashboard Guru (26 Sep 2026)

- **Label enum mentah (G4/T8):** `guru/penilaian-esai` memakai `formatUiLabel("NEEDS_REVIEW")`; `admin/audit` memakai `humanizeEnumLabel` (helper baru di `src/lib/ui-labels.ts`) sebagai fallback aksi/entitas. Unit test `humanize enum label never leaks raw enum tokens` ditambahkan.
- **Konfirmasi aksi (G12):** `hero-carousel-actions.tsx` memakai `useConfirmDialog` (materi & ujian sudah sebelumnya). Sisa `window.confirm` hanya tombol bersihkan di pemutar kuis publik.
- **Paritas navigasi ↔ feature flag (G13):** halaman `guru/kelas/[kelasId]` men-gate "Susun Modul" (`learningModulesEnabled`) dan "Progres Aktivitas" (`activityCompletionEnabled` + `learningModulesEnabled`). Navigasi dashboard sudah memfilter via `requiredFeatures`.
- **Cakupan uji baru:** `tests/e2e/guru-workspace.spec.ts` (create/edit/cancel sesi; antrean penilaian esai → koreksi → `CORRECTED`; rilis nilai per-siswa), perluasan `tests/e2e/accessibility.spec.ts` (axe + touch-target halaman Guru), dan regresi `tests/e2e/production-navigation.spec.ts` (nav terlihat tidak 404 saat semua flag produksi mati).
- **Privacy gradebook (W10):** kode sudah `exposeProvisionalScores:false` untuk Siswa/Wali; assertion eksplisit ada di `tests/run-week7-integration.mjs:106-123`.
- **Bug form (ditemukan uji baru):** `session-workspace.tsx` & `hasil-ujian-form.tsx` memanggil `event.currentTarget.reset()` setelah `await` (nilai `null` di React) sehingga `router.refresh()` tidak pernah jalan — sesi baru tidak muncul tanpa reload. Elemen form kini di-capture sebelum `await`. Pola sama di ~11 form lain dicatat di `docs/KNOWN_LIMITATIONS.md`.
- **Aksesibilitas guru:** `<select>` di `/guru/bank-soal` diberi `aria-label`; tombol "Simpan sesi" dinaikkan ke target sentuh ≥44px. Audit axe `/guru/sesi`, `/guru/penilaian-esai`, `/guru/bank-soal` lulus.
- **Runner e2e:** pembersihan database diberi retry agar `EBUSY` (file lock Windows) tidak lagi menggagalkan exit code setelah test lulus.
- **Blocked (butuh akses):** migrasi/parity MariaDB staging (`npm run db:parity`) dan UAT kredensial nyata (Mayar/SMTP/WhatsApp) belum dijalankan dari environment ini.

## Billing — Tarif per Siswa + Penyesuaian Nominal (Tahap 3 dari 3) (27 Sep 2026)

- **Tarif khusus per siswa:** kolom baru `Tarif.siswaId` (relasi ke `Siswa`, `onDelete: SetNull`, index `[siswaId, effectiveFrom]`) + migrasi `20260927010000_tarif_per_siswa`. Prioritas penagihan kini **siswa > kelas > program**, dengan tie-break `effectiveFrom` terbaru.
- **Pemilihan tarif** dipindah ke fungsi murni `pickTarifForStudent` (`src/server/billing/pick-tarif.ts`) sehingga bisa diuji unit; `generateMonthlyInvoices` mengambil kandidat lalu memilih memakai fungsi itu.
- **Penyesuaian manual di form generate:** dua input opsional — **Nominal khusus** (menggantikan tarif) dan **Biaya tambahan** (boleh minus untuk potongan). Disimpan konsisten: `subtotal` = dasar, `discountAmount` = potongan, `amount` = total akhir, dengan penanda "· nominal khusus" / "· biaya tambahan" di deskripsi tagihan. Nilai penyesuaian ikut tampil di panel pratinjau sebelum konfirmasi. Nominal akhir ≤ 0 ditolak sebagai kegagalan baris.
- **UI:** `TarifForm` dan aksi Ubah tarif kini punya pilihan **Siswa** (opsional); daftar tarif menampilkan "Khusus <nama siswa>".
- **Parity:** `scripts/verify-db-parity.mjs` menambahkan `Tarif.siswaId`.
- **Catatan:** penyesuaian manual (`extraFee`) memakai kolom `discountAmount`; bila voucher kemudian dipakai pada tagihan yang sama, nilai diskon voucher akan menggantikan penanda potongan manual itu.
- **Verifikasi:** `typecheck` lulus · `lint` 0 error · `npm test` **43 lulus** · e2e `billing-voucher` **4/4** · integrasi `test:billing-voucher` **13/13** (prioritas siswa>kelas>program + subtotal/diskon/amount dari penyesuaian manual).
- **Wajib saat deploy:** jalankan `npx prisma migrate deploy` di server (kolom `Tarif.siswaId` belum ada sampai migrasi dijalankan).

## Billing — Edit & Arsip Tarif (Tahap 2 dari 3) (27 Sep 2026)

- **Masalah sebelumnya:** modul tariff hanya punya **create + list** — tidak ada cara mengubah nominal, menonaktifkan tarif lama, atau memulihkannya (field `isActive` tak pernah di-set false), jadi menaikkan SPP berarti menumpuk tarif baru tanpa bisa "menutup" yang lama.
- **Validasi:** `updateTarifSchema` (patch parsial: nama, program, kelas, nominal, berlaku dari/sampai, `isActive`). Tanggal tarif kini memakai validator tanggal nyata (`isValidDate`), bukan sekadar regex — `2026-13-01` ditolak.
- **Service:** `updateTarif` (guard: hasil merge tetap punya program atau kelas; `effectiveTo` tidak boleh sebelum `effectiveFrom`), `archiveTarif` (nonaktif → tidak lagi dipakai generate tagihan), `restoreTarif`. Audit: `TARIF_UPDATED`, `TARIF_ARCHIVED`, `TARIF_RESTORED`.
- **API:** `PATCH`/`DELETE /api/v1/admin/tarif/[id]` dan `POST /api/v1/admin/tarif/[id]/restore` (admin + `assertSameOrigin`).
- **UI:** komponen `tarif-actions.tsx` di daftar tarif `/admin/tagihan` — tombol **Ubah** (form inline: nama, program, kelas, nominal, berlaku dari/sampai) dan **Arsipkan/Pulihkan** dengan `ConfirmDialog`.
- **Verifikasi:** `typecheck` lulus · `lint` 0 error · `npm test` **41 lulus** · e2e `billing-voucher` **3/3** (termasuk ubah nominal + arsip lewat UI) · integrasi `test:billing-voucher` **12/12** (termasuk 403 untuk non-admin, 400 nominal tidak valid, 404 id tidak ada).

## Billing — Invoice Tagihan PDF & PNG (Tahap 1 dari 3) (27 Sep 2026)

- **Masalah sebelumnya:** hanya ada **kuitansi** (`/api/v1/tagihan/[id]/kuitansi`) dan itu pun **hanya untuk tagihan `PAID`** — tidak ada dokumen tagihan untuk yang belum dibayar, dan tidak ada output gambar.
- **Invoice PDF:** service baru `src/server/services/invoice-pdf-service.ts` (pdfkit A4) + route `GET /api/v1/tagihan/[id]/invoice` — **tersedia untuk semua status** (DRAFT/UNPAID/PENDING/OVERDUE/PAID/CANCELLED/REFUNDED), memuat nomor tagihan, periode, jenis, siswa + program, jatuh tempo, rincian (subtotal/diskon+voucher/total), status yang ditandai jelas, serta instruksi pembayaran atau info pelunasan.
- **Invoice PNG:** route `GET /api/v1/tagihan/[id]/invoice.png` memakai `ImageResponse` dari `next/og` (tanpa dependensi baru) dengan layout invoice yang sama. Dipilih PNG (bukan JPG) sesuai keputusan pemilik produk.
- **Akses:** admin (semua tagihan) dan wali (hanya tagihan anaknya) lewat `canAccessInvoice` — sama seperti kuitansi, tapi tanpa syarat status.
- **UI:** tautan **"Unduh invoice PDF"** & **"Unduh invoice (PNG)"** di kartu tagihan Wali (`/wali/tagihan`, semua status) dan tombol **Invoice PDF** / **Invoice PNG** di panel detail tagihan Admin (`/admin/tagihan`); kuitansi tetap hanya muncul saat lunas.
- **Verifikasi:** `typecheck` lulus · `lint` 0 error · `npm test` 40 lulus · e2e `billing-voucher` **2/2** · integrasi `test:billing-voucher` **11/11** (termasuk: invoice bisa diunduh saat belum lunas, `%PDF` + signature PNG valid, guru 403, tanpa sesi 401, dan wali tanpa relasi anak 403).

## Bank Soal: Perbaikan Simpan + Builder & Pratinjau Tab Baru (27 Sep 2026)

- **Bug "soal tidak bisa disimpan" (bukti `masalah/1.PNG`):** `bank-soal-form.tsx` memanggil `event.currentTarget.reset()` **setelah** `await` (React men-null-kan `currentTarget`), sehingga handler melempar `Cannot read properties of null (reading 'reset')` dan **`router.refresh()` tidak pernah jalan**. Soal sebenarnya tersimpan, tetapi UI menampilkan error dan daftar tidak menyegar. Elemen form kini di-capture sebelum `await`.
- **Kelas bug yang sama dibersihkan menyeluruh:** ujian, RPP, remedial, master data (program/level/kelas), materi + unggah berkas LMS, modul pembelajaran, hero carousel, tarif billing, builder tugas, dan bank soal. Tidak ada lagi `event.currentTarget.reset()` setelah `await` di `src/`.
- **Builder jadi halaman khusus:** `/guru/bank-soal` kini hanya daftar soal + tombol **"Buat soal (tab baru)"**; form penyusunan pindah ke `/guru/bank-soal/baru`. Setelah simpan muncul panel sukses ("Soal berhasil disimpan…") karena tab builder tidak bisa menyegarkan daftar di tab lain.
- **Pratinjau soal di tab baru (kapan pun — draft atau tersimpan):** tombol **"Pratinjau di tab baru"** di builder menulis draft ke `localStorage` lalu membuka `/guru/bank-soal/pratinjau`; setiap kartu soal punya tautan **"Pratinjau (tab baru)"** ke `/guru/bank-soal/[id]/pratinjau`. Halaman pratinjau menampilkan versi siswa (stimulus, media, opsi/pasangan/urutan, rubrik) **plus panel kunci jawaban & pembahasan**.
- **Service baru:** `getBankSoal(actor, id)` di `exam-service` dengan scope sama seperti daftar (guru hanya soal kelasnya atau soal umum; wali ditolak).
- **Verifikasi:** `typecheck` lulus · `lint` 0 error · `npm test` 40 lulus · e2e `bank-soal-builder` **3/3** (simpan tanpa error + pratinjau draft & tersimpan) · regresi `week2` 3/3, `accessibility` 5/5, `quiz-builder` 2/2, `mobile-layout` **16/16** (baseline `guru-arabic-bank-soal-card` diperbarui karena kartu kini punya tautan pratinjau).

## Hotfix Produksi: Kontensi Baris `Session` (26 Sep 2026)

- **Gejala:** redeploy gagal; log produksi penuh `prisma.session.update()` dengan MariaDB `1020 Record has changed since last read in table 'Session'` → request 500 berulang.
- **Akar masalah:** `getActorFromToken` (`src/server/auth/session.ts`) menulis `Session.lastSeenAt` pada **setiap** request terautentikasi (`findUnique` lalu `update`). Request paralel dengan cookie sesi sama berebut satu baris → konflik 1020/deadlock, dan error-nya tidak ditangani sehingga menggagalkan render halaman.
- **Perbaikan:** interval touch minimum (`src/server/auth/session-touch.ts`, ≤60s dan ≤10% idle window) + `updateMany` dengan guard `lastSeenAt` sebelumnya (request yang kalah balapan jadi 0 baris, bukan error) + error transient (P2034, 1020, deadlock, lock wait timeout) tidak lagi menggagalkan autentikasi. Unit test ditambahkan.
- **Verifikasi:** `typecheck` lulus · `lint` 0 error · `npm test` 38 lulus · e2e `accessibility` 5/5 & `week11` 3/3 (login 4 role tetap jalan).

## Set Password Langsung untuk Akun (26 Sep 2026)

- **Masalah:** sebelumnya tidak ada cara menetapkan password dari dashboard — `createAdminUser`/`createGuru` hanya memberi password acak tak terpakai + tautan aktivasi, dan `reset-password` hanya mengirim link. Akun tidak bisa langsung dipakai bila email/WhatsApp belum dikonfigurasi.
- **Perubahan:** form **Tambah Pengguna** (`/admin/users`), **Tambah Guru** (`/admin/guru`), dan **Tambah Wali** (`/admin/wali`) punya field **Password awal** opsional + tombol **Buat password acak** + lihat/sembunyikan. Bila password diisi, akun **langsung aktif tanpa tautan aktivasi**; bila dikosongkan, perilaku lama (tautan aktivasi) tetap berlaku.
- **Ubah password:** aksi **"Ubah password"** ditambahkan di panel aksi akun (detail `/admin/users/[id]`, daftar `/admin/guru`, `/admin/wali`) via komponen bersama `SetPasswordPanel`.
- **Endpoint baru:** `POST /api/v1/admin/users/[id]/password`, `/admin/guru/[guruProfileId]/password`, `/admin/wali/[waliProfileId]/password` — khusus ADMIN + `assertSameOrigin`.
- **Keamanan:** hash argon2id; password **tidak** dikembalikan lewat API, tidak masuk metadata audit, tidak di-log; set password **mencabut semua sesi** akun target dan mencatat audit `USER_PASSWORD_SET` (alasan opsional). Jalur ini menolak akun sendiri (arahkan ke `/ubah-password`). Schema `update*` sengaja **tidak** menerima `password` agar perubahan password hanya lewat jalur yang mencabut sesi + audit.
- **Verifikasi:** `typecheck` lulus · `lint` 0 error · `npm test` 40 lulus · e2e `admin-account-password` 3/3 (buat akun + login langsung, ubah password + password lama ditolak, otorisasi 401/403) · regresi e2e `accessibility` 5/5 & `week11` 3/3 · integrasi `test:accounts` 11/11.

## Revisi Alur Pendaftaran (Revisi v2)

Alur pendaftaran publik diubah mengikuti dokumen revisi v2 (4 langkah + halaman sukses):

- Halaman 1 — Pilih Program: pilihan tunggal, dikelompokkan "Bahasa & Bahasa Arab" dan "Akademik", memakai program aktif yang ada (Bahasa Inggris, Arabic for Kids, Nahwu, Math & Academic Support).
- Halaman 2 — Data Peserta: pilihan "Diri sendiri" atau "Anak" dengan field kondisional (nama, panggilan, jenis kelamin, tanggal lahir, WhatsApp, email, alamat; anak: + nama orang tua/wali, sekolah, kelas/jenjang). Upload foto peserta dihapus dari form pendaftaran (permintaan client).
- Halaman 3 — Formulir khusus per program (Bahasa Inggris, Bahasa Arab, Nahwu, Matematika/Bimbel) sesuai daftar pertanyaan pada dokumen revisi.
- Halaman 4 — Persetujuan: 3 pernyataan wajib + persetujuan dokumentasi (tanpa blur / wajib blur / tidak mengizinkan).
- Halaman sukses `/daftar/berhasil`: nomor pendaftaran, program, peserta, status, dan tahapan selanjutnya (5 langkah).
- Data baru tersimpan di `Pendaftaran`: `participantType`, `studentNickname`, `studentGender`, `address`, `schoolName`, `gradeLevel`, `programAnswers` (JSON), kolom persetujuan, dan `consentAt`.
- Email wali menjadi opsional sesuai dokumen; status lookup menerima kode + nomor WhatsApp atau email. Bila email kosong, admin dapat melengkapinya di halaman detail pendaftaran sebelum approve.
- Admin detail menampilkan data peserta, jawaban formulir program, dan persetujuan; export PDF/Excel menambah kolom baru (tipe peserta, gender, sekolah, kelas, konsen dokumentasi, jawaban program).
- Acceptance: `npm run test:week1` (submit CHILD + SELF, upload, approve/reject) dan unit test schema pendaftaran diperbarui; alur wizard diuji desktop/mobile.

### Verifikasi Kesesuaian revisi_v2.md (data terekam penuh)

- `npm run test:pendaftaran-v2` (integrasi HTTP + database) memverifikasi submit ENGLISH/ARABIC_KIDS/NAHWU/MATH_ACADEMIC_SUPPORT untuk mode Diri sendiri dan Anak: seluruh kolom peserta, `programAnswers` (termasuk opsi opsional yang dikosongkan dan jawaban "Lainnya"), konsen, `consentAt`, `submittedAt`, riwayat status, detail admin, validasi data wajib, anti-duplikat, dan cek status via WhatsApp/email.
- `tests/e2e/pendaftaran-v2.spec.ts` memverifikasi UI 4 langkah sesuai dokumen (grup program, field kondisional, keempat formulir program, persetujuan, halaman sukses) dan dijalankan via `npm run test:e2e` (database terisolasi per spec).
- `scripts/seed-production.ts` menonaktifkan program legacy kind ARABIC agar halaman pilih program konsisten menampilkan empat program revisi.

### Notifikasi Pendaftaran (Fase 1)

- Submit kini otomatis membuat notifikasi konfirmasi `pendaftaran-submitted` ke WhatsApp orang tua/wali dan email (bila diisi), berisi nomor pendaftaran, program, dan tautan cek status.
- Approve mengirim `pendaftaran-approved` ke WhatsApp dan email berisi status diterima, identifier akun wali, dan tautan aktivasi; reject mengirim `pendaftaran-rejected` beserta alasan ke kedua kanal.
- Service baru `src/server/services/pendaftaran-notification-service.ts` memakai `dedupeKey` (anti-duplikat) dan mengikuti `NOTIFICATION_PROVIDER` (console/email/n8n).
- Job notifikasi dipindah ke `src/server/services/notification-job-service.ts` (impor relatif tanpa `server-only`) agar `npm run notifications:retry` dapat dieksekusi Node; sebelumnya gagal karena rantai impor `payment-gateway-service`.
- Jadwalkan `notifications:retry` tiap menit (lihat `docs/DEPLOYMENT.md`); kontrak webhook n8n dan template didokumentasikan di `docs/MAYAR_N8N_INTEGRATION.md`, rencana lengkap di `docs/PLAN_NOTIFIKASI_PENDAFTARAN.md`.

### Dispatch Instan Notifikasi

- Notifikasi alur utama (pendaftaran, tugas, ujian, modul, remedial, RPP, progres, tagihan/pembayaran, dashboard) kini dikirim **langsung (best-effort)** setelah dibuat, tanpa menunggu cron.
- Klaim atomik: status baru `PROCESSING` (`PENDING`/`FAILED` → `PROCESSING`) mencegah pengiriman ganda antara dispatch instan dan job `notifications:retry`; klaim menggantung dipulihkan otomatis setelah 10 menit.
- Cron tetap wajib sebagai jaring pengaman/retry (notifikasi transaksional seperti aktivasi/reset password, dan percobaan ulang saat gagal).
- Verifikasi: `npm run test:pendaftaran-v2` (assert notifikasi terkirim instan) dan cek tidak ada `NotificationDelivery` dobel; migration `20260920100000_notification_processing`.
- Anti-banjir log: cron idle tidak mencetak output dan tidak menulis `JobRun`; scheduler disarankan memakai `npm run --silent notifications:retry -- --limit=50`, dan script keluar dengan kode 1 hanya bila ada kegagalan.

### Form Builder Kuis (ala Google Forms)

- Tab khusus guru **Formulir Kuis** (`/guru/kuis`) dengan halaman **Baru** (`/guru/kuis/baru`) dan **Edit** (`/guru/kuis/[ujianId]/edit`) — alur pembuatan soal menyatu seperti Google Forms.
- Kartu soal interaktif: dropdown tipe, pertanyaan, opsi dinamis (tambah/hapus, tandai kunci), Benar/Salah, isian singkat + kunci, paragraf, pembahasan, toggle **Wajib diisi**, poin, **duplikat/hapus/naik-turun**, tambah soal cepat per tipe.
- Tipe yang ditampilkan sesuai kebutuhan LIMO: Pilihan ganda, Kotak centang, Benar/Salah, Isian singkat, Paragraf (tipe lama seperti listening/speaking/matching tidak lagi ditawarkan di builder).
- Tab **Pengaturan**: mode UJIAN/LATIHAN, pengiriman, durasi, maks percobaan, KKM, acak soal/opsi, skor langsung, kunci & pembahasan, nama responden, hasil ke wali, jadwal tersedia.
- Autosave draf (debounce) + tombol Simpan/Publikasikan; edit hanya untuk draf atau kuis terbit yang belum dikerjakan (409 bila sudah ada pengerjaan); share link publik memakai mekanisme yang sudah ada.
- **Drag & drop** urutan soal (selain tombol naik/turun) dan opsi **"Lainnya"** ala Google Forms pada pilihan ganda/kotak centang (jawaban "Lainnya" ditandai `NEEDS_REVIEW`).
- **Upload gambar per soal** (JPG/PNG/WEBP, maks sesuai `MAX_MATERIAL_FILE_MB`) disimpan privat lalu **disajikan publik** via `/api/v1/public/quiz-media/[id]` agar tampil di kuis tautan; model `QuizMedia` + migration `20260920130000_quiz_media`.
- **Section (bagian) + branching**: form bisa dipecah menjadi beberapa halaman/bagian (judul & deskripsi), soal dipetakan ke bagian, dan soal **Pilihan ganda** bisa punya aturan lompatan per opsi. Player publik menampilkan satu bagian per halaman dengan navigasi Berikutnya/Sebelumnya + lompatan sesuai branching. Model `UjianSection` + `UjianSoal.sectionId`/`branchRules` (migration `20260920140000_quiz_sections`).
- **Tema warna form**: pilihan aksen (biru/hijau/ungu/oranye/merah/teal/abu) di tab Pengaturan; warna diterapkan ke halaman publik (tombol utama, header bagian, label program). Kolom `Ujian.themeColor` (migration `20260920150000_quiz_theme`).
- **Gambar header/cover form** (opsional): unggah/ganti/hapus dari tab Pengaturan (memanfaatkan penyimpanan `QuizMedia` yang disajikan via `/api/v1/public/quiz-media/[id]`); tampil sebagai banner di halaman publik (intro & saat mengerjakan). Kolom `Ujian.headerImageUrl` (migration `20260920160000_quiz_header_image`).
- **Gambar per opsi jawaban**: setiap opsi pilihan ganda/kotak centang bisa diberi gambar oleh guru (tombol 🖼 di baris opsi, pratinjau + hapus). Kolom `OpsiSoal.mediaUrl` (migration `20260920170000_quiz_option_images`); tampil di player publik.
- **Cetak / PDF soal**: `GET /api/v1/kuis/[id]/pdf` (guru/admin, `?kunci=1` menyertakan halaman kunci jawaban) menghasilkan PDF A4 berisi header, bagian, soal, opsi + **gambar soal & gambar opsi** (di-embed dari `QuizMedia`), garis jawaban untuk isian/esai, dan footer nomor halaman. Tombol "Cetak PDF" & "PDF + Kunci" di builder.
- **Dukungan teks Arab pada PDF**: font **Amiri** (`assets/fonts/Amiri-Regular.ttf`, `Amiri-Bold.ttf`) di-embed sebagai buffer (kompatibel dengan pdfkit standalone), dengan **reshaper Arab** (`arabic-persian-reshaper`) + **Unicode bidi** (`bidi-js`) agar teks Arab ter-join, terbalik ke urutan visual, dan tanda kurung ter-mirror dengan benar.
- **Paritas tipe soal Google Forms**: selain Pilihan ganda, Kotak centang, Benar/Salah, Isian singkat & Paragraf, kini tersedia **Dropdown**, **Skala linier**, **Rating bintang**, **Tanggal**, **Waktu**, dan **Tabel pilihan (grid single/multi)**. Kunci jawaban & penilaian otomatis berlaku untuk semua tipe (grid dinilai per baris), tersimpan di `BankSoal.structuredPayload` + kolom `OpsiSoal` (migration `20260920180000_quiz_more_types`).
- **Deskripsi/petunjuk soal** (`BankSoal.helpText`) tampil di bawah pertanyaan (builder + player publik + PDF).
- **Pesan konfirmasi** setelah kirim (`Ujian.confirmationMessage`) tampil di halaman hasil publik.
- **Duplikat formulir**: `POST /api/v1/kuis/[id]/duplicate` menyalin form + bagian + seluruh soal/jawaban sebagai draf baru (tombol "Duplikat" di builder).
- **Validasi jawaban** (isian singkat): aturan angka (rentang), panjang teks, atau cocok pola regex + pesan kustom; dicek di player publik dan **ditegakkan di server** saat submit (tersimpan di `structuredPayload.validation`).
- **Acak opsi per soal**: toggle "Acak urutan opsi" pada tiap soal pilihan (kolom `BankSoal.shuffleOptions`, migration `20260920190000_quiz_per_question_shuffle`); urutan diacak per respons di server.
- **Embed video**: kolom tautan media soal mendukung YouTube/Vimeo (iframe `youtube-nocookie`) selain gambar yang diunggah, di player publik & pratinjau.
- **Mode pratinjau**: tombol "Pratinjau" di builder menampilkan formulir (dari state saat ini) seperti yang dilihat responden, tanpa perlu publikasi.
- **Detail respons individual & ekspor**: halaman detail per respons (`/guru/kuis/[id]/responses/[responseId]`) menampilkan jawaban + benar/salah per soal; tombol **Ekspor CSV** (`GET /api/v1/kuis/[id]/responses/export`).
- **Tipe soal Unggah file**: responden mengunggah satu berkas via `POST /api/v1/public/quiz/[token]/responses/[responseId]/upload` (tanpa batas ukuran; divalidasi jenis file + magic bytes + rate-limit per respons), dinilai manual (needsReview); guru mengunduh berkas via route ber-scope kelas (`/api/v1/kuis/[id]/responses/[responseId]/files/[fileId]`) dan tautan "Unduh berkas" di halaman detail. Enum `FILE_UPLOAD` (migration `20260920200000_quiz_file_upload`).
- **Paritas pemutar wali (audit P0)**: pemutar ujian via wali kini mendukung **semua tipe soal baru** (Dropdown, Skala, Rating, Tanggal, Waktu, Tabel, Unggah file), **bagian + branching**, pratinjau gambar opsi, embed video, dan validasi jawaban — berbagi logika penilaian yang sama dengan jalur publik. Jawaban terstruktur disimpan di `JawabanUjian.structuredAnswer`; berkas wali diunggah via `POST /api/v1/wali/attempt/[attemptId]/upload` dan diunduh guru via `/api/v1/kuis/[id]/attempts/[attemptId]/files/[fileId]`. (Sebelumnya tipe baru jatuh ke textarea esai.)
- **Perbaikan UX/aksesibilitas (audit P1)**: **resume otomatis** kuis publik setelah refresh (responseId di `localStorage`); **error menunjuk soal** yang bermasalah (sorot + scroll otomatis); `role="alert"`/`aria-live` untuk error, timer, status simpan; `role="progressbar"` pada bilah progres; modal Pratinjau sebagai `role="dialog"` + `aria-modal` + tutup via Escape; input unggah gambar builder memakai `sr-only` (bisa diakses keyboard) + `focus-within` ring; warna aksen teks/tombol dihitung agar kontras aman; halaman publik memakai landmark `<main>`.
- **Paritas jalur guru (audit lanjutan P0)**: penilaian input hasil/koreksi guru (`exam-service`) kini mengenali **Dropdown, Skala, Rating, Tanggal, Waktu, dan Tabel** (sebelumnya semua jatuh ke "needsReview"); form koreksi guru menampilkan input sesuai tipe (dropdown/skala/tanggal/waktu/tabel) dan menyimpan `structuredAnswer`, plus **tautan unduh lampiran** untuk soal Unggah file (`/api/v1/kuis/[id]/files/[fileId]`).
- **P2 audit**: **maxAttempts ditegakkan** di tautan publik (dihitung per pembuat/ipHash, migration tidak perlu); peringatan non-blok di builder bila baris Tabel belum diberi kunci; **kuota unggah opsional** lewat `MAX_QUIZ_UPLOAD_MB` (0 = tanpa batas).
- **Penyempurnaan tampilan**: kartu soal publik dengan nomor berlingkaran beraksen tema, bilah progres pengisian, opsi terpilih di-highlight warna tema (termasuk Benar/Salah), dan baris opsi builder yang lebih rapi (label benar + input + gambar per opsi).
- Halaman **Respons** (`/guru/kuis/[ujianId]/responses`): ringkasan respons publik + pengerjaan wali, rata-rata skor, lulus, perlu review, dan **analisis benar/salah per soal**.
- Backend: `quiz-builder-service` + `POST/GET/PATCH /api/v1/kuis`, `POST /api/v1/kuis/[id]/publish`, `POST /api/v1/kuis/media`, `GET` respons builder; kolom baru `UjianSoal.required` (migration `20260920110000_ujian_soal_required`), `BankSoal.allowOther` (migration `20260920120000_quiz_allow_other`), `QuizMedia` (migration `20260920130000_quiz_media`), dan `UjianSection` + `UjianSoal.sectionId/branchRules` (migration `20260920140000_quiz_sections`), dan `Ujian.themeColor` (migration `20260920150000_quiz_theme`), `Ujian.headerImageUrl` (migration `20260920160000_quiz_header_image`), serta `OpsiSoal.mediaUrl` (migration `20260920170000_quiz_option_images`); player publik memvalidasi soal wajib sebelum submit.
- Verifikasi: `npm run test:quiz-builder` (10 check), e2e `quiz-builder.spec.ts` (buat → publikasi → bagikan), plus `test:quiz-share`, `test:reminders`, `test:notifications`, `test:week2`, unit test — semua lulus.

### Log Notifikasi (Track Record di Aplikasi)

- Halaman admin baru `/admin/notifikasi` (menu Administrasi → Notifikasi): menampilkan setiap pesan (email/WhatsApp/in-app) dengan status, kanal, penerima, template, jumlah percobaan, provider terakhir, respons, pesan error, dan tombol **Kirim ulang** untuk `FAILED`/`PENDING`.
- Endpoint `POST /api/v1/admin/notifikasi/[id]/retry` (ADMIN) memakai klaim atomik yang sama sehingga aman dari kiriman ganda; dicatat ke audit log.
- Semua pengiriman tetap terekam di `Notifikasi` + `NotificationDelivery` (provider, status, attempt, response n8n, errorMessage, sentAt).
- Verifikasi: `npm run test:notifications` (halaman admin, 403 non-admin, 404 id, retry tercatat) + e2e week1/accessibility/production-navigation.

### Reminder Tagihan & Deadline (email + WhatsApp)

- Reminder deadline (tugas/ujian/remedial) untuk wali kini dikirim lewat **email + WhatsApp** (sebelumnya in-app saja); siswa tetap mendapat notifikasi in-app. Pengiriman langsung (best-effort) setelah dibuat.
- Baru: reminder **tagihan** (`invoice-reminder`) H-3/H-1/jatuh tempo/terlambat via email + WhatsApp ke wali, idempoten per window (dedupe).
- Script baru `npm run reminders:invoices` (`scripts/send-invoice-reminders.ts`) + `sendInvoiceReminders()` di `reminder-service.ts`; jadwalkan harian bersama `reminders:send`.
- Verifikasi: `npm run test:reminders` (H-3, idempoten, deadline tetap jalan); unit test `getReminderWindow`; typecheck & eslint bersih.

### Perbaikan Harness E2E & Skrip Cron

- Helper login bersama `tests/e2e/support/auth.ts` dipakai 14 spec: login lewat API + pasang cookie sesi (deterministik), dengan retry saat dev server membalas 404 HTML karena route baru dikompilasi Turbopack. `retries` lokal diset 1 untuk meredam 404 kompilasi yang transien.
- `scripts/run-e2e-isolated.mjs` menonaktifkan seluruh feature flag untuk spec `production-navigation` agar benar-benar menguji perilaku default production (sebelumnya selalu gagal karena dev default mengaktifkan semua flag).
- Loader Node `scripts/node-module-hooks.mjs` + `scripts/register-node-module-hooks.mjs` me-resolve `server-only` dan alias `@/` untuk skrip di luar bundler Next; seluruh npm script job/backup/seed memakai `--import` sehingga `sessions:cleanup`, `billing:mark-overdue`, `billing:generate`, `reminders:send`, `mayar:reconcile`, `pakasir:reconcile`, `backup:create`, dan `backup:restore` kembali dapat dijalankan.
- Hasil: `accessibility`, `production-navigation`, `week7`, dan `week9` lulus; `npm run typecheck`, `npm test`, dan `npx eslint tests/e2e scripts` lulus.
- Verifikasi modul Guru/Wali: `week2`, `week3`, `week5`, `week8`, `week10`, `week11`, `w4`, `w5`, `week1` lulus. Sisa 2 test di `mobile-layout` (RTL Arab) gagal karena selector `select` kelas yang usang dan baseline screenshot (rasio diff 0.01) — kosmetik/harness, bukan cacat fungsional.

### Workflow n8n Siap Impor

- `deploy/n8n/limo-whatsapp.workflow.json` dan `deploy/n8n/limo-email.workflow.json`: webhook + validasi `X-Limo-Webhook-Secret` + kirim ke GOWA/Gmail + respond 2xx/401. Tinggal impor, ganti placeholder secret, dan pilih credential.
- Workflow email memakai node **Gmail** (OAuth2) dan menambah tracking **Telegram** (node "Telegram Sukses"/"Telegram Gagal"); kegagalan Gmail membalas 500 agar LIMO menandai `FAILED` dan mencoba ulang.
- Referensi langkah impor ada di `docs/PANDUAN_KONFIGURASI_NOTIFIKASI.md`.

### Kuis Builder & Share Link (ala Google Forms)

- Bank soal: form pembuatan kini mendukung opsi jawaban dinamis (tambah/hapus hingga 8, tandai kunci tunggal/ganda), pasangan menjodohkan, item urutan, dan kriteria rubrik yang bisa ditambah/hapus.
- Pengaturan kuis pada Ujian: `mode` (UJIAN/LATIHAN), `shuffleQuestions`, `shuffleOptions`, `passingScore`, `showScoreImmediately`, `showAnswersAfterSubmit`, `collectRespondentName`.
- Share link: tombol "Bagikan kuis" di daftar ujian guru menghasilkan `shareToken` stabil; halaman publik `/kuis/[token]` dapat dibuka tanpa login (isi nama, timer, draf autosave, submit) dan menampilkan skor/KKM/pembahasan sesuai pengaturan.
- Penilaian otomatis untuk tipe objektif; kunci jawaban tidak pernah dikirim ke responden sebelum submit. Respons publik disimpan di model `QuizResponse` (terpisah dari nilai kelas).
- Endpoint: `POST /api/v1/ujian/[id]/share`, `GET/POST /api/v1/public/quiz/[token]`, `GET/PATCH /api/v1/public/quiz/[token]/responses/[responseId]`, `POST .../submit`, `GET .../result`.
- Verifikasi: `npm run test:quiz-share` (buat soal/kuis, share, intro publik, tanpa kebocoran kunci, draf, submit auto-score + KKM + pembahasan, anti-submit-ganda, proteksi token); typecheck & eslint bersih.

### Export PDF/Excel per Peserta

- Endpoint baru `GET /api/v1/admin/pendaftaran/[id]/export/pdf` dan `/export/excel` (khusus ADMIN) menghasilkan dokumen per satu pendaftar dengan nama file memuat kode pendaftaran.
- Isi: data peserta (menyesuaikan Diri sendiri/Anak), data wali/kontak, seluruh jawaban formulir program, persetujuan, lampiran, dan riwayat status.
- Excel berupa multi-sheet: `Data Peserta`, `Jawaban Formulir`, `Persetujuan & Riwayat`. PDF A4 portrait dengan footer nomor halaman.
- Tombol unduh tersedia di halaman detail pendaftaran dan per baris pada daftar pendaftaran; setiap unduhan dicatat pada audit log (`PENDAFTARAN_EXPORTED`, scope detail).
- Verifikasi: `npm run test:pendaftaran-v2` menguji admin 200, non-admin 403, id tidak ditemukan 404, dan validitas berkas (PDF `%PDF`, XLSX zip).


## Status Minggu 1

Target teknis Minggu 1 dinyatakan selesai dan telah diverifikasi menggunakan SQLite lokal:

- Landing page, metadata sosial, sitemap, robots, halaman privasi, halaman syarat, kontak configurable, CTA, dan mobile navigation.
- Login/logout, forgot/reset/change password, database session, idle/absolute timeout, redirect per role, activation link, deactivate/reactivate user, dan revoke session.
- Pendaftaran publik, status lookup, dokumen privat, review, approval idempoten, rejection beralasan, audit, dan notification record.
- Data siswa: create/list/detail/update, archive/restore, filter, pagination, CSV, relasi banyak wali, dan mutasi kelas dengan histori enrollment.
- Acceptance test HTTP SQLite dan Playwright 360px telah lulus.

MariaDB tetap menjadi target production. SQLite hanya digunakan untuk development dan acceptance test sementara.

## Status Minggu 2

Target proposal Minggu 2 telah mulai ditutup untuk kebutuhan demo:

- LMS materi mendukung tipe teks, PDF, gambar, dan link video, dengan kategorisasi melalui program, level, kelas, dan sesi pertemuan.
- Route `/guru/materi` ditambahkan sebagai pintu masuk kelola materi per kelas.
- Bank soal mendukung pilihan ganda terstruktur dan esai, dengan scoping kelas/guru.
- Builder ujian mendukung durasi/timer ujian, status draft/published, tanggal ujian, bobot soal, dan pilihan soal dari bank soal.
- Input hasil ujian menampilkan timer, auto-skoring pilihan ganda, dan status final/review untuk esai.
- Route `/wali/nilai` ditambahkan untuk riwayat nilai ujian anak.
- Acceptance test Pekan 2 tersedia melalui `npm.cmd run test:week2`.
- Browser smoke test Pekan 2 tersedia di `tests/e2e/week2.spec.ts` untuk memastikan halaman Materi, Bank Soal, Ujian, Input Hasil, dan Riwayat Nilai Wali usable di viewport mobile tanpa horizontal overflow.

## Status Minggu 3

Target proposal Minggu 3 telah siap untuk demo:

- Presensi per sesi dapat diinput guru dan ditampilkan ke wali sebagai rekap kehadiran bulanan.
- Catatan progres belajar per sesi memakai skor pemahaman 1-5, catatan wali, dan catatan internal guru.
- Grafik progress tersedia tanpa dependency tambahan melalui bar chart CSS responsif: pemahaman, nilai ujian, dan kehadiran bulanan di halaman wali; ringkasan kelas guru juga memakai indikator grafik.
- Route `/wali/presensi` ditambahkan agar menu presensi wali tidak 404 dan menampilkan rate kehadiran per anak.
- Halaman tagihan wali menampilkan status, nominal, jatuh tempo, dan CTA instruksi pembayaran Mayar.
- Integrasi Mayar V2 mendukung create invoice, webhook `payment.received`, validasi merchant/nominal, status transition, dan reconciliation detail invoice.
- Acceptance test Minggu 3 tersedia melalui `npm.cmd run test:week3` dan browser smoke test mobile tersedia di `tests/e2e/week3.spec.ts`.

## Fitur yang Sudah Diimplementasikan

- Autentikasi database session: login, logout, forgot password, dan reset password.
- Role dan data scoping dasar untuk Admin, Guru, dan Wali.
- Dashboard terpisah berdasarkan role.
- Pendaftaran publik, upload dokumen privat, pengecekan status, approval, dan rejection.
- Master data program, level, kelas, guru, wali, siswa, dan enrollment dasar.
- LMS: sesi kelas, materi teks/video/file, dan upload materi privat.
- Assessment Bank SD English/Arabic dengan tipe PG, multi-select, benar/salah, isian, cloze, matching, sequencing, picture, listening, speaking, writing, reading, roleplay, esai, metadata CEFR/AKM, auto-scoring objektif, dan review rubric/manual.
- Ujian online MVP via akun wali tersedia melalui menu Tugas Anak, dengan attempt, timer server-authoritative, auto-scoring objektif, dan status review untuk jawaban manual.
- Timer ujian dan riwayat nilai wali untuk target Pekan 2.
- Presensi massal dan pencatatan progres siswa.
- Grafik progress wali/guru, rekap presensi bulanan, create payment Mayar, dan webhook payment untuk target Minggu 3.
- Tarif, tagihan, overdue job, webhook Mayar, dan rekonsiliasi pembayaran manual.
- PWA dasar, offline fallback, security headers, dan noindex untuk dashboard/auth.
- Script job eksternal untuk tagihan, overdue, session cleanup, dan retry notification.
- Unit test dasar dan dokumentasi deployment/UAT/backup.
- Setup SQLite reproducible melalui `npm run sqlite:setup`.
- Acceptance test Minggu 1 melalui `npm run test:week1` dan `npm run test:e2e`.

## UI dan TailAdmin

- Token warna, tipografi Outfit, shadow, button, card, dan form TailAdmin telah diadaptasi ke `src/app/globals.css`.
- Dashboard menggunakan sidebar, header, active navigation, dan mobile drawer bergaya TailAdmin.
- Shell dashboard telah diselaraskan dengan demo TailAdmin: sidebar 290/90 yang dapat collapse, ikon SVG, menu grouping, command search `Ctrl+K`, profile dropdown, dropdown notifikasi berbasis data, dan breadcrumb.
- Halaman auth sudah memakai pola TailAdmin signin/reset-password.
- Dashboard Admin memakai metric cards, recent registration table, komposisi pengguna, recent students, dan quick actions.
- Halaman Minggu 1 Pendaftaran, Siswa, dan Pengguna memakai responsive TailAdmin data tables, status badges, summary cards, filter, dan pagination.
- Seluruh route dashboard Admin, Guru, dan Wali telah memakai token serta utilitas visual TailAdmin.
- Form auth, pendaftaran publik, form dashboard, table, card, button, input, dan semantic feedback telah memakai komponen visual TailAdmin.
- Utility bersama `tailadmin-input`, `tailadmin-alert-error`, `tailadmin-alert-success`, dan `tailadmin-alert-warning` menjaga form tetap konsisten.
- Folder `free-react-tailwind-admin-dashboard-main` dipakai sebagai referensi desain dan dikecualikan dari TypeScript serta ESLint aplikasi.

## Landing Page

Landing page di `src/app/(public)/page.tsx` telah disesuaikan dengan identitas LIMO:

- Menggunakan logo resmi `public/icon.svg`.
- Hero bertema pembelajaran anak dengan Bahasa Inggris dan Bahasa Arab.
- Program English for Kids dan Arabic for Kids.
- Manfaat untuk anak, guru, dan wali.
- Alur pendaftaran empat langkah.
- Preview dashboard wali dan progres belajar.
- CTA pendaftaran dan pengecekan status.
- Responsive untuk mobile dan desktop.
- Warna utama tetap menggunakan token TailAdmin seperti `brand-*`, `gray-*`, `success-*`, dan `warning-*`.

## Verifikasi Terakhir

- `npm.cmd run typecheck`: lulus.
- `npm.cmd run lint`: lulus.
- `npm.cmd test`: lulus.
- `npm.cmd run test:week2`: 5 acceptance checks lulus untuk materi, bank soal, timer ujian, auto-skoring, dan riwayat nilai wali.
- `npm.cmd run test:week3`: lulus untuk presensi, progres, finalisasi sesi, grafik, rekap presensi wali, ringkasan kelas, instruksi payment Mayar, webhook payment, dan dropdown notifikasi berbasis data.
- `npm.cmd run build`: lulus dengan environment validasi.
- `npm.cmd run sqlite:setup`: lulus, schema valid, database sinkron, client generated, seed berhasil.
- `npm.cmd run test:week1`: 17 acceptance checks lulus.
- `npm.cmd run test:e2e`: 8 browser tests lulus, termasuk shell dashboard desktop/mobile, halaman Pekan 2 mobile, dan halaman Pekan 3 mobile.
- `GET /`: HTTP 200.
- `GET /login`: HTTP 200.
- `GET /api/health`: HTTP 200.

## Development Server

- URL: `http://127.0.0.1:3000`
- PID listener terakhir: `12576`
- Stop server: `taskkill /PID 12576 /T /F`

PID dapat berubah jika server dijalankan ulang.

## Catatan dan Batasan

- MariaDB/Docker belum tersedia di environment ini. Migration dan parity test MariaDB tetap harus dilakukan sebelum production.
- SQLite tidak memvalidasi perilaku khusus MariaDB seperti collation, precision Decimal, batas `VarChar`, dan concurrency write.
- Data kontak production, jadwal resmi, testimoni terverifikasi, materi, dan konten final perlu dikonfirmasi oleh LIMO.
- Landing page memiliki kebebasan visual LIMO sendiri; dashboard, auth, dan form operasional tetap mengikuti TailAdmin.
- Provider email SMTP dan outbound n8n sudah tersedia; credential Mayar production, workflow GOWA nyata, dan UAT payment end-to-end di environment production masih perlu diselesaikan.

## Langkah Berikutnya

1. Finalisasi konten resmi landing page: kontak, jadwal, testimoni, dan informasi program.
2. Lanjutkan target Minggu 4: integrasi final, pengujian, deployment production, dan pelatihan.
3. Siapkan MariaDB, buat migration production dari `prisma/schema.prisma`, seed, dan jalankan parity test.
4. Selesaikan workflow n8n/GOWA, credential Mayar production, dan UAT payment end-to-end.

## Ujian Mandiri untuk Siswa (25 Sep 2026)

- Siswa dapat mengerjakan ujian daring dari akun sendiri (bukan hanya lewat akun wali). Mode baru `ONLINE_VIA_SISWA` (selain `BOTH`) dipilih Guru pada form ujian dan builder kuis; ujian `TEACHER_ENTRY` tetap tidak dapat dikerjakan siswa.
- Skema: `UjianAttempt.waliProfileId` menjadi nullable, ditambah `siswaAccountId` (FK ke `SiswaAccount`, `onDelete: SetNull`) dan `startedByRole` (`WALI`/`SISWA`); migration `20260925010000_student_self_exam`.
- Service `online-exam-service` digeneralisasi dengan "attempt scope" bersama (wali/siswa) sehingga logika mulai/draf/unggah/kumpulkan dinilai satu jalur; ditambah `listStudentExams`, `getStudentExamInstruction`, `startStudentExamAttempt`, `getStudentAttemptContext`, `saveStudentAttemptDraft`, `uploadStudentAttemptFile`, `submitStudentAttempt`. Jalur wali tetap utuh.
- API siswa baru: `GET /api/v1/siswa/ujian`, `POST /api/v1/siswa/ujian/[ujianId]/attempt`, `PATCH/POST /api/v1/siswa/attempt/[attemptId]` (+`/submit`, `/upload`).
- UI: pemutar `OnlineExamPlayer` menerima `basePath`/`submittedHref`, tombol mulai menerima `endpoint`/`redirectBase` (dipakai wali & siswa); halaman baru `/siswa/ujian`, `/siswa/ujian/[ujianId]`, `/siswa/ujian/attempt/[attemptId]`; entri menu "Ujian" dan CTA di beranda/detail kelas siswa.
- Feature flag baru `STUDENT_SELF_EXAM_ENABLED` (`studentSelfExamEnabled`), default development aktif dan production nonaktif; disinkronkan ke env/contoh env, Docker Compose, CI, dan dokumentasi.
- Notifikasi publish: ujian mode siswa memicu `notifySiswaForStudents`; mode wali tetap `notifyWaliForStudents`.
- Isolasi: attempt ter-scope ke pemilik (wali↔siswa dan antar siswa ditolak), dan hanya satu attempt aktif per (ujian, siswa). `maxAttempts` dihitung per (ujian, siswa) lintas pemilik.
- Verifikasi (semua hijau): `npm run sqlite:setup` · `npm run typecheck` · `npm run lint` 0 error · `npm test` 34 lulus · `test:siswa-ujian` 10/10 (termasuk render halaman) · regresi `test:quiz-builder` 22/22, `test:accounts` 11/11, `test:sertifikat` 7/7.
- Backlog fase berikutnya: rekaman speaking langsung, serta diskusi kelas + pengumuman.

## Mode Aman, Rilis Nilai, & Unduh Berkas Siswa (25 Sep 2026)

- **Mode aman**: `Ujian.secureMode` (toggle di form ujian & tab Pengaturan builder) membuat pemutar mencatat perpindahan tab (`visibilitychange`) ke `UjianAttempt.violationCount`/`lastViolationAt`. Laporan dikirim lewat `POST /api/v1/{siswa,wali}/attempt/[attemptId]/violation` (hanya pemilik attempt, rate-limit 120/jam). Badge "Mode aman · n peringatan" tampil di pemutar, dan Guru melihatnya sebagai peringatan di halaman koreksi hasil ujian.
- **Rilis nilai ke siswa**: `Ujian.showResultToSiswa` (toggle di form ujian & builder). Saat nilai ditahan, daftar ujian siswa menampilkan status **Dikirim** tanpa nilai, dan nilai tidak muncul di beranda siswa. Status `SUBMITTED` ditambahkan ke perhitungan status baris tugas.
- **Unduh berkas jawaban siswa**: `GET /api/v1/siswa/attempt/[attemptId]/files/[fileId]` ber-scope `siswaAccountId` + verifikasi fileId ada di draf/jawaban; nama berkas pada pemutar kini menjadi tautan unduh.
- Migrasi `20260925020000_exam_secure_mode_result_release` (4 kolom: `Ujian.secureMode`, `Ujian.showResultToSiswa`, `UjianAttempt.violationCount`, `UjianAttempt.lastViolationAt`).
- Verifikasi (semua hijau): `npm run typecheck` · `npm run lint` 0 error · `npm test` 34 · `test:siswa-ujian` **13/13** · regresi `test:quiz-builder` 22/22 · `test:accounts` 11/11 · `test:sertifikat` 7/7.
- Backlog lanjutan: mode aman lebih kuat (fullscreen/anti-paste), rilis nilai per attempt, rekaman speaking.

## Pengumuman & Diskusi Kelas (Fase 9 — 25 Sep 2026)

Dibangun 3 fase sesuai `rencana.md` FASE 9, di balik flag **`CLASS_DISCUSSION_ENABLED`** (dipakai sungguhan, bukan flag mati).

- **Fase A — Pengumuman + status baca.** Model `Pengumuman` (title, content, `priority` NORMAL/IMPORTANT/URGENT, `audience` SISWA/WALI/SEMUA, `publishAt`/`expiresAt`, `notifiedAt`) + `PengumumanRead` (unique per penerima per pengumuman). Migrasi `20260925030000_pengumuman`. Service `pengumuman-service.ts`: create/update/status/read/list + `listWaliPengumuman`. Visibilitas dihitung saat query → jadwal & kedaluwarsa idempoten tanpa job. Notifikasi `pengumuman-baru` lewat `notifyKelasAktif` (baru) instan untuk yang sudah terbit, dan disusul oleh job `npm run pengumuman:publish` (`scripts/send-due-pengumuman.ts`, klaim atomik `notifiedAt`).
- **Fase B — Ruang tanya jawab.** Model `DiskusiThread` (status OPEN/LOCKED/HIDDEN, `isPinned`, `replyCount`, `lastReplyAt`, `deletedAt`) + `DiskusiBalasan` (`parentReplyId`, `isTeacherAnswer`, VISIBLE/HIDDEN, `deletedAt`). Migrasi `20260925040000_diskusi`. Service `diskusi-service.ts`: list (sematan → aktivitas terakhir → terbaru), create thread (**WALI ditolak**), balas (WALI boleh), edit 15 menit, moderasi pin/kunci/sembunyikan/soft-delete + audit `DISKUSI_*`, notifikasi `diskusi-baru`/`diskusi-balasan` ke guru + pembuat thread.
- **Fase C — Moderasi lanjutan.** Model `DiskusiLaporan` + `FileOwnerType += DISKUSI` + FK `FileAsset.diskusiThreadId` (migrasi `20260925050000_diskusi_moderasi`). Lampiran thread berpenyimpanan privat (`storeMaterialFile`) dengan unduh/hapus ber-scope kelas; lapor konten (idempoten, rate-limited) ke antrean admin `/admin/diskusi-laporan` + halaman tinjau.
- **Scoping** terpusat: `assertViewKelasForum` / `assertManageKelasForum` di `access-policy.ts` (Admin ✓, Guru pengampu ✓, Siswa dengan enrollment aktif ✓, Wali dengan anak terdaftar ✓; siswa/wali luar kelas → 404, guru non-pengampu → 403).
- **Entri**: tombol **Pengumuman** + **Diskusi** di halaman detail kelas guru & siswa, menu **Pengumuman**/**Diskusi** untuk WALI, menu **Laporan Diskusi** untuk ADMIN. Halaman: guru/siswa `/kelas/{id}/{pengumuman,diskusi}` (+ thread), wali `/wali/{pengumuman,diskusi}`, admin `/admin/diskusi-laporan`.
- **Deviasi terhadap spesifikasi (disetujui)**: wali boleh membalas thread (FASE 9 menyebut read-only); wali tidak boleh membuat thread.
- **Penyempurnaan antar run**: halaman daftar diskusi kini menerima `?pageSize=` (dibatasi `resolvePagination`) sehingga pagination dapat diuji tanpa membuat puluh thread.

**Verifikasi (semua hijau):** `sqlite:setup` · `typecheck` ✓ · `lint` 0 error ✓ · `npm test` **34** · **`test:diskusi` 23/23** (dijalankan 2×, repeatable) · regresi `test:quiz-builder` **22/22**, `test:accounts` **11/11**, `test:sertifikat` **7/7**, `test:siswa-ujian` **13/13**.

**Catatan operasional**: rate limit aplikasi in-process. `test:diskusi` membuat akun luar kelas segar tiap run untuk uji rate limit; bila dijalankan berulang lebih dari ~3 kali dalam 15 menit, kuota akun utama (guru/admin/siswa) bisa habis — restart dev server untuk reset.

## Rekaman Suara, Antrean Unggah Persisten, Voucher & Kuitansi (25 Sep 2026)

- **Rekaman speaking langsung (MediaRecorder).** Komponen baru `src/components/quiz/audio-recorder.tsx` (rekam/jeda/berhenti, batas 5 menit, pratinjau, rekam ulang) dipakai di pemutar wali/siswa (`online-exam-player.tsx`) **dan** tautan publik (`public-quiz-runner.tsx`) pada soal `FILE_UPLOAD`. Hasil rekaman (audio/webm) memakai jalur unggah yang sudah ada — MIME audio sudah diizinkan `storeQuizSubmissionFile`.
- **Konfigurasi unggah soal disurfacekan.** `sanitizeQuestion` (`public-quiz-service.ts`) dan pemetaan halaman attempt wali/siswa kini mengirim `uploadAllowedTypes`/`uploadMaxSizeMb` → input berkas memakai `accept`, batas ukuran divalidasi di klien lebih awal, dan tombol rekam hanya tampil bila soal mengizinkan audio (`canRecordAudio`).
- **Antrean unggah persisten (IndexedDB).** Helper `src/lib/upload-queue.ts`; kedua pemutar menyimpan berkas gagal/offline ke IndexedDB, memulihkannya setelah reload, dan mengunggah otomatis saat koneksi pulih atau saat halaman dimuat kembali dalam keadaan online. Kuota antrean dibersihkan setelah submit sukses.
- **Voucher/diskon.** Model `Voucher` (+ enum `VoucherDiscountType`) dan kolom `Tagihan.subtotal`/`discountAmount`/`voucherId` (migrasi `20260925060000_vouchers_and_receipts`). Service `voucher-service.ts`: buat/aktifkan/arsipkan + terapkan/lepas kode dengan penegakan masa berlaku, minimal tagihan, dan kuota secara atomik (audit `VOUCHER_*`). Route: `GET/POST /api/v1/admin/voucher`, `PATCH /api/v1/admin/voucher/[id]`, `POST/DELETE /api/v1/tagihan/[id]/voucher`. UI: form + katalog voucher di `/admin/tagihan`; form pakai kode di kartu tagihan Wali/Admin (berlaku hanya untuk tagihan UNPAID/OVERDUE).
- **Kuitansi PDF.** `receipt-pdf-service.ts` (pdfkit) + `GET /api/v1/tagihan/[id]/kuitansi` (hanya tagihan lunas; memuat subtotal, diskon/voucher, total dibayar, metode, referensi). Tombol unduh di workspace Admin & Wali.
- **Belum dikerjakan:** cicilan/angsuran (butuh kebijakan pembayaran parsial) dan cakupan voucher per program/kelas.
- **Verifikasi (semua hijau):** `sqlite:setup` ✓ · `typecheck` ✓ · `lint` 0 error ✓ · `npm test` **36** · **`test:billing-voucher` 8/8** (baru) · regresi `test:quiz-builder` 22/22, `test:siswa-ujian` 13/13, `test:quiz-share` 5/5, `test:payment` 1/1. Catatan: `test:week3` gagal karena sebab pra-ada (assert teks `Gerbang Pembayaran: {label}` terpecah antar text node + gateway Mayar tidak terkonfigurasi di seed), bukan akibat perubahan ini.

## E2E Fitur Baru + Perbaikan Permissions-Policy (25 Sep 2026)

- **E2E baru** (runner terisolasi, DB + server per spec, setup Prisma sendiri + cleanup):
  - `tests/e2e/student-exam.spec.ts` — ujian mandiri siswa end-to-end termasuk **rekaman suara nyata** (MediaRecorder + `--use-fake-device-for-media-stream`) dan audit axe pemutar.
  - `tests/e2e/class-forum.spec.ts` — guru buat pengumuman → siswa tandai dibaca → siswa buat diskusi → wali balas → guru sematkan.
  - `tests/e2e/billing-voucher.spec.ts` — admin buat voucher → wali pakai → rekonsiliasi admin → wali unduh kuitansi PDF.
- **🐞 Bug produksi (ditemukan e2e, diperbaiki):** `next.config.ts` mengirim `Permissions-Policy: camera=(), microphone=()` → `getUserMedia` selalu `NotAllowedError`, sehingga rekaman suara ujian **dan** rekaman audio/video pada pengumpulan tugas tidak mungkin berjalan. Diubah ke `camera=(self), microphone=(self), geolocation=()`.
- **Kontras (temuan axe e2e):** badge "Bobot" pemutar ujian + teks `AudioRecorder` + teks bantuan unggahan pemutar publik dinaikkan ke rasio ≥4.5.
- **Kartu tagihan Wali** diberi `data-invoice-id` untuk selector e2e yang stabil.
- **Verifikasi:** e2e `student-exam` 1/1 · `class-forum` 1/1 · `billing-voucher` 1/1 · `mobile-layout` 16/16 · `quiz-builder` 2/2 (semua lulus di runner terisolasi); `typecheck` ✓ · `lint` 0 error ✓.

## Pengumuman Sekolah, Mode Aman Lebih Kuat, Cakupan Voucher (25 Sep 2026)

- **Pengumuman sekolah-wide** (`kelasId` null, hanya Admin). Service `pengumuman-service.ts`: `createPengumuman` menerima `kelasId` kosong bila actor ADMIN; visibilitas siswa/wali menyertakan `kelasId: null`; `countUnreadPengumuman` ikut menghitung pengumuman sekolah; fungsi baru `listSchoolPengumuman`. Notifikasi baru `notifySekolahAktif` (semua siswa/wali aktif) dipakai `pengumuman-job-service` untuk `kelasId` null; job `pengumuman:publish` tidak lagi menyaring `kelasId not null`. UI: halaman **`/admin/pengumuman`** + entri menu "Pengumuman". Verifikasi: `test:diskusi` **24/24**.
- **Mode aman lebih kuat** (`online-exam-player.tsx`): tombol **Aktifkan layar penuh**, blokir tempel/salin/potong/klik-kanan (masing-masing tercatat sebagai pelanggaran lewat endpoint `/violation`), dan keluar layar penuh dicatat. Verifikasi: e2e `student-exam` **2/2**.
- **Cakupan voucher per program/kelas**: `Voucher.programId`/`kelasId` + relasi (migrasi `20260925070000_voucher_scope`); `applyVoucher` menolak voucher yang tidak sesuai program/kelas siswa; `VoucherForm` menambah pemilih cakupan; katalog menampilkan cakupan. Verifikasi: `test:billing-voucher` **9/9**.
- **Lampiran pada balasan diskusi**: `FileAsset.diskusiBalasanId` + `DiskusiBalasan.attachments` (migrasi `20260925080000_diskusi_balasan_lampiran`); service `attachDiskusiReplyFile`/`getDiskusiReplyFile`/`removeDiskusiReplyAttachment` (penulis balasan atau pengelola kelas; unduh ber-scope kelas); route `diskusi/replies/[replyId]/attachments[/fileId[/remove]]`; UI lampiran di kartu balasan (`diskusi-attachments.tsx`, `diskusi-thread-view.tsx`).
- **Rilis nilai per attempt/hasil**: `HasilUjian.releasedAt` (migrasi `20260925090000_exam_result_release_per_student`); service `releaseHasilUjian` (guru pengampu/admin, hanya FINAL/CORRECTED) + route `POST /api/v1/hasil-ujian/[hasilId]/release` + tombol `ExamResultReleaseButton` di halaman hasil guru. Query visibilitas nilai (daftar ujian siswa/wali, beranda siswa, beranda wali, laporan) kini `OR` dengan `releasedAt`, melampaui flag global `showResultToSiswa/Wali`.
- **Belum dikerjakan:** cicilan/angsuran (butuh kebijakan pembayaran parsial), Q&A per materi/modul (enum `DISCUSSION`), mode "angkat & pindah" drag keyboard penuh.
- **Verifikasi:** `typecheck` ✓ · `lint` 0 error ✓ · `npm test` 36 · `test:diskusi` **25/25** · `test:siswa-ujian` **14/14** · `test:billing-voucher` 9/9 · e2e `student-exam` 2/2, `class-forum` 1/1, `billing-voucher` 1/1, `mobile-layout` 16/16.

## Rapikan IA Asesmen Guru (30 Sep 2026)

- **Akar masalah**: `/guru/ujian` dan `/guru/kuis` sama-sama memanggil `listUjian(...)` yang membaca tabel `Ujian` yang sama — dua item nav terpisah untuk satu entitas. Selain itu hanya `/guru/ujian` yang masih menaruh form pembuatan **inline** di halaman daftar.
- **Satu hub asesmen**: `/guru/ujian` kini daftar tunggal (judul "Ujian & Kuis"). Navigasi GURU grup **Evaluasi** menjadi **Bank Soal**, **Ujian & Kuis**, **Penilaian Esai** (item "Formulir Kuis" dihapus).
- **Pola create disamakan**: form ujian pindah ke halaman khusus **`/guru/ujian/baru`** (mengikuti pola `/guru/bank-soal/baru` dan `/guru/kuis/baru`). Judul form diubah menjadi "Detail Ujian" agar tidak duplikat dengan judul halaman.
- **Aksi baris seragam**: **Input Hasil** (`/guru/ujian/[id]/hasil`), **Respons** (`/guru/kuis/[id]/responses`), **Edit formulir** (`/guru/kuis/[id]/edit`), plus Duplikat/Status/Share.
- **Redirect deklaratif**: `/guru/kuis` → `/guru/ujian` via `next.config.ts` `redirects()` (HTTP 307). Sub-rute builder tetap utuh: `/guru/kuis/baru`, `/guru/kuis/[ujianId]/edit`, `/responses`, `/responses/[responseId]`. Tanpa perubahan model/skema.
- **Komponen baru `AssessmentTabs`** menyatukan tiga area (Ujian & Kuis, Bank Soal, Penilaian Esai) di halaman daftar maupun halaman buat.
- **Dua bug pra-ada yang ikut ditutup**:
  - Item nav GURU `/guru/todo` ("Perlu Ditindaklanjuti") tidak di-gate `calendarEnabled` padahal guard `requireTodoFeature` memakainya → menu menuju 404 saat flag produksi mati. Kini di-gate seperti WALI/SISWA.
  - Baseline snapshot `guru-arabic-bank-soal-card` basi sejak `BankSoalActions` ditambahkan (61bd2e9) sehingga `mobile-layout` gagal; baseline diperbarui.
- **Verifikasi (semua hijau)**: `sqlite:setup` ✓ · `typecheck` ✓ · `lint` 0 error (3 warning pra-ada) ✓ · `npm test` 34 · `test:guards` 221 route · integrasi `test:quiz-builder` ✓, `test:week2` ✓ · e2e `week2.spec.ts` 2/2 (1 flaky pra-ada pada autosave ujian wali, lulus di retry), `quiz-builder` 2/2, `guru-workspace` 2/2, `accessibility` 5/5, `production-navigation` 2/2, `a8-g12` 1/1, `mobile-layout` 16/16.
- **Backlog (bukan bagian perubahan ini)**: menyatukan dua jalur rilis nilai (`HasilUjian.releasedAt` vs `QuizResponse.scoreReleasedAt`) dan dua penyimpanan jawaban; opsi diskriminator `Ujian.kind` bila nanti perlu memfilter daftar.

## Builder Asesmen Tunggal ala Google Forms — Fase 1 (30 Sep 2026)

- **Satu builder untuk semua asesmen**: `UjianForm` (form ujian lama) dihapus. `/guru/ujian/baru` kini mengarah ke builder ala Google Forms (`/guru/kuis/baru`), dan hub "Ujian & Kuis" punya satu CTA "Buat formulir baru".
- **21 tipe soal didukung builder** (sebelumnya 12): ditambah MENJODOHKAN, URUTAN, CLOZE, GAMBAR, LISTENING, READING, SPEAKING, WRITING, ROLEPLAY. Menu tipe kini dikelompokkan (Pilihan, Teks, Skala & kisi, Tanggal & berkas, Bahasa & performa) lewat `src/lib/question-types.ts` sebagai sumber tunggal untuk UI + validasi server.
- **Editor baru**: pasangan (menjodohkan), daftar urut (urutan), stimulus/bacaan/konteks, rubrik penilaian inline (speaking/writing/roleplay), serta panel **"Metadata & pedagogi"** per soal (bahasa, arah RTL, level kognitif, keterampilan, kesulitan, standar, tipe asesmen). `examDate` ditambahkan ke tab Pengaturan.
- **Round-trip lossless (perbaikan kerusakan data)**: sebelumnya membuka asesmen berisi tipe di luar 12 tipe builder mengubah tipenya menjadi `ESAI` saat disimpan, dan `examDate`, `stimulusText`, `language`/`direction`, `rubric`, serta metadata pedagogis tidak pernah dibaca maupun ditulis. Kini `getQuizForm` men-select seluruh kolom, `createSectionsAndQuestions` mengisi seluruh kolom `BankSoal`, dan pemetaan DTO→state dipindah ke `src/lib/quiz-builder-mapping.ts` (fallback ke ESAI dihapus). **Tanpa migrasi DB.**
- **Perbaikan mobile**: baris opsi builder dibuat `flex-wrap` + input `min-w-0`, sehingga tidak ada lagi overflow horizontal pada 390px (sebelumnya meluber ±7px).
- **Verifikasi**: `sqlite:setup` ✓ · `typecheck` ✓ · `lint` 0 error ✓ · `npm test` 43 ✓ · `test:guards` 221 route ✓ · `test:quiz-builder` ✓ (termasuk blok baru "21 tipe + metadata round-trip tanpa kehilangan") · e2e `week2` 3/3 ✓ · e2e `quiz-builder` 2/2 ✓.
- **Belum selesai**: (3) builder **Tugas & Modul** memakai pola kartu yang sama; (4) pembaruan dokumen/tes untuk fase 3.

## Builder Asesmen Tunggal ala Google Forms — Fase 2: Pustaka Soal (30 Sep 2026)

- **Bank soal menyatu ke form builder.** Tidak ada lagi pembuatan soal berdiri sendiri: `bank-soal-form.tsx`, `bank-soal-preview.tsx`, `bank-soal-draft-preview.tsx`, `lib/bank-soal-draft.ts`, serta halaman `/guru/bank-soal/baru`, `/guru/bank-soal/[id]/edit`, `/guru/bank-soal/pratinjau`, dan `/guru/bank-soal/[id]/pratinjau` **dihapus**. Soal selalu dibuat di dalam formulir (builder otomatis menyimpannya ke `BankSoal`).
- **`/guru/bank-soal` menjadi Pustaka Soal**: pencarian pertanyaan + filter tipe + toggle arsip; kartu soal menampilkan stimulus/media/opsi/kunci (sehingga tidak perlu halaman pratinjau terpisah); aksi Duplikat/Arsipkan/Pulihkan/Hapus. CTA "Buat formulir baru" mengarah ke builder. Aksi "Ubah" dihapus karena pengubahan soal dilakukan di formulir pemiliknya.
- **Navigasi & tab**: label nav GURU "Bank Soal" → **"Pustaka Soal"**; `AssessmentTabs` memakai label baru.
- **API dipertahankan**: `POST/PATCH/DELETE /api/v1/bank-soal` tetap tersedia (dipakai uji integrasi dan kemungkinan integrasi luar); hanya UI-nya yang dihapus.
- **Tes**: `bank-soal-builder.spec.ts` diganti **`bank-soal-library.spec.ts`** (pustaka menampilkan soal & tanpa jalur pembuatan terpisah; cari + filter tipe; duplikat). `week2.spec.ts` dan `accessibility.spec.ts` disesuaikan; blok snapshot form Arab dihapus dan baseline `guru-arabic-bank-soal-card` diperbarui (kartu lebih pendek karena tautan pratinjau hilang).
- **Dokumen**: `fitur.md`, `docs/UI_UX_AUDIT.md`, `docs/ROLE_ACCESS_MATRIX.md`, `docs/KNOWN_LIMITATIONS.md` diperbarui.
- **Verifikasi**: `typecheck` ✓ · `lint` 0 error ✓ · e2e `bank-soal-library` 3/3 ✓ · `week2` 3/3 ✓ · `accessibility` 5/5 ✓ · `mobile-layout` 16/16 ✓.
- **Selesai.** Lanjut ke Fase 3 (lihat bagian berikutnya).

## Builder Asesmen Tunggal ala Google Forms — Fase 3: Kartu Bersama untuk Tugas & Modul (30 Sep 2026)

- **Primitif kartu bersama**: komponen baru `src/components/builder/builder-card.tsx` (`BuilderCard`) dengan pola kartu Google Forms — label kecil, judul, deskripsi, deretan aksi, dan isi yang ditumpuk vertikal.
- **Builder Tugas** (`assignment-builder.tsx`) dan **Builder Modul** (`learning-module-builder.tsx`) kini memakai `BuilderCard` untuk kartu "Buat tugas baru", "Buat alur belajar baru", dan panel "Tambah Aktivitas". Baris aktivitas modul memakai `tailadmin-card` agar seragam dengan kartu soal.
- **Tanpa perubahan model, service, endpoint, atau props** — hanya tata letak. Teks yang dikunci tes tetap sama: heading **"Buat tugas baru"** dan **"Buat alur belajar baru"**; `useAsyncAction`, `useConfirmDialog`, dan testid (`remedial-*`, `assignment-submissions`) tidak berubah.
- **Verifikasi**: `typecheck` ✓ · `lint` 0 error ✓ · `npm test` 43 ✓ · `test:guards` 221 route ✓ · integrasi `test:week4` 6/6 ✓ · `test:week5` 8/8 ✓ · e2e `week4` 2/2 ✓ · `week5` 2/2 ✓.
- **Catatan**: ekstraksi kit penuh untuk kartu soal (`src/components/builder/*`) belum dilakukan; sejauh ini hanya `BuilderCard` yang diekstrak dan dipakai bersama.

## Ekstraksi Kit Builder — Tahap 1: Panel Pengaturan (30 Sep 2026)

- Panel **Pengaturan** builder soal dipindah dari `quiz-builder.tsx` ke komponen baru `src/components/builder/builder-settings-panel.tsx` (`BuilderSettingsPanel`); `Toggle` dan `THEME_COLORS` ikut pindah ke sana.
- `quiz-builder.tsx` menyusut **1657 → 1520 baris**. Komponen hanya menerima `form`, `onPatch`, dan `onUploadHeaderImage` — tanpa perubahan perilaku, markup, atau nama aksesibel.
- **Verifikasi**: `typecheck` ✓ · `lint` 0 error ✓ · `npm test` 43 ✓ · `test:guards` 221 route ✓ · `test:quiz-builder` ✓ (termasuk round-trip 21 tipe) · e2e `quiz-builder` 2/2 ✓ (termasuk interaksi tab Pengaturan).
- **Tahap 2 (30 Sep 2026)**: kartu kepala + toolbar (status draf/terbit, simpan, undo/redo, pratinjau, cetak PDF, duplikat, publikasi, judul, deskripsi, pemilih kelas) dipindah ke `src/components/builder/builder-header-card.tsx` (`BuilderHeaderCard`). `quiz-builder.tsx` kini ±1460 baris. Verifikasi: `typecheck` ✓ · `lint` 0 error ✓ · e2e `quiz-builder` 2/2 ✓.
- **Sisa ekstraksi**: kartu soal + editor per tipe (bagian terbesar, ±600 baris) dan hook state/undo/autosave.

## Jaring Pengaman E2E Editor Builder (30 Sep 2026)

- Spec baru `tests/e2e/form-builder-editors.spec.ts` (2 tes) mengisi lalu menyimpan dan memuat ulang lewat UI untuk editor yang sebelumnya **tanpa cakupan e2e**: **skala** (min/max/label/jawaban benar), **urutan** (item), **menjodohkan** (pasangan), **tabel** (kolom, baris, kunci), **cloze** (stimulus + kunci), **unggah berkas** (tipe + ukuran), **rubrik** (kriteria + skor maks), dan **metadata & pedagogi** (bahasa, arah RTL, level kognitif, keterampilan, kesulitan, tipe asesmen). Tes juga memastikan tidak ada overflow horizontal.
- Perbaikan aksesibilitas kecil: `<select>` kunci baris tabel kini punya `aria-label` `Kunci baris N` (sebelumnya tidak bernama sehingga ambigu bagi pembaca layar dan tes).
- Verifikasi: e2e `form-builder-editors` 2/2 ✓.
- Ini prasyarat sebelum memindahkan kartu soal + editor dari `quiz-builder.tsx` ke `src/components/builder/*`.

## Ekstraksi Kit Builder — Tahap 3: Editor Opsi (30 Sep 2026)

- Editor opsi jawaban (pilihan ganda, kotak centang, dropdown, dan kolom tabel) dipindah ke `src/components/builder/question-options-editor.tsx` (`QuestionOptionsEditor`): pengurutan drag + tombol, gambar opsi, tombol hapus, dan opsi "Lainnya".
- `QUESTION_OPTION_LABELS` dipindah ke `src/lib/quiz-builder.ts` agar label A–J tidak diduplikasi.
- `quiz-builder.tsx` menyusut **1490 → 1423 baris**. Tanpa perubahan perilaku, markup, atau nama aksesibel.
- **Verifikasi**: `typecheck` ✓ · `lint` 0 error ✓ · e2e `form-builder-editors` 2/2 ✓ · e2e `quiz-builder` 2/2 ✓.
- **Sisa ekstraksi**: editor tabel (baris + kunci), skala/rating, menjodohkan, urutan, rubrik, stimulus, metadata, validasi, unggah, branching; lalu hook state/undo/autosave.

## Ekstraksi Kit Builder — Tahap 4: Editor Tabel & Skala (30 Sep 2026)

- Editor **tabel pilihan** dan **skala/rating** dipindah ke `src/components/builder/question-grid-scale-editors.tsx` (`QuestionGridEditor`, `QuestionScaleEditor`): baris pernyataan dengan drag + tombol urut dan kunci kolom; rentang skala, label ujung, dan jawaban benar.
- `quiz-builder.tsx` menyusut **1423 → 1362 baris**. Tanpa perubahan perilaku, markup, atau nama aksesibel.
- **Verifikasi**: `typecheck` ✓ · `lint` 0 error ✓ · e2e `form-builder-editors` 2/2 ✓ (khususnya skala & tabel) · e2e `quiz-builder` 2/2 ✓.
- **Sisa ekstraksi**: menjodohkan, urutan, rubrik, stimulus, metadata & pedagogi, validasi jawaban, unggah berkas, branching, dan pemilih bank soal/impor; lalu hook state/undo/autosave.

## Ekstraksi Kit Builder — Tahap 5: Editor Struktur & Panel Metadata (30 Sep 2026)

- `src/components/builder/question-structure-editors.tsx` baru berisi `QuestionMatchingEditor` (pasangan jawaban), `QuestionSequenceEditor` (urutan benar), `QuestionRubricEditor` (kriteria penilaian manual), dan `QuestionMetaPanel` (panel "Metadata & pedagogi": bahasa, arah RTL, level kognitif, keterampilan, kesulitan, standar, tipe asesmen).
- `quiz-builder.tsx` menyusut **1362 → 1291 baris** (dari 1657 sebelum ekstraksi dimulai, turun ±22%). Tanpa perubahan perilaku, markup, atau nama aksesibel.
- **Verifikasi**: `typecheck` ✓ · `lint` 0 error ✓ · e2e `form-builder-editors` 2/2 ✓ (menjodohkan, urutan, rubrik, metadata) · e2e `quiz-builder` 2/2 ✓.
- **Sisa ekstraksi**: validasi jawaban, unggah berkas, branching, stimulus, umpan balik, kunci tanggal/waktu, blok isian/cloze, dan pemilih bank soal/dialog impor; lalu hook state/undo/autosave.

## Ekstraksi Kit Builder — Tahap 6: Sisa Field Kartu Soal (30 Sep 2026)

- `src/components/builder/question-extra-fields.tsx` (`QuestionExtraFields`) menampung sisa field kartu soal: umpan balik benar/salah, konfigurasi unggah berkas, branching antar bagian, kunci benar/salah, kunci + validasi jawaban (angka/panjang/regex/jumlah pilihan), pembahasan, dan footer (wajib diisi, poin, acak opsi).
- `quiz-builder.tsx` menyusut **1291 → 1171 baris** (dari 1657 sebelum ekstraksi dimulai, turun ±29%).
- **Verifikasi**: `typecheck` ✓ · `lint` 0 error ✓ · e2e `form-builder-editors` 2/2 ✓ · e2e `quiz-builder` 2/2 ✓.
- **Sisa ekstraksi**: pengelola bagian (section), pemilih bank soal, dialog impor soal; lalu hook state/undo/autosave.

## Titik Lanjut (Resume Point) — Ekstraksi Kit Builder (30 Sep 2026)

**Sudah selesai** (commit `fc1e0c3` → `d2a15b1`; tahap 7–8 belum di-commit):
- `src/components/builder/`: `builder-card.tsx`, `builder-header-card.tsx`, `builder-settings-panel.tsx`, `question-options-editor.tsx`, `question-grid-scale-editors.tsx`, `question-structure-editors.tsx`, `question-extra-fields.tsx`, `question-section-manager.tsx`, `question-source-panels.tsx`.
- Hook `src/components/dashboard/use-form-builder.ts`: state form, save/publish, autosave (debounce 1,2 dtk), history/undo-redo + shortcut Ctrl/Cmd+Z, `toPayload`, `validate`, dan seluruh mutasi soal/opsi/bagian/cabang.
- Pendukung: `src/lib/question-types.ts` (21 tipe), `src/lib/quiz-builder-mapping.ts` (DTO→state, tanpa downgrade ESAI), `QUESTION_OPTION_LABELS` + set `CHOICE_TYPES`/`SCALE_TYPES`/`MANUAL_TYPES`/`STIMULUS_TYPES` di `src/lib/quiz-builder.ts`.
- `quiz-builder.tsx`: **1657 → 398 baris** (±76% lebih pendek), tanpa perubahan perilaku.

**E2E sudah ditambahkan**
- `tests/e2e/form-builder-editors.spec.ts` — 2/2 hijau: skala, urutan, menjodohkan, tabel, cloze, unggah berkas, rubrik, metadata.
- `tests/e2e/form-builder-sections.spec.ts` — **3/3 hijau**: pengelola bagian (tambah/ubah/reorder/hapus + munculnya "Bagian soal ini"), modal **Bank soal** (cari + tambahkan soal lama ke formulir), dan dialog **Impor soal** (muat daftar soal dari formulir sumber).

**Status: selesai.** Seluruh tahap ekstraksi kit builder (1–8) tuntas; tidak ada langkah lanjutan wajib. Backlog opsional: pindahkan juga state UI yang tersisa (tab, pratinjau, pencarian soal, drag) ke hook bila kelak ingin builder lebih tipis lagi.

**Catatan (1 Okt 2026):** alur modal bank soal/impor selesai — dua test `fixme` di `form-builder-sections.spec.ts` kini hijau (3/3). Akar masalah: (a) hasil pertama pencarian bank soal adalah soal yang baru dibuat (urut `createdAt desc`) sehingga penambahan dianggap duplikat → test diperbaiki dengan mencari soal seed; (b) `/guru/kuis/baru` tidak mengirim `importOptions`, sehingga bagian impor tidak muncul sampai halaman di-reload → halaman buat kini memuat `listUjian` dan mengirim `importOptions`, jadi impor langsung tersedia di alur buat. Verifikasi: `typecheck` ✓ · `lint` 0 error ✓ · e2e `form-builder-sections` 3/3 ✓.
**Ekstraksi tahap 7 selesai (1 Okt 2026):** `QuestionSectionManager` (blok "Bagian (section)": drag + ubah/urut/hapus) dan `BankSoalPicker` + `ImportQuestions` (pemilih bank soal & dialog impor — state, panggilan API, dan reload dipindah ke komponen) keluar dari `quiz-builder.tsx`. `quiz-builder.tsx` **1172 → 952 baris**. Verifikasi: `typecheck` ✓ · `lint` 0 error ✓ · `npm test` 43 ✓ · e2e `form-builder-sections` 3/3 ✓ · e2e `form-builder-editors` 2/2 ✓ · e2e `quiz-builder` 2/2 ✓.
**Ekstraksi tahap 8 selesai (1 Okt 2026):** hook `useFormBuilder` (`src/components/dashboard/use-form-builder.ts`, 673 baris) mengambil alih form, save/publish, autosave, history/undo-redo + shortcut, `toPayload`, `validate`, serta semua mutasi soal/opsi/bagian/cabang. State UI sisa (tab, pratinjau, pencarian, drag) tetap di komponen. `quiz-builder.tsx` **952 → 398 baris** (dari 1657, ±76% lebih pendek), tanpa perubahan perilaku. Verifikasi: `typecheck` ✓ · `lint` 0 error ✓ · `npm test` 43 ✓ · e2e `quiz-builder` 2/2 ✓ · e2e `form-builder-editors` 2/2 ✓ · e2e `form-builder-sections` 3/3 ✓.

**Perintah verifikasi rutin**
`npm run typecheck` · `npm run lint` · `npm test` · `npm run test:guards` · `E2E_SPEC=<spec> npm run test:e2e` · `npm run test:quiz-builder` (butuh dev server `NODE_ENV=development`).

**Catatan**: `masalah/` (screenshot pengguna) sengaja dibiarkan untracked, tidak pernah ikut commit.
