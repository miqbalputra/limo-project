# Rancangan Fitur Ujian Online Anak via Akun Wali

## Ringkasan

Fitur ini memungkinkan anak mengerjakan tugas/ujian langsung di sistem LIMO menggunakan akun wali. Model akses yang dipakai adalah **wali-assisted student exam**: wali login, memilih anak, lalu anak mengerjakan ujian pada perangkat wali dengan pendampingan orang tua.

Fitur ini tidak menggantikan alur yang sudah ada. LIMO tetap mendukung dua mode assessment:

- **Teacher-entry offline**: siswa mengerjakan di kelas/lembar kerja/lisan, guru input hasil.
- **Student-online via wali**: siswa mengerjakan langsung di sistem melalui akun wali.

Pendekatan ini cocok untuk anak usia SD karena tidak perlu membuat akun siswa terpisah di tahap awal, tetap aman, dan orang tua bisa mendampingi.

## Tujuan

- Anak dapat mengerjakan ujian/tugas online dari dashboard wali.
- Wali dapat memilih anak yang akan mengerjakan.
- Guru dapat membuat ujian dan menentukan apakah ujian bisa dikerjakan online.
- Sistem dapat auto-score soal objektif.
- Soal performa seperti speaking, writing, roleplay, dan esai tetap bisa masuk review guru.
- Wali dapat melihat status pengerjaan dan nilai final.
- Data hasil ujian tetap masuk ke sistem nilai yang sudah ada.

## Prinsip Produk

- Sederhana untuk orang tua dan anak.
- Tidak memaksa semua assessment menjadi online.
- Anak SD tidak perlu akun/email sendiri untuk MVP.
- Guru tetap memegang kontrol publish, review, dan finalisasi nilai.
- UI pengerjaan harus minim distraksi dan ramah mobile.
- Sistem harus menjaga agar anak hanya bisa mengerjakan ujian miliknya.

## Role dan Hak Akses

### Wali

- Login menggunakan akun wali.
- Melihat daftar anak yang terhubung.
- Melihat daftar tugas/ujian online anak.
- Memulai pengerjaan ujian untuk anak tertentu.
- Melanjutkan attempt jika belum submit, selama masih diperbolehkan.
- Melihat status hasil: belum dikerjakan, sedang dikerjakan, terkumpul, menunggu review, final.
- Melihat nilai final setelah guru menyelesaikan review/finalisasi.

### Anak

- Tidak punya login sendiri pada tahap awal.
- Menggunakan perangkat dan sesi login wali.
- Mengisi jawaban pada mode pengerjaan anak.
- Submit jawaban.

### Guru

- Membuat bank soal.
- Membuat ujian.
- Menentukan mode ujian:
  - `TEACHER_ENTRY`
  - `ONLINE_VIA_WALI`
  - opsional masa depan: `BOTH`
- Melihat hasil attempt online.
- Melakukan review untuk jawaban manual/rubric.
- Finalisasi nilai.

### Admin

- Melihat dan membantu operasional data.
- Dapat memantau ujian, hasil, dan relasi siswa/wali.
- Dapat membantu reset attempt jika dibutuhkan secara administratif.

## Istilah

- **Ujian**: assessment yang dibuat guru dari bank soal.
- **Attempt**: satu sesi pengerjaan online oleh anak.
- **Auto-score**: skor dihitung otomatis oleh sistem.
- **Needs review**: jawaban perlu dinilai guru.
- **Final**: nilai akhir sudah siap dilihat wali.

## User Journey

### Journey Wali dan Anak

1. Wali login ke dashboard.
2. Wali membuka menu `Tugas Anak` atau `Ujian Anak`.
3. Wali memilih anak jika punya lebih dari satu anak.
4. Sistem menampilkan daftar ujian online yang tersedia.
5. Wali/anak membuka detail ujian.
6. Sistem menampilkan instruksi, durasi, jumlah soal, dan status.
7. Anak klik `Mulai Kerjakan`.
8. Sistem membuat attempt.
9. Anak menjawab soal satu per satu.
10. Anak submit jawaban.
11. Sistem menghitung skor otomatis untuk soal objektif.
12. Jika ada soal manual, status menjadi `Menunggu Review Guru`.
13. Jika semua soal auto-score, hasil bisa langsung `Final`.
14. Wali melihat status dan nilai dari halaman nilai/progres.

### Journey Guru

1. Guru membuat soal di `Assessment Bank`.
2. Guru membuat ujian dari bank soal.
3. Guru memilih mode `Online via Wali`.
4. Guru publish ujian.
5. Wali/anak mengerjakan.
6. Guru melihat daftar hasil.
7. Guru review jawaban manual jika ada.
8. Guru finalisasi.

## Navigasi yang Diusulkan

### Menu Wali

Tambahkan menu baru:

- `Tugas Anak`

Lokasi section:

- Section `Perkembangan Anak`, setelah `Progres` atau sebelum `Nilai`.

Struktur halaman:

- `/wali/tugas`
- `/wali/tugas/[siswaId]`
- `/wali/tugas/[siswaId]/ujian/[ujianId]`
- `/wali/tugas/[siswaId]/ujian/[ujianId]/kerjakan`
- `/wali/tugas/[siswaId]/attempt/[attemptId]`

### Menu Guru

Menu yang sudah ada tetap dipakai:

- `Assessment Bank`
- `Ujian`
- `Input Hasil`

Tambahan pada halaman ujian:

- Label mode ujian.
- Jumlah attempt online.
- Shortcut `Review Online`.

## UX Halaman Wali

### `/wali/tugas`

Isi halaman:

- Hero: `Tugas Anak`.
- Ringkasan:
  - jumlah tugas tersedia
  - jumlah belum dikerjakan
  - jumlah menunggu review
  - jumlah selesai/final
- Daftar anak terhubung.
- Setiap kartu anak menampilkan:
  - nama anak
  - program
  - tugas tersedia
  - tugas belum dikerjakan
  - tugas menunggu review
  - CTA `Lihat Tugas`

### `/wali/tugas/[siswaId]`

Isi halaman:

- Hero anak.
- Tab/filter status:
  - Semua
  - Belum dikerjakan
  - Sedang dikerjakan
  - Menunggu review
  - Selesai
- Kartu ujian:
  - judul ujian
  - kelas/program
  - jumlah soal
  - durasi
  - batas waktu jika ada
  - status pengerjaan
  - CTA sesuai status:
    - `Mulai Kerjakan`
    - `Lanjutkan`
    - `Lihat Status`
    - `Lihat Nilai`

### Halaman Instruksi Ujian

Sebelum mulai, tampilkan:

- Judul ujian.
- Nama anak.
- Instruksi pengerjaan.
- Durasi.
- Jumlah soal.
- Informasi bahwa ujian dikerjakan melalui akun wali.
- Checklist sederhana:
  - anak siap mengerjakan
  - koneksi internet stabil
  - orang tua tidak membantu menjawab, hanya mendampingi

CTA:

- `Mulai Kerjakan`
- `Kembali`

### Halaman Kerjakan Ujian

Prinsip UI:

- Fokus satu soal per layar atau list ringan yang mobile-friendly.
- Ada progress jumlah soal.
- Ada timer jika ujian berdurasi.
- Ada tombol simpan otomatis atau autosave.
- Ada tombol submit di akhir.

Komponen:

- Header ujian:
  - judul
  - nama anak
  - timer
  - progress soal
- Area soal:
  - stimulus
  - media jika ada
  - pertanyaan
  - input jawaban sesuai tipe
- Navigasi:
  - sebelumnya
  - berikutnya
  - submit

## Tipe Soal Online Tahap Awal

Tahap awal mendukung tipe yang relatif aman dikerjakan online:

- `PILIHAN_GANDA`
- `MULTI_SELECT`
- `BENAR_SALAH`
- `ISIAN_SINGKAT`
- `CLOZE`
- `GAMBAR`
- `LISTENING`
- `READING`
- `ESAI`
- `WRITING`

Catatan:

- `GAMBAR`, `LISTENING`, dan `READING` bisa tetap memakai jawaban pilihan atau jawaban singkat/manual tergantung konfigurasi soal.
- `ESAI` dan `WRITING` masuk review guru jika tidak ada auto-score.

## Tipe Soal Online Tahap Berikutnya

- `MENJODOHKAN`
- `URUTAN`
- `SPEAKING`
- `ROLEPLAY`

Alasan ditunda:

- Matching dan sequencing butuh UI interaktif yang nyaman untuk mobile.
- Speaking butuh recording/upload audio.
- Roleplay biasanya lebih cocok teacher-entry atau live performance.

## Status Ujian dan Attempt

### Status Ujian

Gunakan status ujian yang sudah ada:

- `DRAFT`
- `PUBLISHED`

Tambahan field mode:

- `deliveryMode`
  - `TEACHER_ENTRY`
  - `ONLINE_VIA_WALI`
  - `BOTH`

Opsional field jadwal:

- `availableFrom`
- `availableUntil`
- `allowLateSubmission`
- `maxAttempts`

### Status Attempt

Usulan enum:

- `NOT_STARTED`
- `IN_PROGRESS`
- `SUBMITTED`
- `NEEDS_REVIEW`
- `FINAL`
- `EXPIRED`
- `CANCELLED`

Catatan:

- `NOT_STARTED` bisa dihitung dari belum adanya attempt, tidak harus disimpan.
- Attempt dibuat saat anak klik `Mulai Kerjakan`.

## Rancangan Data

### Opsi Minimal

Memanfaatkan model yang sudah ada:

- `Ujian`
- `UjianSoal`
- `BankSoal`
- `HasilUjian`
- `JawabanUjian`

Tambahan model baru:

```prisma
model UjianAttempt {
  id            String   @id @default(cuid())
  ujianId       String
  ujian         Ujian    @relation(fields: [ujianId], references: [id], onDelete: Cascade)
  siswaId       String
  siswa         Siswa    @relation(fields: [siswaId], references: [id], onDelete: Restrict)
  waliProfileId String
  waliProfile   WaliProfile @relation(fields: [waliProfileId], references: [id], onDelete: Restrict)
  hasilUjianId  String?
  status        String
  startedAt     DateTime @default(now())
  submittedAt   DateTime?
  expiresAt      DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([ujianId, siswaId])
  @@index([waliProfileId, status])
}
```

Tambahan field pada `Ujian`:

```prisma
deliveryMode String @default("TEACHER_ENTRY") @db.VarChar(32)
availableFrom DateTime?
availableUntil DateTime?
maxAttempts Int @default(1)
showResultToWali Boolean @default(true)
```

Alternatif lebih kuat:

- `UjianAttempt`
- `UjianAttemptAnswer`

Namun untuk MVP, hasil final bisa langsung disimpan ke `HasilUjian` dan `JawabanUjian` saat submit. `UjianAttempt` hanya menjadi tracking online session.

## Mapping ke Model Existing

Saat submit online:

1. Validasi attempt milik siswa dan wali.
2. Validasi ujian masih published dan mode online aktif.
3. Buat/update `HasilUjian` untuk kombinasi `ujianId + siswaId`.
4. Hapus jawaban lama jika attempt final menggantikan draft jawaban.
5. Simpan jawaban ke `JawabanUjian`.
6. Hitung auto-score.
7. Jika ada manual review, set `HasilUjian.status = NEEDS_REVIEW`.
8. Jika semua auto-score, set `HasilUjian.status = FINAL`.
9. Link `UjianAttempt.hasilUjianId` ke hasil tersebut.
10. Set attempt status sesuai hasil.

## Scoring

### Auto-score

Auto-score dapat dipakai untuk:

- Pilihan ganda.
- Multi-select.
- Benar/salah.
- Isian singkat jika `expectedAnswer` tersedia.
- Cloze jika `expectedAnswer` tersedia.

### Manual Review

Manual review diperlukan untuk:

- Esai.
- Writing.
- Speaking.
- Roleplay.
- Picture/listening/reading jika jawabannya bebas.
- Matching/sequencing jika belum dibuat UI interaktif/answer parser.

### Status Hasil

- Semua auto-score: `FINAL`.
- Ada jawaban manual tanpa skor: `NEEDS_REVIEW`.
- Guru selesai menilai manual: `FINAL` atau `CORRECTED` sesuai pola existing.

## API yang Diusulkan

### Wali

`GET /api/v1/wali/tugas`

- List anak dan ringkasan tugas online.

`GET /api/v1/wali/tugas/:siswaId`

- List ujian online untuk anak tertentu.

`POST /api/v1/wali/tugas/:siswaId/ujian/:ujianId/attempt`

- Membuat attempt baru atau mengambil attempt aktif jika masih bisa dilanjutkan.

`GET /api/v1/wali/attempt/:attemptId`

- Mengambil soal dan jawaban draft attempt.

`PATCH /api/v1/wali/attempt/:attemptId`

- Autosave jawaban draft.
- Opsional untuk fase MVP; bisa dilewati jika submit langsung.

`POST /api/v1/wali/attempt/:attemptId/submit`

- Submit jawaban final.

### Guru

`GET /api/v1/guru/ujian/:ujianId/attempts`

- List attempt online.

`POST /api/v1/guru/hasil-ujian/:hasilId/review`

- Review jawaban manual.
- Bisa memakai endpoint review existing/future.

## Validasi Akses

Untuk wali:

- Actor role harus `WALI`.
- `siswaId` harus terhubung ke `waliProfile` aktif.
- Ujian harus untuk kelas siswa.
- Ujian harus `PUBLISHED`.
- `deliveryMode` harus `ONLINE_VIA_WALI` atau `BOTH`.
- Jika ada `availableFrom`, waktu sekarang harus setelahnya.
- Jika ada `availableUntil`, waktu sekarang harus sebelum batasnya, kecuali `allowLateSubmission`.
- Attempt tidak boleh melebihi `maxAttempts`.

Untuk guru:

- Actor role harus `GURU`.
- Guru harus mengelola kelas ujian tersebut.

## Keamanan dan Integritas

- Gunakan session wali yang sudah ada.
- Jangan expose jawaban benar ke client saat pengerjaan.
- Untuk pilihan ganda, client hanya menerima label dan content opsi, bukan `isCorrect`.
- Auto-score dilakukan di server.
- Attempt harus dikunci saat submitted.
- Jawaban tidak boleh bisa diubah setelah submit kecuali reset oleh admin/guru.
- Gunakan CSRF/origin guard existing.
- Semua file/media privat tetap melalui akses terkontrol, bukan public asal-asalan.

## UX Keamanan Anak

- Sebelum mulai tampilkan pesan: “Orang tua mendampingi, anak tetap menjawab sendiri.”
- Tombol submit harus punya konfirmasi.
- Jika belum semua soal dijawab, tampilkan warning.
- Simpan draft/autosave direkomendasikan agar jawaban tidak hilang.

## UI Pengerjaan per Tipe Soal

### Pilihan Ganda

- Radio button/card opsi.
- Satu jawaban.

### Multi-select

- Checkbox/card opsi.
- Bisa lebih dari satu jawaban.

### Benar/Salah

- Dua pilihan besar: `Benar`, `Salah`.

### Isian Singkat/Cloze

- Input text.
- Beri placeholder sederhana.

### Picture-Based

- Tampilkan gambar/stimulus.
- Jawaban bisa opsi atau input text tergantung tipe soal.

### Listening

- Audio player.
- Instruksi: dengarkan audio, lalu jawab.
- Batasi auto-play; browser biasanya memblokir auto-play.

### Reading

- Tampilkan stimulus bacaan dalam card.
- Jawaban bisa opsi/text.

### Writing/Esai

- Textarea.
- Info bahwa jawaban akan direview guru.

## Halaman Guru yang Perlu Diubah

### Form Ujian

Tambahkan field:

- Mode pengerjaan:
  - Offline teacher-entry
  - Online via akun wali
  - Keduanya
- Tanggal mulai tersedia.
- Tanggal terakhir pengerjaan.
- Maksimal attempt.
- Tampilkan nilai ke wali setelah final.

### List Ujian

Tambahkan badge:

- Mode pengerjaan.
- Jumlah attempt online.
- Jumlah needs review.

CTA:

- `Input Hasil Offline`
- `Review Online`

## Halaman Wali yang Perlu Ditambah

### Menu `Tugas Anak`

Menampilkan ringkasan semua anak.

### Detail Tugas Anak

Menampilkan daftar ujian tersedia untuk satu anak.

### Player Ujian

Halaman pengerjaan actual.

### Status Attempt

Menampilkan status setelah submit.

## Tahapan Implementasi

### Phase 1: Fondasi Online Attempt

- Tambah field `deliveryMode`, `availableFrom`, `availableUntil`, `maxAttempts`, `showResultToWali` pada `Ujian`.
- Tambah model `UjianAttempt`.
- Update Prisma migration dan SQLite prepare.
- Update seed demo dengan ujian online.
- Update form guru untuk memilih mode online.

### Phase 2: Wali Tugas Anak

- Tambah menu `Tugas Anak`.
- Buat `/wali/tugas`.
- Buat `/wali/tugas/[siswaId]`.
- Tampilkan status tugas berdasarkan attempt/hasil.

### Phase 3: Player Ujian Online

- Buat halaman instruksi.
- Buat halaman pengerjaan.
- Support tipe objektif tahap awal.
- Submit jawaban ke server.
- Server auto-score dan simpan ke `HasilUjian`/`JawabanUjian`.

### Phase 4: Review Guru

- Tampilkan hasil online di halaman guru.
- Tampilkan jawaban yang butuh review.
- Guru input skor manual.
- Finalisasi nilai.

### Phase 5: Polish dan Safety

- Autosave draft.
- Timer countdown.
- Submit warning jika jawaban kosong.
- Better mobile UX.
- Audit log attempt.
- Rate limit submit.

## Acceptance Criteria MVP

- Wali dapat membuka menu `Tugas Anak`.
- Wali dapat memilih anak.
- Wali hanya melihat ujian milik anak yang terhubung.
- Ujian yang belum published tidak muncul.
- Ujian offline-only tidak muncul sebagai tugas online.
- Anak dapat mengerjakan pilihan ganda dan submit.
- Sistem tidak mengirim `isCorrect` ke client.
- Sistem menghitung skor pilihan ganda di server.
- Hasil ujian muncul di `/wali/nilai` setelah final.
- Guru dapat melihat hasil attempt online.
- Jawaban esai/writing masuk `NEEDS_REVIEW`.
- Wali melihat status `Menunggu Review` jika ada jawaban manual.
- Mobile viewport tidak overflow.
- Typecheck dan lint lulus.

## Risiko dan Mitigasi

### Risiko: Orang tua membantu menjawab

Mitigasi:

- Posisikan fitur sebagai homework/latihan online, bukan high-stakes exam.
- Tampilkan etika pendampingan sebelum mulai.
- Untuk assessment penting, tetap gunakan teacher-entry/offline di kelas.

### Risiko: Jawaban hilang karena koneksi

Mitigasi:

- Phase awal bisa submit langsung.
- Phase polish tambahkan autosave.

### Risiko: Anak menutup halaman sebelum submit

Mitigasi:

- Attempt status `IN_PROGRESS`.
- Tombol `Lanjutkan`.
- Autosave pada phase berikutnya.

### Risiko: File/audio privat bocor

Mitigasi:

- Media assessment privat harus lewat route authorized.
- Jangan simpan file privat di `public/`.

### Risiko: Matching/sequencing sulit di mobile

Mitigasi:

- Tunda ke phase berikutnya.
- Awal gunakan tipe soal sederhana dulu.

## Rekomendasi Nama Menu

Pilihan terbaik:

- `Tugas Anak`

Alternatif:

- `Ujian Anak`
- `Latihan Anak`
- `Tugas & Ujian`

Rekomendasi final: **Tugas Anak** karena lebih ramah untuk orang tua dan anak SD, tidak terdengar terlalu berat seperti “ujian”.

## Rekomendasi MVP Scope

MVP sebaiknya hanya mencakup:

- Mode ujian online via wali.
- Menu `Tugas Anak`.
- Pilih anak.
- List ujian online.
- Player sederhana.
- Submit jawaban.
- Auto-score tipe objektif.
- Manual review untuk esai/writing.
- Hasil tampil di nilai wali.

Tunda:

- Akun siswa mandiri.
- Recording speaking.
- Matching/sequencing drag-and-drop.
- Lockdown browser.
- Proctoring.

## Kesimpulan

Fitur siswa mengerjakan langsung di sistem sangat memungkinkan dan cocok untuk LIMO jika dimulai sebagai **Tugas Anak via akun wali**. Pendekatan ini menjaga pengalaman tetap sederhana, aman, dan realistis untuk anak SD, sambil tetap memberi ruang untuk berkembang menjadi portal siswa penuh di masa depan.
