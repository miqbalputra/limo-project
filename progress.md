# Progress Implementasi LIMO

Terakhir diperbarui: 26 September 2026

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
