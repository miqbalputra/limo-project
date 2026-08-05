# Rencana Implementasi Pengembangan LMS LIMO

## 1. Tujuan Dokumen

Dokumen ini menjadi instruksi implementasi bertahap untuk aplikasi vibe coding yang akan mengembangkan LIMO. Fokus pengembangan hanya pada fitur baru yang memberikan manfaat langsung kepada Guru, Siswa, dan Wali:

1. Akun dan dashboard Siswa.
2. Modul pembelajaran terstruktur.
3. Tugas online dan pengumpulan jawaban.
4. Rekaman speaking dan pronunciation.
5. Rubrik serta feedback pembelajaran.
6. Gradebook atau buku nilai terpadu.
7. Kalender dan daftar pekerjaan.
8. Pelacakan penyelesaian aktivitas.
9. Remedial dan revisi.
10. Pengumuman dan ruang tanya jawab kelas.
11. Laporan perkembangan berkala.

Pengembangan harus melanjutkan aplikasi yang sudah tersedia. Jangan membangun ulang modul pendaftaran, kelas, materi, presensi, progres, ujian, billing, notifikasi, audit, keamanan, backup, atau role yang sudah berjalan.

## 2. Cara Menggunakan Dokumen Ini

Instruksi untuk aplikasi vibe coding:

1. Baca seluruh dokumen sebelum mengubah kode.
2. Inspeksi source code, skema database, middleware autentikasi, service, policy, route, dan pola UI yang sudah ada.
3. Cocokkan nama model, tabel, enum, service, dan route di dokumen ini dengan konvensi project yang sebenarnya.
4. Jangan membuat model atau service duplikat jika fungsi serupa sudah tersedia.
5. Kerjakan satu fase dalam satu waktu sesuai urutan.
6. Setelah satu fase selesai, jalankan migration, unit test, integration test, E2E, typecheck, lint, dan production build.
7. Jangan melanjutkan ke fase berikutnya apabila acceptance criteria fase aktif belum terpenuhi.
8. Semua perubahan database harus backward-compatible dan menggunakan migration baru. Jangan mengubah migration lama yang sudah pernah dijalankan.
9. Pertahankan seluruh data, URL, dan alur lama selama tidak bertentangan dengan kebutuhan baru.
10. Catat keputusan teknis, perubahan skema, endpoint, dan keterbatasan baru dalam dokumentasi project.

## 3. Prinsip Implementasi

### 3.1 Prinsip produk

- Siswa menjadi pelaku utama aktivitas belajar.
- Wali menjadi observer yang memantau, bukan pelaku ujian atau tugas siswa.
- Guru hanya mengelola kelas yang diampu.
- Setiap halaman harus menunjukkan tindakan berikutnya yang perlu dilakukan pengguna.
- Fitur harus tetap mudah digunakan melalui ponsel.
- Pengembangan tidak boleh menambah pekerjaan administrasi Guru secara berlebihan.

### 3.2 Prinsip teknis

- Gunakan pola arsitektur, ORM, validasi, error response, pagination, audit, dan testing yang sudah digunakan project.
- Validasi input dilakukan di server, bukan hanya di form.
- Pemeriksaan role dan kepemilikan data dilakukan di service atau policy server.
- File disimpan di private storage dan hanya diakses melalui authorized route.
- Mutation harus idempoten apabila berpotensi dikirim ulang.
- Semua tanggal disimpan secara konsisten dan ditampilkan menggunakan timezone `Asia/Jakarta`.
- Gunakan transaksi database untuk perubahan yang menyentuh beberapa tabel penting.
- Setiap perubahan status akademik penting harus menghasilkan audit log.
- Daftar data besar wajib memiliki pagination, pencarian, filter, loading, error, dan empty state.

### 3.3 Non-goals

Jangan mengembangkan fitur berikut pada rencana ini:

- AI untuk menilai jawaban otomatis.
- Proctoring melalui kamera.
- Leaderboard atau kompetisi antarsiswa.
- Chat pribadi bebas antara Guru dan Siswa.
- Integrasi SCORM, H5P, LTI, atau xAPI.
- Aplikasi mobile native.
- Perubahan besar pada billing dan payment gateway.

## 4. Persiapan Sebelum Pengembangan

### Step 0.1 — Audit source code

Lakukan inventarisasi berikut:

- Framework dan versi yang digunakan.
- ORM dan skema database.
- Struktur modul autentikasi dan session.
- Implementasi role `ADMIN`, `GURU`, dan `WALI`.
- Model siswa, Wali, kelas, enrollment, materi, sesi kelas, ujian, hasil ujian, progres, presensi, notifikasi, dan audit.
- Cara private storage dan authorized download bekerja.
- Cara event notifikasi dibuat dan dikirim.
- Komponen UI yang dapat digunakan kembali.
- Struktur unit, integration, dan E2E test.

Output step ini:

- Buat `docs/LMS_EXTENSION_INVENTORY.md`.
- Tuliskan model dan service yang akan digunakan kembali.
- Tuliskan konflik atau gap antara dokumen ini dan implementasi aktual.
- Jangan mengubah perilaku aplikasi pada step ini.

### Step 0.2 — Buat baseline pengujian

- Jalankan seluruh test yang sudah ada.
- Jalankan typecheck, lint, dan production build.
- Simpan hasil baseline pada catatan implementasi.
- Jika ada test lama yang gagal, dokumentasikan terlebih dahulu. Jangan menyamarkan kegagalan lama sebagai akibat fitur baru.

### Step 0.3 — Siapkan feature flag

Tambahkan feature flag sesuai mekanisme konfigurasi project:

- `studentPortalEnabled`
- `learningModulesEnabled`
- `assignmentsEnabled`
- `gradebookEnabled`
- `classDiscussionEnabled`
- `periodicReportsEnabled`

Ketentuan:

- Default development dan staging dapat diaktifkan bertahap.
- Default production harus tetap nonaktif sampai UAT fase terkait selesai.
- Feature flag hanya mengontrol ketersediaan fitur, bukan menggantikan authorization.

---

# FASE 1 — Role, Akun, dan Dashboard Siswa

## 5. Tujuan Fase 1

Menyediakan akun Siswa yang terhubung ke data siswa existing. Siswa dapat login dan melihat data akademiknya sendiri. Wali tetap dapat memantau anak yang terhubung.

## 6. Perubahan Data Fase 1

Sesuaikan nama dengan skema project. Jangan menduplikasi data biodata siswa ke tabel user.

### 6.1 User dan role

- Tambahkan role `SISWA` pada enum role existing.
- Hubungkan satu user siswa ke satu record siswa.
- Pastikan satu record siswa tidak dapat terhubung dengan lebih dari satu user aktif.
- Hubungan Wali–Siswa existing tetap dipertahankan.

Field tambahan yang disarankan pada hubungan akun siswa:

- `studentId`
- `userId`
- `activatedAt`
- `activatedBy`
- `status`
- `lastLoginAt`

Gunakan tabel relasi bila arsitektur existing tidak mengizinkan foreign key langsung pada `User`.

### 6.2 Migrasi data

- Jangan otomatis membuat akun untuk semua siswa tanpa tindakan Admin.
- Admin dapat membuat akun per siswa atau secara massal.
- Buat validasi agar email/username tidak duplikat.
- Untuk siswa yang belum memiliki email, dukung username atau nomor induk sesuai kemampuan autentikasi existing.
- Jika login existing hanya mendukung email, tambahkan identifier login secara backward-compatible tanpa merusak login Guru, Wali, dan Admin.

## 7. Authorization Fase 1

Tambahkan policy berikut:

- Siswa hanya dapat membaca profil miliknya.
- Siswa hanya dapat melihat kelas dengan enrollment aktif miliknya.
- Siswa hanya dapat melihat materi, tugas, ujian, nilai, progres, dan presensi miliknya.
- Siswa tidak boleh menggunakan parameter `studentId` untuk membuka data siswa lain.
- Wali tetap hanya dapat membuka data anak yang memiliki relasi Wali–Siswa aktif.
- Guru tetap dibatasi pada kelas yang diampu.
- Akun siswa nonaktif atau siswa tanpa enrollment aktif tidak dapat mengakses aktivitas kelas.

Tambahkan integration test untuk setiap policy. Jangan hanya menguji menu tersembunyi.

## 8. API dan Service Fase 1

Gunakan prefix API existing. Endpoint konseptual:

- `GET /api/v1/siswa/me`
- `GET /api/v1/siswa/dashboard`
- `GET /api/v1/siswa/kelas`
- `GET /api/v1/siswa/kelas/:kelasId`
- `POST /api/v1/admin/siswa/:studentId/akun`
- `POST /api/v1/admin/siswa/:studentId/akun/kirim-aktivasi`
- `PATCH /api/v1/admin/siswa/:studentId/akun/status`

Dashboard siswa minimal mengembalikan:

- Profil ringkas siswa.
- Kelas aktif.
- Jadwal terdekat.
- Materi terbaru.
- Tugas yang perlu dikerjakan.
- Ujian yang tersedia.
- Nilai/feedback terbaru.
- Notifikasi belum dibaca.

Hindari query N+1. Batasi jumlah item dashboard dan sediakan link ke halaman daftar lengkap.

## 9. UI Fase 1

Halaman minimal:

- `/siswa`
- `/siswa/kelas`
- `/siswa/kelas/[kelasId]`
- `/siswa/profil`
- `/admin/siswa/[id]/akun`

Dashboard siswa harus mobile-first dan menampilkan:

1. Salam dan kelas aktif.
2. Kegiatan hari ini.
3. Lanjutkan belajar.
4. Tugas mendekati tenggat.
5. Nilai atau feedback terbaru.
6. Notifikasi.

## 10. Audit dan Notifikasi Fase 1

Catat:

- Pembuatan akun siswa.
- Aktivasi dan penonaktifan akun.
- Pengiriman ulang aktivasi.
- Login dan perubahan password.
- Pencabutan sesi siswa.

Kirim notifikasi aktivasi ke kanal yang tersedia. Jangan mengirim password mentah. Gunakan token aktivasi atau reset password dengan masa berlaku.

## 11. Acceptance Criteria Fase 1

- Siswa dapat login dan masuk ke dashboard siswa.
- Siswa hanya melihat data miliknya.
- Siswa tidak dapat mengakses route Guru, Wali, atau Admin.
- Wali masih dapat melihat data seluruh anak yang terhubung.
- Guru dan Admin existing tidak mengalami regresi.
- Admin dapat membuat, mengaktifkan, menonaktifkan, dan mencabut sesi akun siswa.
- Seluruh policy memiliki integration test.
- E2E mencakup login siswa dan percobaan akses data siswa lain.

---

# FASE 2 — Modul Pembelajaran Terstruktur

## 12. Tujuan Fase 2

Mengubah daftar materi menjadi alur belajar berdasarkan modul, minggu, pertemuan, atau topik tanpa menghapus materi existing.

## 13. Model Data Fase 2

Model konseptual:

### 13.1 LearningModule

- `id`
- `classId`
- `title`
- `description`
- `order`
- `status`: `DRAFT`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`
- `releaseAt`
- `dueAt` opsional
- `createdBy`
- `publishedAt`
- timestamps

### 13.2 ModuleItem

- `id`
- `moduleId`
- `itemType`: `MATERIAL`, `ASSIGNMENT`, `QUIZ`, `EXAM`, `DISCUSSION`, `CLASS_SESSION`
- `entityId`
- `titleOverride` opsional
- `order`
- `isRequired`
- `availableFrom` opsional
- `availableUntil` opsional
- `prerequisiteItemId` opsional
- timestamps

Ketentuan:

- Gunakan referensi polymorphic hanya jika sesuai dengan pola project. Jika tidak, gunakan tabel relasi eksplisit.
- Satu entity tidak boleh terpasang dua kali pada modul yang sama tanpa alasan yang jelas.
- Perubahan urutan harus menggunakan transaksi.
- Materi existing tetap dapat diakses. Admin/Guru dapat memasukkannya ke modul secara bertahap.

## 14. Service dan API Fase 2

Fungsi Guru:

- Membuat modul.
- Mengubah modul.
- Mengurutkan modul.
- Menambahkan aktivitas existing atau baru.
- Mengurutkan aktivitas.
- Menjadwalkan publikasi.
- Mempublikasikan, mengarsipkan, dan mengembalikan modul menjadi draft.
- Menggandakan modul.
- Menyalin modul dari kelas lain yang berhak diakses.
- Melihat preview sebagai Siswa.

Endpoint konseptual:

- `GET /api/v1/guru/kelas/:classId/modul`
- `POST /api/v1/guru/kelas/:classId/modul`
- `GET /api/v1/guru/modul/:moduleId`
- `PATCH /api/v1/guru/modul/:moduleId`
- `POST /api/v1/guru/modul/:moduleId/items`
- `PATCH /api/v1/guru/modul/:moduleId/reorder`
- `POST /api/v1/guru/modul/:moduleId/publish`
- `POST /api/v1/guru/modul/:moduleId/archive`
- `POST /api/v1/guru/modul/:moduleId/duplicate`
- `GET /api/v1/siswa/kelas/:classId/modul`
- `GET /api/v1/wali/anak/:studentId/kelas/:classId/modul`

## 15. UI Fase 2

Guru:

- Builder modul dalam detail kelas.
- Drag-and-drop urutan modul dan item.
- Preview tampilan Siswa.
- Indikator draft, scheduled, published, dan archived.
- Konfirmasi sebelum publish atau archive.

Siswa:

- Daftar modul sesuai urutan.
- Status terkunci, tersedia, sedang dikerjakan, dan selesai.
- Tampilan satu aktivitas dan tombol `Sebelumnya`/`Berikutnya`.

Wali:

- Tampilan read-only struktur modul.
- Ringkasan modul yang sudah dan belum diselesaikan anak.

## 16. Aturan Fase 2

- Siswa dan Wali hanya melihat modul `PUBLISHED` yang sudah melewati `releaseAt`.
- Item dengan `availableFrom` di masa depan tidak dapat dibuka.
- Item yang kedaluwarsa tetap dapat terlihat bila dibutuhkan, tetapi aksi submit mengikuti aturan item.
- Prasyarat selalu diverifikasi server-side.
- Arsip modul tidak menghapus completion, nilai, atau submission.
- Perubahan modul yang sudah memiliki aktivitas siswa harus aman dan tercatat dalam audit.

## 17. Acceptance Criteria Fase 2

- Guru dapat menyusun satu kelas menjadi beberapa modul.
- Guru dapat mengubah urutan tanpa kehilangan data.
- Siswa hanya melihat modul published yang tersedia.
- Wali dapat melihat modul anak secara read-only.
- Prasyarat tidak dapat dilewati dengan memanggil API langsung.
- Materi lama tetap dapat dibuka.
- Copy/duplicate tidak menyalin submission atau nilai siswa.

---

# FASE 3 — Tugas Online dan Submission

## 18. Tujuan Fase 3

Menyediakan tugas harian yang terpisah dari ujian dan mendukung jawaban teks, dokumen, foto, audio, video, atau link.

## 19. Model Data Fase 3

### 19.1 Assignment

- `id`
- `classId`
- `title`
- `instructions`
- `submissionType`
- `maxScore`
- `availableFrom`
- `dueAt`
- `cutoffAt`
- `maxAttempts`
- `allowLateSubmission`
- `allowResubmission`
- `status`: `DRAFT`, `PUBLISHED`, `ARCHIVED`
- `createdBy`
- `publishedAt`
- timestamps

Submission type dapat berupa satu atau beberapa tipe:

- `ONLINE_TEXT`
- `FILE`
- `IMAGE`
- `AUDIO`
- `VIDEO`
- `EXTERNAL_LINK`
- `OFFLINE_ACTIVITY`

### 19.2 AssignmentSubmission

- `id`
- `assignmentId`
- `studentId`
- `attemptNumber`
- `status`: `DRAFT`, `SUBMITTED`, `LATE`, `NEEDS_REVISION`, `GRADED`
- `onlineText`
- `externalLink`
- `submittedAt`
- `isLate`
- `actorUserId`
- timestamps

### 19.3 SubmissionFile

- `id`
- `submissionId`
- `storageKey`
- `originalName`
- `mimeType`
- `size`
- `checksum`
- `mediaDuration` opsional
- timestamps

Ketentuan unik:

- Satu siswa hanya memiliki satu attempt aktif per assignment.
- Nomor attempt meningkat dan tidak boleh ditimpa.
- Autosave draft harus idempoten.
- Submission final tidak boleh berubah tanpa membuat revisi/attempt baru.

## 20. Alur Tugas Fase 3

### 20.1 Guru

1. Membuat tugas draft.
2. Menentukan instruksi, tipe jawaban, nilai, waktu, dan attempt.
3. Menambahkan tugas ke modul.
4. Melihat preview.
5. Mempublikasikan tugas.
6. Melihat daftar siswa dan status submission.
7. Membuka submission dan memberi feedback pada fase berikutnya.

### 20.2 Siswa

1. Membuka tugas yang tersedia.
2. Membaca instruksi dan lampiran.
3. Menulis atau mengunggah jawaban.
4. Menyimpan draft otomatis.
5. Melihat validasi file dan status koneksi.
6. Menekan submit dan menyetujui konfirmasi final.
7. Melihat bukti submit dan timestamp.

### 20.3 Wali

- Melihat tugas anak.
- Melihat status belum dikerjakan, draft, submitted, terlambat, perlu revisi, atau dinilai.
- Melihat jawaban dan feedback yang diizinkan.
- Tidak dapat mengubah draft atau menekan submit.

Jika lembaga membutuhkan bantuan Wali untuk anak usia kecil, buat konfigurasi `guardianAssistedSubmissionEnabled`. Default harus `false`. Jika aktif, simpan `actorUserId` agar audit menunjukkan bahwa aksi dilakukan oleh Wali.

## 21. Upload dan Keamanan Fase 3

- Gunakan private storage existing.
- Validasi extension, MIME type, magic bytes, ukuran, dan jumlah file.
- Tambahkan allowlist terpisah per submission type.
- Gunakan nama storage acak, bukan nama file asli.
- Jangan menampilkan storage path ke pengguna.
- Authorized route harus memeriksa Guru pemilik kelas, Siswa pemilik submission, atau Wali yang terhubung.
- Tambahkan antivirus/malware scan bila infrastruktur tersedia; jika belum, dokumentasikan sebagai known limitation.
- Hapus file draft yatim melalui scheduled job setelah retention yang ditentukan.

## 22. Autosave Fase 3

- Autosave menggunakan debounce.
- Tampilkan status `Menyimpan`, `Tersimpan`, atau `Gagal menyimpan`.
- Gunakan version number atau optimistic concurrency untuk mencegah tab lama menimpa data baru.
- Jangan mengubah status menjadi submitted melalui autosave.
- Setelah submit berhasil, UI harus mengambil ulang status dari server.

## 23. Acceptance Criteria Fase 3

- Guru dapat membuat dan mempublikasikan tugas.
- Siswa dapat menyimpan draft dan melanjutkannya setelah reload/login ulang.
- Siswa dapat submit teks atau file sesuai tipe yang diizinkan.
- Wali tidak dapat mengubah submission melalui UI maupun API.
- Tugas terlambat ditandai otomatis berdasarkan waktu server.
- Attempt lama tidak hilang ketika revisi dibuat.
- File tidak dapat diakses tanpa authorization.
- Duplicate submit tidak membuat dua submission final.

---

# FASE 4 — Rekaman Speaking, Rubrik, dan Feedback

## 24. Tujuan Fase 4

Mendukung pembelajaran bahasa melalui rekaman audio/video, rubrik reusable, dan feedback yang jelas.

## 25. Rekaman Speaking

Pengembangan:

- Gunakan browser media recording API dengan fallback upload file.
- Minta permission microphone/camera secara eksplisit.
- Tampilkan durasi maksimum sebelum merekam.
- Siswa dapat start, pause jika didukung, stop, playback, hapus, dan rekam ulang sebelum submit.
- Jangan mengunggah rekaman kosong atau melebihi batas.
- Tampilkan progress upload dan retry yang aman.
- Simpan duration, MIME type, size, dan checksum.
- Sediakan pesan fallback jika browser tidak mendukung recording.

Jangan menambahkan transkripsi atau penilaian AI pada fase ini.

## 26. Model Rubrik dan Feedback

### 26.1 RubricTemplate

- `id`
- `ownerUserId`
- `title`
- `description`
- `scope`: `PRIVATE`, `CLASS`, `INSTITUTION`
- `status`
- timestamps

### 26.2 RubricCriterion

- `id`
- `rubricId`
- `name`
- `description`
- `maxScore`
- `order`

### 26.3 RubricLevel

- `id`
- `criterionId`
- `label`
- `description`
- `score`
- `order`

### 26.4 SubmissionGrade

- `id`
- `submissionId`
- `graderUserId`
- `score`
- `feedbackText`
- `feedbackAudioStorageKey` opsional
- `status`: `DRAFT`, `PUBLISHED`, `REVISED`
- `publishedAt`
- timestamps

### 26.5 CriterionGrade

- `submissionGradeId`
- `criterionId`
- `rubricLevelId` opsional
- `score`
- `comment`

Rubrik yang dipasang ke tugas harus disnapshot agar perubahan template di masa depan tidak mengubah penilaian lama.

## 27. Alur Penilaian

1. Guru membuka daftar submission.
2. Guru memfilter belum dikumpulkan, belum dinilai, terlambat, perlu revisi, atau selesai.
3. Guru membuka jawaban siswa.
4. Guru memutar audio/video tanpa mengunduh jika format didukung.
5. Guru mengisi rubrik, skor, dan feedback.
6. Guru menyimpan penilaian sebagai draft.
7. Guru memilih `Publikasikan nilai`.
8. Siswa dan Wali menerima notifikasi.
9. Jika perlu revisi, Guru menentukan instruksi dan deadline baru.

## 28. Aturan Penilaian

- Total skor rubrik harus sesuai dengan `maxScore` tugas atau dinormalisasi secara eksplisit.
- Nilai draft tidak terlihat oleh Siswa/Wali.
- Nilai published tidak dapat diubah diam-diam.
- Revisi nilai wajib memiliki alasan dan audit before/after.
- Guru hanya dapat menilai submission siswa pada kelasnya.
- Admin dapat memperbaiki data melalui alur khusus yang diaudit.

## 29. Acceptance Criteria Fase 4

- Siswa dapat merekam dan mengumpulkan audio melalui mobile browser yang didukung.
- Fallback upload tersedia.
- Guru dapat memakai rubrik reusable.
- Rubrik penilaian lama tidak berubah ketika template diedit.
- Feedback draft tidak terlihat oleh Siswa dan Wali.
- Feedback published mengirim notifikasi satu kali secara idempoten.
- Koreksi nilai menyimpan alasan dan audit before/after.

---

# FASE 5 — Gradebook Terpadu

## 30. Tujuan Fase 5

Menggabungkan tugas, kuis, ujian, speaking, writing, proyek, dan komponen manual ke dalam satu buku nilai kelas.

## 31. Model Data Fase 5

### 31.1 GradeCategory

- `id`
- `classId`
- `name`
- `weight`
- `order`
- `dropLowestCount` default `0`
- `status`

### 31.2 GradeItem

- `id`
- `classId`
- `categoryId`
- `sourceType`: `ASSIGNMENT`, `QUIZ`, `EXAM`, `MANUAL`, `ATTENDANCE`, `PROGRESS`
- `sourceId` opsional
- `title`
- `maxScore`
- `weightOverride` opsional
- `isExtraCredit` default `false`
- `status`: `DRAFT`, `PUBLISHED`, `LOCKED`
- `dueAt` opsional

### 31.3 GradeEntry

- `id`
- `gradeItemId`
- `studentId`
- `rawScore` opsional
- `normalizedScore` opsional
- `status`: `MISSING`, `SUBMITTED`, `GRADED`, `EXEMPT`, `REMEDIAL`, `FINAL`
- `isLate`
- `feedbackSummary` opsional
- `sourceVersion`
- timestamps

### 31.4 FinalGrade

- `classId`
- `studentId`
- `calculatedScore`
- `publishedScore` opsional
- `letterGrade` opsional
- `completionStatus`
- `status`: `DRAFT`, `PUBLISHED`, `LOCKED`, `CORRECTED`
- `publishedAt`
- timestamps

## 32. Aturan Perhitungan

- Total bobot kategori wajib 100% sebelum nilai akhir dapat dipublikasikan.
- Komponen `EXEMPT` dikeluarkan dari denominator sesuai aturan yang terdokumentasi.
- Nilai `MISSING` dibedakan dari skor `0`.
- Semua perhitungan dilakukan server-side menggunakan satu service kanonik.
- UI preview dan laporan harus memakai service yang sama agar hasil tidak berbeda.
- Simpan raw score; hitung normalized score secara deterministik.
- Recalculation harus dapat dijalankan ulang secara idempoten.
- Perubahan konfigurasi gradebook setelah nilai published memerlukan konfirmasi dan audit.

## 33. UI Gradebook

Guru:

- Tabel siswa sebagai baris dan grade item sebagai kolom.
- Filter siswa, kategori, status, dan item.
- Tampilan single student dan single grade item.
- Indikator belum dinilai, terlambat, exempt, remedial, dan terkunci.
- Simulasi nilai sebelum publish.
- Publish per item atau seluruh nilai akhir.

Siswa:

- Nilai yang sudah dipublikasikan.
- Bobot kategori.
- Feedback dan link kembali ke submission.
- Nilai akhir ketika sudah dipublikasikan.

Wali:

- Tampilan sama dengan Siswa secara read-only.
- Ringkasan komponen yang belum selesai.

## 34. Sinkronisasi Sumber Nilai

- Nilai assignment published membuat atau memperbarui `GradeEntry` terkait.
- Hasil ujian final existing disinkronkan melalui adapter, bukan disalin manual oleh Guru.
- Koreksi hasil ujian memperbarui gradebook dengan version/audit.
- Jangan membuat siklus update antara gradebook dan sumber nilai.
- Tentukan satu arah: source assessment → gradebook.

## 35. Acceptance Criteria Fase 5

- Guru dapat membuat kategori berbobot total 100%.
- Nilai assignment dan ujian muncul otomatis.
- `MISSING`, `0`, dan `EXEMPT` menghasilkan perhitungan yang benar.
- Nilai draft tidak terlihat oleh Siswa/Wali.
- Nilai published terlihat konsisten pada semua halaman.
- Perhitungan memiliki unit test untuk kasus pembulatan, missing, exempt, remedial, dan koreksi.
- Gradebook kelas besar tetap memiliki pagination/virtualization yang memadai.

---

# FASE 6 — Kalender, To-do, dan Pengingat

## 36. Tujuan Fase 6

Menggabungkan jadwal kelas, release materi, deadline tugas, ujian, remedial, dan perubahan jadwal dalam satu kalender.

## 37. Model Kalender

Utamakan derived event dari entity sumber. Jangan menduplikasi jadwal apabila tidak diperlukan.

Jenis event:

- `CLASS_SESSION`
- `MODULE_RELEASE`
- `ASSIGNMENT_DUE`
- `QUIZ_DUE`
- `EXAM`
- `REMEDIAL_DUE`
- `HOLIDAY`
- `ANNOUNCEMENT`

Jika dibutuhkan event manual, buat `CalendarEvent` dengan:

- `id`
- `classId` opsional
- `title`
- `description`
- `eventType`
- `startAt`
- `endAt`
- `allDay`
- `visibility`
- `createdBy`
- timestamps

## 38. To-do Service

Sediakan service yang menghasilkan daftar tindakan berdasarkan pengguna:

Siswa:

- Materi yang belum dibuka.
- Tugas yang belum disubmit.
- Tugas yang perlu revisi.
- Kuis/ujian yang tersedia.
- Deadline terdekat.

Guru:

- Draft yang belum dipublikasikan.
- Submission yang belum dinilai.
- Sesi yang belum difinalkan.
- Nilai yang belum dipublikasikan.
- Laporan yang belum dibuat.

Wali:

- Tugas anak yang mendekati tenggat.
- Tugas terlambat.
- Remedial.
- Jadwal kelas terdekat.
- Laporan baru.

## 39. Pengingat

- Buat scheduled job untuk reminder H-3, H-1, saat deadline, dan setelah terlambat sesuai konfigurasi.
- Gunakan idempotency key: kombinasi user, entity, event type, dan reminder window.
- Jangan mengirim reminder jika aktivitas sudah selesai.
- Kelompokkan reminder Wali agar tidak terjadi spam untuk beberapa anak.
- Sediakan preferensi kanal dan jenis notifikasi bila pola existing memungkinkan.

## 40. Acceptance Criteria Fase 6

- Kalender menampilkan event sesuai role dan scope.
- Perubahan deadline langsung tercermin tanpa data kalender basi.
- To-do hilang setelah aktivitas selesai.
- Reminder tidak terkirim ganda ketika job dijalankan ulang.
- Wali hanya menerima reminder anak yang terhubung.

---

# FASE 7 — Activity Completion dan Progres Belajar

## 41. Tujuan Fase 7

Mengukur progres berdasarkan aktivitas nyata, bukan hanya skor pemahaman yang dicatat Guru.

## 42. Model Completion

### 42.1 CompletionRule

- `moduleItemId`
- `ruleType`: `VIEWED`, `SUBMITTED`, `GRADED`, `PASSED`, `MANUAL`
- `minimumScore` opsional
- `requiredDuration` opsional, gunakan hati-hati
- `isRequired`

### 42.2 StudentActivityCompletion

- `studentId`
- `moduleItemId`
- `status`: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`
- `completedAt`
- `completionSource`
- `completedByUserId` opsional
- `evidenceEntityId` opsional
- timestamps

### 42.3 StudentModuleProgress

Dapat dihitung dari completion atau disimpan sebagai cache yang dapat dibangun ulang:

- `studentId`
- `moduleId`
- `requiredItemCount`
- `completedRequiredItemCount`
- `progressPercentage`
- `completedAt`

## 43. Aturan Completion

- `VIEWED` hanya menandai akses; jangan menganggapnya sebagai pemahaman.
- `SUBMITTED` selesai setelah submission final.
- `GRADED` selesai setelah Guru mempublikasikan nilai.
- `PASSED` selesai setelah nilai mencapai minimum.
- `MANUAL` hanya dapat diubah Guru/Admin yang berwenang.
- Jika nilai dikoreksi di bawah batas lulus, lakukan recalculation dengan audit.
- Module completion dihitung hanya dari item required.
- Arsip item tidak boleh diam-diam menghapus histori completion.

## 44. Tampilan Progres

Guru:

- Matriks siswa × aktivitas.
- Filter siswa yang tertinggal.
- Tanda belum mulai, sedang berjalan, selesai, terlambat, atau gagal memenuhi nilai minimum.
- Quick action mengirim pengingat.

Siswa:

- Checklist aktivitas.
- Progress bar modul dan kelas.
- Tindakan berikutnya.
- Penjelasan mengapa aktivitas belum dianggap selesai.

Wali:

- Ringkasan progres.
- Aktivitas yang membutuhkan perhatian.
- Hindari menampilkan data teknis seperti jumlah klik atau durasi login sebagai ukuran keberhasilan utama.

## 45. Acceptance Criteria Fase 7

- Completion diperbarui otomatis dari source event.
- Reprocessing event tidak membuat data ganda.
- Persentase hanya menghitung aktivitas wajib.
- Guru dapat menandai manual dengan audit.
- Siswa dan Wali melihat progres yang sama untuk siswa yang sama.
- Policy mencegah manipulasi completion melalui API.

---

# FASE 8 — Remedial dan Revisi

## 46. Tujuan Fase 8

Menyediakan alur perbaikan yang jelas ketika siswa belum memenuhi target.

## 47. Model Remedial

### 47.1 RemedialAssignment

- `id`
- `sourceType`: `ASSIGNMENT`, `QUIZ`, `EXAM`, `COMPETENCY`
- `sourceId`
- `classId`
- `instructions`
- `availableFrom`
- `dueAt`
- `scorePolicy`: `LATEST`, `HIGHEST`, `AVERAGE`, `CAPPED`
- `scoreCap` opsional
- `createdBy`
- status dan timestamps

### 47.2 RemedialParticipant

- `remedialId`
- `studentId`
- `reason`
- `status`
- `assignedAt`
- `completedAt`

Gunakan assignment/quiz attempt existing sebagai jawaban remedial. Jangan membuat sistem submission kedua.

## 48. Alur Remedial

- Guru memilih satu atau beberapa siswa.
- Guru menulis alasan dan deadline.
- Sistem mengirim notifikasi ke Siswa dan Wali.
- Siswa mengerjakan melalui alur assignment/quiz yang sama.
- Guru menilai.
- Gradebook menerapkan score policy.
- Nilai awal dan nilai remedial tetap terlihat pada histori Guru.
- Wali melihat status dan hasil yang sudah dipublikasikan.

## 49. Acceptance Criteria Fase 8

- Remedial hanya terlihat oleh siswa yang ditugaskan.
- Nilai awal tidak terhapus.
- Semua score policy memiliki unit test.
- Deadline dan reminder remedial muncul di kalender.
- Wali menerima notifikasi tanpa dapat mengerjakan remedial.

---

# FASE 9 — Pengumuman dan Ruang Tanya Jawab

## 50. Tujuan Fase 9

Memusatkan komunikasi akademik yang saat ini berpotensi tersebar di WhatsApp pribadi.

## 51. Pengumuman

Model konseptual `Announcement`:

- `id`
- `classId` opsional
- `title`
- `content`
- `priority`: `NORMAL`, `IMPORTANT`, `URGENT`
- `audience`: `STUDENTS`, `GUARDIANS`, `BOTH`
- `publishAt`
- `expiresAt` opsional
- `status`
- `createdBy`
- timestamps

Tambahkan read receipt sederhana:

- `announcementId`
- `userId`
- `readAt`

## 52. Ruang Tanya Jawab

Model konseptual:

### 52.1 DiscussionThread

- `id`
- `classId`
- `moduleItemId` opsional
- `title`
- `content`
- `createdBy`
- `status`: `OPEN`, `LOCKED`, `HIDDEN`
- `isPinned`
- timestamps

### 52.2 DiscussionReply

- `id`
- `threadId`
- `content`
- `createdBy`
- `parentReplyId` opsional
- `isTeacherAnswer`
- `status`
- timestamps

## 53. Aturan Moderasi

- Tidak menyediakan pesan pribadi Siswa–Guru pada fase ini.
- Guru dapat pin, lock, hide, dan menandai jawaban Guru.
- Siswa hanya dapat membuat thread/reply pada kelas aktif yang diikutinya.
- Wali dapat melihat diskusi bila dikonfigurasi, tetapi default read-only.
- Edit posting hanya tersedia dalam waktu terbatas atau selama belum mendapat balasan.
- Penghapusan konten bersifat soft delete dan diaudit.
- File attachment menggunakan private storage dan authorization.
- Sediakan report content jika diskusi antar-Siswa diaktifkan.

## 54. Acceptance Criteria Fase 9

- Pengumuman dapat ditargetkan ke Siswa, Wali, atau keduanya.
- Scheduled publish berjalan idempoten.
- Siswa dapat bertanya dalam scope kelasnya.
- Guru dapat memoderasi dan mengunci diskusi.
- Pengguna di luar kelas tidak dapat membaca thread.
- Konten yang dihapus tetap memiliki audit tanpa ditampilkan ke pengguna umum.

---

# FASE 10 — Laporan Perkembangan Berkala

## 55. Tujuan Fase 10

Menggabungkan presensi, progres, completion, nilai, tugas, dan catatan Guru menjadi laporan yang mudah dipahami Wali.

## 56. Model Laporan

### 56.1 ProgressReport

- `id`
- `studentId`
- `classId`
- `periodStart`
- `periodEnd`
- `reportType`: `WEEKLY`, `MONTHLY`, `LEVEL_COMPLETION`
- `summary`
- `strengths`
- `improvementAreas`
- `teacherRecommendation`
- `snapshotData`
- `status`: `DRAFT`, `PUBLISHED`, `REVISED`
- `createdBy`
- `publishedAt`
- timestamps

### 56.2 ProgressReportRead

- `reportId`
- `userId`
- `readAt`

`snapshotData` menyimpan ringkasan data ketika laporan dipublikasikan agar laporan lama tidak berubah ketika data sumber dikoreksi. Jika ada koreksi material, buat versi `REVISED` dengan alasan.

## 57. Isi Laporan

- Identitas siswa dan kelas.
- Periode laporan.
- Ringkasan kehadiran.
- Modul dan aktivitas selesai.
- Tugas selesai, terlambat, dan belum selesai.
- Nilai per kategori.
- Perkembangan listening, speaking, reading, writing, vocabulary, grammar, dan pronunciation jika datanya tersedia.
- Kelebihan siswa.
- Hal yang perlu ditingkatkan.
- Rekomendasi Guru.
- Tanggal publikasi dan nama Guru.

## 58. Alur Laporan

1. Sistem membuat draft dari data periode.
2. Guru memeriksa dan melengkapi narasi.
3. Guru mempublikasikan laporan.
4. Sistem menyimpan snapshot.
5. Siswa dan Wali menerima notifikasi.
6. Wali dapat melihat di aplikasi dan mengunduh PDF.
7. Sistem mencatat laporan sudah dibaca.

Jangan mengirim laporan otomatis kepada Wali sebelum Guru meninjau draft.

## 59. PDF Laporan

- Gunakan template yang konsisten dengan identitas LIMO.
- Ukuran A4 dan ramah cetak.
- Font mendukung Bahasa Indonesia, Inggris, dan karakter Arab bila digunakan.
- Grafik harus tetap terbaca dalam grayscale.
- PDF dihasilkan dari snapshot published, bukan data live.
- Download melalui authorized route.

## 60. Acceptance Criteria Fase 10

- Guru dapat menghasilkan draft berdasarkan periode.
- Draft dapat diedit tanpa mengubah data sumber.
- Wali hanya melihat laporan published milik anaknya.
- PDF sesuai dengan tampilan laporan published.
- Perubahan data setelah publish tidak mengubah laporan lama.
- Revisi laporan menyimpan alasan dan histori.

---

# 61. Persyaratan Lintas Fase

## 61.1 Audit log

Catat minimal:

- Pembuatan/aktivasi akun siswa.
- Publish/archive modul.
- Publish/archive tugas.
- Submit dan resubmit tugas.
- Publish/revisi nilai.
- Perubahan konfigurasi gradebook.
- Publish/koreksi nilai akhir.
- Manual completion.
- Penugasan dan hasil remedial.
- Moderasi diskusi.
- Publish/revisi laporan perkembangan.

Audit harus menyimpan actor, action, entity, entity ID, timestamp, reason bila diperlukan, dan before/after untuk koreksi penting.

## 61.2 Notifikasi

Tambahkan event:

- Akun siswa diaktifkan.
- Modul tersedia.
- Tugas dipublikasikan.
- Deadline tugas mendekat.
- Tugas terlambat.
- Tugas perlu revisi.
- Nilai/feedback dipublikasikan.
- Remedial diberikan.
- Pengumuman baru.
- Laporan perkembangan tersedia.

Gunakan outbox/event mechanism existing jika tersedia. Pengiriman eksternal tidak boleh memperlambat transaction utama.

## 61.3 Accessibility dan mobile

- Seluruh fungsi utama dapat digunakan dengan keyboard.
- Label form terhubung dengan input.
- Error dapat dipahami dan tidak hanya ditandai dengan warna.
- Focus state terlihat.
- Kontras teks memadai.
- Gambar materi mendukung alt text.
- Video mendukung caption/transkrip bila tersedia.
- Editor dan viewer materi Arab mendukung RTL.
- Tombol rekam dan submit mudah digunakan pada layar kecil.
- Uji viewport ponsel melalui Playwright.

## 61.4 Keamanan

- Terapkan rate limit pada login, upload, autosave, submit, dan posting diskusi.
- Validasi authorization di setiap download/stream file.
- Jangan mempercayai `classId`, `studentId`, atau `userId` dari client tanpa policy check.
- Sanitasi rich text untuk mencegah XSS.
- Terapkan batas ukuran, jumlah, dan durasi media.
- Jangan mencatat isi jawaban, token, atau URL private ke application log.
- Gunakan MFA untuk Admin/Guru jika modul autentikasi memungkinkan; jika belum, dokumentasikan sebagai backlog keamanan.

## 61.5 Observability

Tambahkan metric/log untuk:

- Kegagalan upload.
- Kegagalan autosave.
- Duplicate submit yang dicegah.
- Job reminder gagal.
- Sinkronisasi nilai gagal.
- Completion event gagal diproses.
- Pembuatan PDF gagal.
- Storage usage media.

Scheduled job harus memiliki status eksekusi, timestamp terakhir, jumlah item berhasil/gagal, dan mekanisme retry terbatas.

## 61.6 Performance

- Gunakan pagination untuk siswa, submission, gradebook, diskusi, dan laporan.
- Tambahkan index pada foreign key dan kombinasi filter utama.
- Pastikan unique constraint mendukung idempotency.
- Hindari membaca file ke memory penuh ketika streaming media.
- Gunakan thumbnail/metadata untuk daftar media.
- Dashboard menggunakan query ringkas, bukan memuat seluruh histori.

## 61.7 Backup dan restore

Pastikan model dan private files baru tercakup dalam backup existing:

- Submission file.
- Feedback audio.
- Snapshot laporan dan PDF.
- Tabel completion.
- Gradebook dan histori koreksi.
- Diskusi dan moderasi.

Perbarui manifest backup dan uji restore pada staging.

# 62. Strategi Migration dan Rollout

## 62.1 Migration

- Buat satu atau beberapa migration kecil per fase.
- Tambahkan nullable field lebih dahulu sebelum menjadikannya required.
- Jalankan backfill sebagai script/job terpisah untuk data besar.
- Gunakan unique constraint setelah data existing dibersihkan dan diverifikasi.
- Setiap migration memiliki langkah verifikasi dan rollback operasional.

## 62.2 Kompatibilitas data ujian lama

- Jangan mengubah histori attempt ujian yang sebelumnya dilakukan melalui akun Wali.
- Pertahankan actor existing sebagai Wali dan subject sebagai siswa.
- Untuk attempt baru setelah portal siswa aktif, actor default adalah user siswa.
- Tampilkan label audit yang jelas untuk attempt lama.

## 62.3 Rollout

Urutan rollout per fase:

1. Development.
2. Automated tests.
3. Staging migration.
4. Seed/sample data.
5. UAT oleh Admin, satu Guru, satu Siswa, dan satu Wali.
6. Perbaikan temuan.
7. Aktifkan feature flag untuk satu kelas pilot.
8. Monitor error dan feedback.
9. Rollout ke semua kelas.

# 63. Rencana Pengujian

## 63.1 Unit test

Minimal mencakup:

- Perhitungan bobot gradebook.
- Status keterlambatan.
- Score policy remedial.
- Completion rule.
- Progress percentage.
- Status publikasi berdasarkan waktu.
- Normalisasi dan pembulatan nilai.
- Idempotency key notifikasi.

## 63.2 Integration test

Minimal mencakup:

- Policy akses setiap role.
- Siswa tidak dapat melihat data siswa lain.
- Wali tidak dapat submit tugas.
- Guru tidak dapat menilai kelas Guru lain.
- File private tidak dapat diakses tanpa hubungan yang sah.
- Autosave dan submit idempoten.
- Nilai sumber tersinkron ke gradebook.
- Scheduled publish dan reminder tidak duplikat.
- Snapshot laporan tidak berubah setelah data sumber berubah.

## 63.3 E2E test

Skenario utama:

1. Admin membuat akun siswa.
2. Siswa aktivasi akun dan login.
3. Guru membuat modul dan tugas speaking.
4. Guru mempublikasikan modul.
5. Siswa membuka materi, merekam jawaban, menyimpan draft, lalu submit.
6. Guru menilai dengan rubrik dan mempublikasikan feedback.
7. Siswa melihat nilai dan progres.
8. Wali melihat status tugas, feedback, dan progres.
9. Guru memberi remedial.
10. Siswa menyelesaikan remedial.
11. Gradebook menghitung nilai akhir.
12. Guru menerbitkan laporan perkembangan.
13. Wali membuka dan mengunduh laporan.

Tambahkan E2E negatif untuk akses lintas role dan lintas siswa.

# 64. Definition of Done Global

Satu fase dinyatakan selesai hanya jika:

- Migration berhasil pada database kosong dan database berisi data existing.
- Tidak ada kehilangan data existing.
- Authorization server-side telah diuji.
- Unit test dan integration test terkait lulus.
- E2E alur utama lulus pada desktop dan mobile.
- Typecheck, lint, dan production build lulus.
- Loading, error, empty, success, dan unauthorized state tersedia.
- Audit log tercatat untuk aktivitas penting.
- Notifikasi tidak terkirim ganda.
- Dokumentasi API, role access matrix, UAT, backup, dan known limitations diperbarui.
- Fitur telah diuji dengan akun Admin, Guru, Siswa, dan Wali.

# 65. Urutan Pengerjaan yang Tidak Boleh Diubah

Dependency implementasi:

1. Audit project dan baseline test.
2. Role serta akun Siswa.
3. Dashboard Siswa.
4. Modul pembelajaran.
5. Tugas dan submission.
6. Rekaman speaking.
7. Rubrik dan feedback.
8. Gradebook.
9. Kalender dan to-do.
10. Activity completion.
11. Remedial.
12. Pengumuman dan ruang tanya jawab.
13. Laporan perkembangan.
14. Hardening, backup/restore, UAT, dan rollout.

Alasan dependency:

- Tugas membutuhkan akun Siswa dan struktur kelas.
- Tugas sebaiknya ditempatkan di dalam modul.
- Gradebook membutuhkan sumber nilai dari tugas dan ujian.
- Completion membutuhkan modul dan aktivitas yang stabil.
- Remedial membutuhkan assignment/quiz serta gradebook.
- Laporan perkembangan membutuhkan seluruh data akademik sebelumnya.

# 66. Instruksi Output untuk Aplikasi Vibe Coding

Pada awal setiap fase, aplikasi vibe coding harus memberikan:

1. Ringkasan hasil inspeksi kode terkait fase.
2. Daftar file yang akan dibuat atau diubah.
3. Rencana migration.
4. Risiko regresi.
5. Test yang akan ditambahkan.

Setelah implementasi setiap fase, aplikasi vibe coding harus memberikan:

1. Ringkasan perubahan yang benar-benar diterapkan.
2. Daftar migration dan cara menjalankannya.
3. Daftar endpoint dan halaman baru.
4. Hasil test, typecheck, lint, dan build.
5. Known limitations.
6. Langkah UAT manual.
7. Pernyataan apakah acceptance criteria sudah terpenuhi.

Jangan menyatakan fase selesai apabila ada test yang dilewati, migration belum diuji, build gagal, atau authorization hanya diperiksa pada UI.

# 67. Acceptance Scenario Akhir

Pengembangan dianggap berhasil apabila skenario berikut berjalan utuh:

1. Admin membuat akun untuk siswa existing tanpa menggandakan data siswa.
2. Guru menyusun materi, tugas, dan aktivitas dalam modul mingguan.
3. Siswa login dan melihat apa yang harus dikerjakan.
4. Siswa mempelajari materi dan mengumpulkan tugas teks/audio/video.
5. Guru menilai menggunakan rubrik dan memberikan feedback.
6. Nilai masuk otomatis ke gradebook.
7. Progres modul diperbarui berdasarkan aktivitas nyata.
8. Siswa yang belum memenuhi nilai mendapat remedial.
9. Kalender dan reminder menunjukkan deadline yang benar.
10. Wali dapat memantau tanpa dapat mengubah pekerjaan siswa.
11. Guru menerbitkan laporan perkembangan berkala.
12. Wali membaca laporan dan mengunduh PDF.
13. Seluruh aktivitas penting tercatat dalam audit log.
14. Data dan file baru dapat di-backup dan di-restore.
