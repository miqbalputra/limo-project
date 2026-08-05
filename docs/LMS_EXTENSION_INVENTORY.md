# LMS Extension Inventory

Dokumen ini adalah hasil audit Step 0.1 dari `rencana.md`. Bagian inventaris dasar mencatat kondisi source code sebelum Fase 1; perubahan setelah audit dirangkum pada bagian gap dan kesimpulan. Dokumen ini tidak mengubah perilaku aplikasi.

## 1. Runtime dan Arsitektur

- Framework: Next.js 16 App Router.
- UI: React 19, TypeScript strict, Tailwind CSS 4, pola komponen TailAdmin.
- Runtime: Node.js 22 atau lebih baru.
- ORM: Prisma 6.
- Database production: MariaDB 11 melalui provider MySQL pada `prisma/schema.prisma`.
- Database development/test lokal: SQLite melalui schema turunan `prisma/schema.sqlite.prisma`.
- API: Route Handler Next.js di `src/app/api/**/route.ts` dengan prefix utama `/api/v1`.
- Validasi: Zod pada server.
- Error API: `apiOk` dan `apiError` dengan request ID.
- Waktu operasional: helper timezone `Asia/Jakarta` pada `src/server/time/jakarta.ts`.
- Layer server-only: service, DAL, policy, provider, dan database tidak boleh diimpor ke client component.

File konfigurasi utama:

- `package.json`
- `tsconfig.json`
- `next.config.ts`
- `src/server/env.ts`
- `src/server/db/prisma.ts`
- `src/server/README.md`

## 2. Model Database Existing

### 2.1 Identitas dan Role

`UserRole` saat ini hanya memiliki:

- `ADMIN`
- `GURU`
- `WALI`

Model yang tersedia:

- `User`: email, password hash, role, status, login timestamp, session, reset token, profile Guru/Wali, dan relasi audit.
- `GuruProfile`: profile satu-ke-satu dengan User dan pemilik kelas.
- `WaliProfile`: profile satu-ke-satu dengan User, relasi Wali-Siswa, dan actor pada online exam lama.
- `Session`: token opaque yang disimpan sebagai hash, expiry, idle tracking, dan revocation.
- `PasswordResetToken`: token reset password dengan masa berlaku.
- `AuditLog`: actor, action, entity, entity ID, reason, metadata, IP, dan timestamp.

Belum tersedia:

- Role `SISWA`.
- `SiswaProfile`.
- Relasi `User` ke `Siswa`.
- `studentId`, status aktivasi akun, `activatedAt`, `activatedBy`, dan `lastLoginAt` untuk akun siswa.
- Tabel relasi akun siswa yang menjamin satu siswa tidak memiliki lebih dari satu user aktif.

### 2.2 Siswa, Wali, Kelas, dan Enrollment

- `Siswa`: biodata, nomor induk, status, program, Wali, enrollment, presensi, progres, hasil ujian, attempt, dan tagihan.
- `WaliSiswa`: relasi Wali-Siswa, primary flag, dan `endedAt`.
- `Kelas`: program, level, Guru pengampu, enrollment, sesi, materi, RPP, bank soal, dan ujian.
- `KelasSiswa`: enrollment dengan status `ACTIVE`, `TRANSFERRED`, `COMPLETED`, dan `CANCELLED`, tanggal mulai/selesai, serta histori transfer.
- `SesiKelas`: nomor pertemuan, topik, tanggal, status, materi, presensi, dan progres.

Catatan enrollment: unique constraint existing mencakup `startDate`, sehingga database belum secara independen menjamin hanya ada satu enrollment aktif untuk satu siswa pada satu waktu. Service existing menangani alur transfer, tetapi aturan ini perlu dipertahankan saat pengembangan akun Siswa.

### 2.3 Pembelajaran, Presensi, dan Progres

- `Materi`: materi flat berbasis kelas atau sesi, tipe `TEXT`, `PDF`, `IMAGE`, `VIDEO_LINK`, status publish, isi, URL video, bahasa, arah materi, urutan, dan file.
- `Presensi`: satu record per siswa dan sesi, dengan status kehadiran serta catatan.
- `ProgresBelajar`: skor pemahaman 1-5, kategori, catatan publik, catatan internal, dan unique key siswa-sesi-kategori.
- `FileAsset`: metadata file privat, owner type, owner ID, path, MIME type, ukuran, checksum, visibility, uploader, dan soft delete.

`FileOwnerType` saat ini memiliki `PENDAFTARAN`, `MATERI`, `USER`, `SISWA`, dan `RPP`. Relasi Prisma aktif tersedia untuk pendaftaran, materi, dan RPP.

### 2.4 Ujian dan Attempt

- `BankSoal`: bank pertanyaan dan metadata pedagogis.
- `OpsiSoal`: opsi terstruktur dan kunci jawaban.
- `Ujian`: ujian per kelas, mode delivery, tanggal, durasi, dan status.
- `UjianSoal`: relasi ujian dengan soal dan bobot.
- `HasilUjian`: hasil per siswa dan ujian, status `DRAFT`, `NEEDS_REVIEW`, `FINAL`, atau `CORRECTED`, skor, dan jawaban.
- `JawabanUjian`: jawaban objektif, teks, structured answer, dan skor.
- `UjianAttempt`: attempt online dengan ujian, siswa, Wali, expiry, autosaved JSON answers, dan optional hasil ujian.

Tipe soal existing sudah mencakup pilihan ganda, multi-select, benar-salah, isian singkat, cloze, menjodohkan, urutan, gambar, listening, reading, speaking, writing, roleplay, dan esai.

Gap penting untuk rencana baru:

- `UjianAttempt` belum memiliki `actorUserId`.
- `UjianAttempt.waliProfileId` masih wajib.
- Belum ada nomor attempt yang immutable.
- `hasilUjianId` belum memiliki relasi Prisma atau foreign key yang dinyatakan.
- Online exam saat ini menggunakan Wali sebagai actor authenticated.
- Unique `(ujianId, siswaId)` pada `HasilUjian` belum cocok untuk histori submission/attempt yang benar-benar immutable.

### 2.5 Notifikasi dan Job

- `Notifikasi`: channel, template, recipient string, body, status, metadata, dedupe key, dan read timestamp.
- `NotificationDelivery`: provider, jumlah attempt, status delivery, response, dan error.
- `JobRun`: status job background, jumlah berhasil/gagal, dan timestamp.

Belum tersedia:

- Foreign key notifikasi ke User.
- Domain event atau outbox table.
- Event modul dan tugas baru.
- Reminder deadline H-3, H-1, saat deadline, dan setelah terlambat.
- Event publikasi laporan periodik.

## 3. Authentication, Session, dan Role

Implementasi autentikasi menggunakan custom email/password, bukan NextAuth/Auth.js.

File utama:

- `src/server/auth/session.ts`
- `src/server/auth/password.ts`
- `src/server/auth/password-reset.ts`
- `src/server/services/auth-service.ts`
- `src/proxy.ts`

Perilaku existing:

- Token session dibuat opaque secara acak.
- Database hanya menyimpan hash token session.
- Cookie session bersifat HTTP-only.
- Absolute expiry dan idle timeout dikonfigurasi melalui environment.
- `getCurrentActor`, `requireActor`, dan `requireRole` memeriksa user aktif, tidak dihapus, dan role.
- Proxy hanya melakukan pemeriksaan awal cookie pada `/admin`, `/guru`, dan `/wali`.
- Validasi role dan kepemilikan dilakukan kembali pada page, route, service, dan policy.
- Login saat ini hanya menerima email, bukan username atau nomor induk.
- `people-service.ts` sudah dapat membuat akun Guru/Wali dengan activation/reset notification, tetapi pembuatan siswa hanya membuat record `Siswa` tanpa akun login.


## 4. Access Policy

Policy terpusat berada di `src/server/policies/access-policy.ts`.

- `canManageUsers`: Admin only.
- `canAccessStudent`: Admin semua siswa; Guru melalui enrollment aktif di kelas yang dikelola; Wali melalui relasi Wali-Siswa aktif.
- `canManageClass`: Admin semua kelas; Guru hanya kelas aktif yang ditugaskan.
- `canAccessInvoice`: Admin atau Wali yang terhubung dengan siswa.
- `canDownloadFile`: Admin; Guru untuk file kelas yang dikelola; Wali untuk file materi/RPP published dari kelas yang diikuti anaknya.
- `hasRole`: pengecekan role sederhana.

Pemilihan anak Wali memakai:

- `src/server/dal/wali-selector-dal.ts`
- `src/components/dashboard/wali-child-selector.tsx`



Belum ada branch policy untuk `SISWA`; actor Siswa baru akan ditolak sampai policy baru ditambahkan.

## 5. Service dan DAL yang Harus Digunakan Kembali

Jangan membuat service duplikat ketika fungsi berikut sudah relevan:

- `src/server/services/auth-service.ts`: login, reset, perubahan password, status user, dan pencabutan session.
- `src/server/services/people-service.ts`: CRUD Siswa, relasi Wali, transfer enrollment, dan akun Guru/Wali.
- `src/server/services/lms-service.ts`: kelas Guru, sesi, jadwal, materi, duplikasi sesi, dan lifecycle materi.
- `src/server/services/attendance-progress-service.ts`: roster aktif, upsert presensi/progres, dan finalisasi sesi.
- `src/server/services/exam-service.ts`: bank soal, builder ujian, input hasil Guru, scoring, koreksi, dan audit.
- `src/server/services/online-exam-service.ts`: compatibility adapter untuk online exam lama berbasis Wali; tidak boleh disalin mentah untuk alur Siswa.
- `src/server/services/report-service.ts`: ringkasan siswa/kelas, histori ujian Wali, dan laporan operasional Admin.
- `src/server/services/wali-materi-service.ts`: scoping materi published untuk Wali.
- `src/server/services/rpp-service.ts`: scoping RPP dan authorized Wali access.
- `src/server/dal/actor-dal.ts`: dashboard role dan agenda Guru.
- `src/server/services/notification-service.ts`: pembuatan notifikasi, deduplikasi, dan trigger domain existing.
- `src/server/services/job-service.ts`: retry delivery dan tracking job.
- `src/server/pagination.ts`: pagination standard.
- `src/server/http/api-response.ts`: format response API.
- `src/server/errors/application-error.ts`: error domain.
- `src/server/validation/*.ts`: pola validasi Zod.
- `src/server/providers/storage/local-storage.ts`: private storage dan validasi file.


## 6. API Existing

Konvensi route API:

- Berada di `src/app/api`.
- Prefix utama `/api/v1`.
- Menggunakan `apiOk`/`apiError`.
- Menyertakan request ID.
- Mutation memakai same-origin validation.
- Input divalidasi server-side.
- Authorization dijalankan oleh service atau policy.


Kelompok route yang sudah tersedia:

- **Auth**: login, logout, current actor, forgot password, reset password, change password.
- **Pendaftaran**: submit pendaftaran, status lookup, upload dokumen.
- **Admin**: review/approve/reject pendaftaran, CRUD/restore/transfer/export Siswa, link Wali, CRUD Guru/Wali, user status, revoke session, Program, Level, Kelas, Tarif, generate invoice, payment reconciliation, report CSV, audit CSV.
- **Guru LMS**: daftar kelas, sesi, roster, finalisasi, duplicate sesi, materi, status materi, upload file materi, create/status RPP.
- **Assessment**: bank soal, ujian, status, duplicate, student roster, hasil, koreksi.
- **Presensi/progres**: `/api/v1/presensi` dan `/api/v1/progres`.
- **Online exam Wali**: start attempt, autosave draft, submit attempt.
- **File Wali**: authorized material/RPP file access.
- **Billing**: daftar/detail invoice dan create payment.
- **Notifications**: mark notification as read.
- **System**: health, readiness, Mayar webhook, dan internal backup.


Route directories utama:

- `src/app/api/v1/auth/`
- `src/app/api/v1/admin/`
- `src/app/api/v1/guru/`
- `src/app/api/v1/wali/`
- `src/app/api/v1/hasil-ujian/`
- `src/app/api/v1/bank-soal/`
- `src/app/api/v1/ujian/`
- `src/app/api/v1/presensi/`
- `src/app/api/v1/progres/`
- `src/app/api/v1/files/`


Belum ada route untuk:

- `/api/v1/siswa/*`
- Modul pembelajaran.
- Assignment dan submission.
- Gradebook.
- Activity completion.
- Remedial.
- Announcement dan discussion.
- Periodic progress report.




## 7. Dashboard dan UI Existing

### Admin

- `/admin/pendaftaran`
- `/admin/pendaftaran/[id]`
- `/admin/siswa`
- `/admin/siswa/[id]`
- `/admin/wali`
- `/admin/guru`
- `/admin/program`
- `/admin/level`
- `/admin/kelas`
- `/admin/tagihan`
- `/admin/laporan`
- `/admin/users`
- `/admin/audit`



### Guru

- `/guru`
- `/guru/kelas`
- `/guru/kelas/[kelasId]`
- `/guru/kelas/[kelasId]/ringkasan`
- `/guru/jadwal`
- `/guru/materi`
- `/guru/rpp`
- `/guru/bank-soal`
- `/guru/ujian`
- `/guru/ujian/[ujianId]/hasil`
- `/guru/ujian/[ujianId]/hasil/[hasilId]/koreksi`
- `/guru/presensi`
- `/guru/presensi/[sesiKelasId]`
- `/guru/progres`
- `/guru/progres/[sesiKelasId]`



### Wali

- `/wali`
- `/wali/tugas`
- `/wali/tugas/[siswaId]`
- `/wali/tugas/[siswaId]/ujian/[ujianId]`
- `/wali/tugas/attempt/[attemptId]`
- `/wali/materi`
- `/wali/rpp`
- `/wali/progres`
- `/wali/progres/[siswaId]`
- `/wali/presensi`
- `/wali/nilai`
- `/wali/tagihan`
- `/wali/tagihan/success`
- `/wali/profil`
- `/wali/bantuan`

Belum ada `/siswa`, `/siswa/kelas`, `/siswa/profil`, atau halaman Admin untuk akun siswa.





## 8. Private Storage dan Authorized Download

Implementasi utama berada di `src/server/providers/storage/local-storage.ts`.

- Root storage berasal dari `PRIVATE_STORAGE_PATH` dan berada di luar `public/`.
- Nama penyimpanan menggunakan UUID acak.
- Nama file asli disanitasi.
- File menyimpan MIME type, ukuran, checksum SHA-256, dan storage path.
- Extension dan MIME type divalidasi.
- Magic bytes diperiksa untuk tipe file yang didukung.
- Path traversal dicegah saat membaca atau menghapus file.
- Download generic memakai `src/server/services/file-service.ts` dan `/api/v1/files/[id]`.
- Wali memiliki route khusus untuk file materi dan RPP.
- File materi yang tersedia: PDF, JPEG, PNG.
- File RPP yang tersedia: PDF, DOC, DOCX.


Gap untuk fase tugas dan speaking:

- File dibaca penuh ke memory, belum streaming atau range serving.
- Belum ada allowlist audio/video submission.
- Belum ada antivirus atau malware scan.
- Belum ada orphan draft file cleanup.
- Belum ada relasi `SubmissionFile`.
- Belum ada feedback audio storage.



## 9. Notifikasi dan Event

Service utama:

- `src/server/services/notification-service.ts`
- `src/server/services/job-service.ts`
- `src/server/providers/notification/notifier.ts`


Fungsi yang dapat digunakan kembali:

- `notifyWaliForStudents`
- `notifyAdmins`
- `syncGuruPendingNotifications`
- `retryPendingNotifications`


Event existing:

- Aktivasi akun.
- Reset password.
- Approval/rejection pendaftaran.
- Pembayaran.
- Publikasi RPP.
- Publikasi ujian online.
- Perubahan hasil ujian.
- Penyimpanan progres.
- Pekerjaan Guru yang masih tertunda.


Pola existing:

- Domain service langsung membuat record `Notifikasi`.
- `dedupeKey` dan unique constraint digunakan untuk idempotency dasar.
- Delivery eksternal dijalankan oleh retry job, bukan menghambat transaction utama.
- Provider tersedia untuk console, SMTP email, n8n email/WhatsApp, dan in-app.


Belum tersedia:

- Outbox/domain-event table.
- Relasi notifikasi langsung ke User.
- Event modul, tugas, deadline, remedial, announcement, dan laporan periodik.
- Reminder H-3, H-1, deadline, dan overdue.



## 10. Komponen UI yang Dapat Digunakan Kembali

Komponen dasar dashboard:

- `src/components/dashboard/dashboard-shell.tsx`
- `src/components/dashboard/dashboard-widgets.tsx`
  - `DashboardHero`
  - `MetricCard`
  - `QuickActionCard`
  - `SectionHeader`
  - `EmptyState`
  - `ProgressBar`
- `src/components/dashboard/pagination-controls.tsx`
- `src/components/dashboard/form-field-error.tsx`
- `src/components/dashboard/dashboard-icon.tsx`
- `src/components/dashboard/wali-child-selector.tsx`


Komponen domain existing:

- `lms-forms.tsx`
- `attendance-progress-forms.tsx`
- `bank-soal-form.tsx`
- `ujian-form.tsx`
- `hasil-ujian-form.tsx`
- `online-exam-player.tsx`
- `rpp-form.tsx`
- `billing-forms.tsx`
- `student-management-forms.tsx`
- Komponen status dan duplicate action.
- Komponen overview Guru.

Tidak ada library komponen terpisah yang sudah diterapkan di `src/components/ui/`. Utility class TailAdmin berada di `src/app/globals.css`.




## 11. Test dan Quality Command

Command pada `package.json`:

- `npm test`: unit test `tests/run-unit.mjs`.
- `npm run test:week1`: integration test auth, pendaftaran, Admin, dan scoping dasar.
- `npm run test:week2`: integration test LMS, bank soal, ujian, hasil, dan lifecycle Guru.
- `npm run test:week3`: integration test presensi, progres, laporan, billing, notifikasi, dan backup.
- `npm run test:e2e`: Playwright pada `tests/e2e/`.
- `npm run typecheck`.
- `npm run lint`.
- `npm run build`.
- `npm run sqlite:setup`.
- `npm run prisma:migrate`.



Playwright berada di `playwright.config.ts`, menggunakan Chromium dan reuse existing server. Test mobile dilakukan melalui viewport di spec existing.

Kondisi test repository:

- `tests/unit/` hanya berisi `.gitkeep`.
- `tests/integration/` hanya berisi `.gitkeep`.
- Vitest tersedia di dependency, tetapi belum memiliki script atau file test aktif.
- Belum ada test untuk Siswa, assignment, modul, gradebook, completion, remedial, discussion, announcement, atau laporan periodik.




## 12. Feature Flag dan Konfigurasi

Pada audit awal Step 0.1 belum ada mekanisme feature flag. Step 0.3 menambahkan resolver feature flag terpusat pada `src/server/features/feature-flags.ts`.

Konfigurasi existing berada di:

- `src/server/env.ts`
- `.env.example`
- `.env.dokploy.example`



Flag yang dibutuhkan oleh `rencana.md`:

- `studentPortalEnabled`
- `learningModulesEnabled`
- `assignmentsEnabled`
- `gradebookEnabled`
- `classDiscussionEnabled`
- `periodicReportsEnabled`
- `guardianAssistedSubmissionEnabled`

Mapping environment menggunakan uppercase snake case, misalnya `STUDENT_PORTAL_ENABLED`. Default development/test aktif untuk fitur utama agar dapat dikembangkan bertahap, sedangkan default production nonaktif sampai UAT fase terkait selesai. `GUARDIAN_ASSISTED_SUBMISSION_ENABLED` default selalu nonaktif.

Catatan implementasi: flag hanya mengontrol ketersediaan UI/fitur dan tidak menggantikan authorization server-side.



























## 13. Gap terhadap Fase 1-10

### Fase 1: Role, Akun, dan Dashboard Siswa

Implemented. Fase 1 sudah menambahkan role `SISWA`, model `SiswaAccount`, login menggunakan email atau nomor induk, aktivasi melalui reset password, dashboard `/siswa`, API profile/dashboard/kelas, policy own-record, navigasi, akun demo, dan pengelolaan akun oleh Admin. Online exam lama tetap menggunakan Wali sebagai actor; submission sebagai Siswa masuk fase assignment berikutnya.

### Fase 2: Modul Pembelajaran Terstruktur

Implemented. `LearningModule` dan `ModuleItem` sekarang menjadi extension additive di atas `Kelas`, `Materi`, `SesiKelas`, dan `Ujian`. Guru memiliki builder untuk membuat, mengedit, mengurutkan item, publish/schedule, archive, dan duplicate. Siswa hanya menerima modul published yang sudah release; Wali menerima struktur read-only untuk anak yang terhubung. Assignment, quiz, discussion, completion, dan tombol aktivitas baru tetap menjadi gap fase berikutnya.

### Fase 3: Tugas Online dan Submission

Implemented. `Assignment`, `AssignmentSubmission`, dan `AssignmentSubmissionFile` sekarang menyediakan tugas terpisah dari ujian, autosave draft berversi, attempt historis, submission teks/link/file, late/cutoff enforcement, private file authorization, dan monitoring Wali read-only. `/wali/tugas` lama tetap berfokus pada online exam; assignment baru memiliki route kontekstual di progres anak.

### Fase 4: Rekaman Speaking, Rubrik, dan Feedback

Tipe soal speaking dan field rubrik JSON sudah ada, tetapi belum ada template rubrik reusable, recording UI, audio/video submission, feedback record, atau workflow publikasi feedback.

### Fase 5: Gradebook Terpadu

Belum ada `GradeCategory`, `GradeItem`, `GradeEntry`, atau `FinalGrade`. Nilai ujian, presensi, dan progres masih diagregasikan melalui report service tanpa buku nilai terpadu.

### Fase 6: Kalender, To-do, dan Pengingat

`SesiKelas.sessionDate` dan `/guru/jadwal` sudah ada, tetapi belum ada kalender lintas role, derived event service, to-do service terpadu, atau scheduled deadline reminder.

### Fase 7: Activity Completion dan Progres

Belum ada completion rule, activity completion, module progress, checklist, source event, atau recalculation. `ProgresBelajar` merupakan catatan pemahaman Guru, bukan completion aktivitas.

### Fase 8: Remedial dan Revisi

Belum ada model remedial, participant, score policy, flow assignment remedial, kalender remedial, atau UI. Koreksi ujian existing bukan pengganti sistem remedial.

### Fase 9: Pengumuman dan Ruang Tanya Jawab

Belum ada announcement, read receipt, discussion thread/reply, moderasi, content report, atau attachment diskusi.

### Fase 10: Laporan Perkembangan Berkala

Laporan operasional Admin, CSV, dan ringkasan Wali sudah ada, tetapi belum ada `ProgressReport`, snapshot versioning, workflow narasi Guru, publikasi laporan, read tracking, atau PDF laporan periodik terotorisasi.

Risiko lintas fase terbesar adalah kompatibilitas histori online exam lama. Data attempt lama harus tetap diperlakukan sebagai attempt yang dibuat oleh Wali, sedangkan attempt baru dari portal Siswa perlu memiliki actor Siswa tanpa menghapus atau mengubah histori lama.

## 14. Kesimpulan Step 0.1

Basis existing sudah memiliki fondasi kuat untuk authorization, kelas, materi, presensi, progres, ujian, notifikasi, file privat, audit, dan testing. Pengembangan berikutnya harus bersifat extension, bukan rebuild.

Urutan implementasi yang aman berikutnya adalah:

1. Menyusun modul pembelajaran terstruktur.
2. Menambahkan assignment dan submission Siswa.
3. Menambahkan actor Siswa pada alur tugas dan evaluasi baru tanpa mengubah histori ujian Wali.
4. Melanjutkan rubrik, gradebook, kalender, completion, remedial, diskusi, dan laporan periodik.

Step 0.2 telah dicatat pada `docs/LMS_EXTENSION_BASELINE.md` dan seluruh baseline gate lulus. Step 0.3 dan Fase 1-3 sudah diterapkan. Langkah berikutnya adalah Fase 4 recording, rubrik, dan feedback.
