# Client Implementation Plan LIMO LMS

## Tujuan

Membawa LIMO dari MVP operasional menjadi LMS yang siap dipakai client secara konsisten, aman, mudah dipelajari, dan dapat dipertanggungjawabkan datanya.

## Prinsip Prioritas

- Stabilitas dan kejelasan alur lebih penting daripada menambah fitur sebanyak mungkin.
- Setiap fitur harus punya owner, status, acceptance criteria, dan UAT scenario.
- Data anak, nilai, presensi, progres, dan tagihan harus scoped serta dapat diaudit.
- Copy publik hanya boleh memakai klaim yang sudah diverifikasi client.
- UI harus jelas pada desktop dan mobile.

## Fase 1: Trust dan Client UAT Foundation

Status: **Selesai di repository**

### Cakupan

- Branded loading, error, dan not-found state.
- Skip navigation, focus state, Escape handling, dan semantic progress bar.
- Auth copy Bahasa Indonesia.
- Password visibility toggle.
- Menghapus kontrol login yang belum berfungsi.
- Same-origin protection untuk pendaftaran dan upload dokumen.
- Klaim publik yang belum terverifikasi diganti dengan copy yang jujur/ilustratif.
- Empty state dan error recovery lintas dashboard.
- Workflow guru presensi/progres diarahkan ke route yang benar.
- Submit presensi dan progres menggunakan satu transaksi atomic.

### Acceptance Criteria

- Tidak ada kontrol UI yang terlihat aktif tetapi belum bekerja.
- Error memiliki pesan recovery dan tidak menampilkan stack trace ke pengguna.
- Mutasi pendaftaran tanpa origin valid ditolak.
- Presensi dan progres tidak boleh tersimpan setengah jika salah satu bagian gagal.
- Halaman utama role Admin/Guru/Wali tidak overflow pada mobile.

## Fase 2: Production dan Infrastruktur

Status: **Menunggu environment staging client**

### Cakupan

- MariaDB staging dan migration parity.
- Domain HTTPS staging.
- Persistent private storage.
- SMTP sandbox dan production verification.
- Mayar sandbox UAT: create invoice, payment, webhook, reconcile.
- Backup database dan storage.
- Restore drill.
- Error monitoring dan alerting.
- Distributed rate limiting menggunakan Redis/platform service.

### Acceptance Criteria

- `prisma migrate deploy` sukses di MariaDB staging.
- Backup dapat direstore ke environment kosong.
- Email pendaftaran, reset password, tagihan, dan notifikasi terkirim.
- Payment status berubah hanya dari webhook/reconciliation yang tervalidasi.
- Tidak ada file privat yang dapat diakses tanpa authorization.

## Fase 3: Operasional Admin

Status: **Sebagian selesai di repository**

### Cakupan

- CRUD master data lengkap untuk program, level, kelas, guru, wali, siswa, dan tarif.
- Search, filter, pagination, dan result count konsisten.
- Import siswa dan wali melalui CSV/Excel.
- Riwayat mutasi kelas.
- Konfirmasi aksi destructive dengan alasan yang jelas.
- Audit log yang mudah difilter.
- Laporan operasional:
  - pendaftaran
  - siswa aktif
  - kelas
  - presensi
  - progres
  - nilai
  - tagihan
- Export CSV/PDF sesuai kebutuhan client.

Implementasi pertama fase ini tersedia melalui `/admin/laporan` dengan filter periode, ringkasan kelas/siswa, indikator perhatian, dan export CSV.

### Acceptance Criteria

- Admin dapat menyelesaikan data master tanpa bantuan developer.
- Data list lebih dari 100 record tetap dapat dicari dan dipaginasi.
- Setiap archive/deactivate/reconcile memiliki konfirmasi dan audit trail.
- Laporan periode dapat difilter dan diunduh.

## Fase 4: Pengalaman Guru

Status: **Sebagian besar fondasi tersedia**

Dashboard Guru kini menampilkan agenda sesi hari ini dan halaman kalender jadwal yang scoped ke kelas aktif Guru, termasuk status kelengkapan presensi dan progres serta shortcut input langsung. Form presensi juga menyediakan aksi bulk `Hadir Semua` dan autosave draft lokal sebelum penyimpanan. Form Guru menampilkan feedback field-level dari validasi API, form materi dan assessment memiliki preview lokal sebelum draft atau publish dikirim ke server, serta sesi dan ujian dapat diduplikasi sebagai template draft.

### Cakupan

- Kalender jadwal kelas.
- Agenda sesi hari ini.
- Prioritas sesi yang belum memiliki presensi/progres.
- Template sesi dan duplikasi ujian.
- Preview materi/assessment sebelum publish.
- Review dan koreksi nilai final.
- Bulk action presensi dengan shortcut hadir semua.
- Feedback field-level dan autosave draft form.
- Notifikasi pekerjaan guru yang tertunda.

### Acceptance Criteria

- Guru dapat menemukan pekerjaan hari ini maksimal dalam dua klik.
- Guru dapat menginput satu sesi tanpa kehilangan data jika ada kesalahan validasi.
- Guru dapat membedakan draft, published, needs review, dan final.
- Guru dapat mengoreksi nilai dengan alasan dan audit trail.

## Fase 5: Pengalaman Wali dan Anak

Status: **Sedang dikerjakan di repository**

### Cakupan

- Global child selector dengan opsi `Semua Anak`.
- Tugas online via akun wali.
- Autosave dan resume attempt.
- Network-loss warning.
- Countdown server-side.
- Status tugas: belum mulai, dikerjakan, menunggu review, final.
- Riwayat pembayaran dengan QR/copy instruction.
- Notifikasi tugas, nilai, progres, dan tagihan.
- Materi pembelajaran yang dapat dibaca wali.
- FAQ dan pusat bantuan.

### Implementation Plan 5.1: Online Exam Hardening

Status: **Selesai di repository**

Urutan implementasi:

1. Simpan draft jawaban pada `UjianAttempt` tanpa mencampurnya dengan `HasilUjian` final.
2. Tambahkan endpoint autosave yang memvalidasi ownership Wali, status attempt, expiry, dan ID soal.
3. Hydrate draft saat attempt dibuka kembali setelah reload/browser tertutup.
4. Tambahkan debounce autosave, indikator tersimpan/gagal, dan flush saat tab disembunyikan atau ditutup.
5. Tandai attempt yang melewati `expiresAt` sebagai `EXPIRED` sebelum dapat dilanjutkan.
6. Tambahkan integration/E2E coverage untuk persistensi, resume, expiry, dan isolasi role.

Acceptance awal:

- Jawaban yang sudah tersimpan muncul kembali setelah halaman direload.
- Draft tidak muncul sebagai nilai final sebelum submit.
- Wali lain tidak dapat membaca atau menulis draft attempt.
- Attempt yang sudah expired tidak dapat menerima autosave atau submit.
- Submit final tetap menjadi satu-satunya proses yang melakukan scoring.

### Implementation Plan 5.2: Connectivity and Timer Guard

Status: **Selesai di repository**

1. Tampilkan peringatan jelas saat browser kehilangan koneksi.
2. Tahan submit final selama offline agar status pengguna tidak ambigu.
3. Simpan ulang draft otomatis saat koneksi kembali.
4. Pertahankan countdown berbasis `expiresAt` server dan biarkan server menjadi sumber kebenaran expiry.
5. Tambahkan E2E coverage untuk transisi offline/online dan submit guard.

### Implementation Plan 5.3: Global Child Selector

Status: **Selesai di repository**

1. Sediakan pilihan `Semua Anak` dan anak tertentu pada dashboard shell Wali.
2. Persist pilihan secara lokal dan validasi ulang terhadap relasi Wali-Siswa di server.
3. Terapkan filter ke dashboard, progres, presensi, nilai, tugas, dan tagihan.
4. Pertahankan route detail dengan scoping authorization per `siswaId`.
5. Tambahkan E2E coverage untuk berpindah anak dan kembali ke semua anak.

### Implementation Plan 5.4: Wali Learning Materials

Status: **Selesai di repository**

1. Tampilkan materi berstatus `PUBLISHED` dari kelas anak yang terhubung.
2. Ikuti pilihan anak global atau tampilkan materi semua anak.
3. Dukung teks, video link, dan metadata file PDF/gambar.
4. Sediakan route file privat yang memvalidasi relasi Wali sebelum membaca storage.
5. Tambahkan E2E coverage untuk materi selected child dan akses file.

### Implementation Plan 5.5: Operational Notifications

Status: **Selesai di repository**

1. Buat helper notifikasi berdasarkan relasi aktif Wali-Siswa.
2. Kirim event saat ujian online dipublikasikan atau hasil nilai tersedia.
3. Kirim event saat guru menyimpan progres yang terlihat Wali.
4. Kirim event saat invoice baru dibuat atau instruksi pembayaran tersedia.
5. Pastikan event idempotent pada operasi yang dapat diulang dan tetap masuk retry queue provider.

### Implementation Plan 5.6: FAQ and Help Center

Status: **Selesai di repository**

1. Sediakan FAQ Wali dengan jawaban singkat untuk tugas, nilai, progres, materi, dan tagihan.
2. Jelaskan status `Belum`, `Sedang Dikerjakan`, `Menunggu Review`, dan `Selesai`.
3. Sediakan kanal kontak Admin tanpa klaim SLA yang belum disepakati.
4. Gunakan accordion native yang accessible dan mobile-friendly.

### Implementation Plan 5.7: Production Readiness Probe

Status: **Selesai di repository**

1. Pisahkan liveness probe dari readiness probe.
2. Readiness memeriksa environment, koneksi database, dan kemampuan private storage.
3. Kembalikan HTTP `503` jika dependency wajib belum siap.
4. Dokumentasikan penggunaan probe untuk Dokploy/staging tanpa mengklaim production-ready.

### Implementation Plan 5.8: Guru Data Safety and Assessment Hardening

Status: **Selesai di repository**

1. Pisahkan penyimpanan presensi dan progres agar satu form tidak mengubah domain data lain.
2. Batasi ringkasan dan mutation Guru pada kelas aktif yang benar-benar dikelola Guru.
3. Normalisasi skor ujian ke skala 0-100, batasi skor manual terhadap bobot soal, dan sediakan koreksi final dengan audit before/after.
4. Tambahkan origin check/rate limit upload, validasi URL media, dan perlindungan file sensitif siswa.
5. Tolak perubahan presensi/progres pada sesi final atau dibatalkan serta tampilkan form read-only.

### Implementation Plan 5.9: Guru Roster and Student History

Status: **Selesai di repository**

1. Tampilkan roster siswa aktif pada detail kelas Guru.
2. Sediakan pencarian berdasarkan nama atau nomor induk.
3. Tampilkan ringkasan presensi, progres, dan nilai dengan scoping kelas.
4. Sediakan histori per siswa dari roster tanpa membuka data kelas lain.

### Implementation Plan 5.10: Guru Server-side Pagination

Status: **Selesai di repository**

1. Tambahkan pagination server-side pada bank soal, ujian, hasil ujian, sesi, dan materi.
2. Pertahankan scope Guru pada setiap query dan endpoint.
3. Pertahankan opsi form builder lengkap ketika halaman daftar memakai pagination.
4. Sediakan kontrol pagination accessible yang mempertahankan parameter URL terkait.

### Acceptance Criteria

- Wali hanya melihat anak yang terhubung.
- Wali dapat berpindah anak tanpa kehilangan konteks.
- Attempt online dapat dilanjutkan setelah browser tertutup.
- Jawaban benar tidak pernah dikirim ke client sebelum submit.
- Hasil yang belum final tidak ditampilkan sebagai nilai final.
- Wali memahami status pembayaran dan langkah berikutnya.

## Fase 6: Konten dan Kurikulum

Status: **Menunggu sign-off akademik client**

### Cakupan

- Finalisasi program English dan Arabic.
- Level dan learning outcomes.
- Rubric speaking, writing, roleplay, dan esai.
- Template materi per sesi.
- Bank soal standar per level.
- Mapping CEFR/AKM/internal standard.
- Kalender akademik dan periode evaluasi.

### Acceptance Criteria

- Setiap level memiliki outcome dan assessment minimum.
- Guru menggunakan istilah dan rubric yang sama.
- Wali melihat label progres yang dapat dipahami non-akademik.

## Fase 7: Training dan Launch

Status: **Belum dimulai**

### Cakupan

- Training Admin.
- Training Guru.
- Panduan Wali.
- Video/FAQ singkat.
- UAT bersama owner LIMO.
- Pilot satu kelas.
- Review pilot dan perbaikan.
- Production launch.

### Acceptance Criteria

- Admin dapat menjalankan checklist operasional.
- Guru dapat membuat sesi, materi, presensi, progres, dan assessment.
- Wali dapat login, membaca laporan, membayar, dan mengerjakan tugas online.
- Semua blocker UAT ditutup atau memiliki keputusan tertulis.

## Dependency Client

- Kontak resmi dan jam layanan.
- Domain dan HTTPS.
- MariaDB production/staging.
- SMTP credentials.
- Mayar credentials, merchant ID, dan webhook URL.
- Struktur program, level, kelas, jadwal, dan tarif.
- Rubric serta konten assessment.
- Daftar user dan relasi wali-anak.
- Owner yang memberi sign-off UAT.

## Definition of Done

LIMO dapat dinyatakan siap digunakan client apabila:

- Fase 1 selesai di repository.
- Fase 2 selesai di staging.
- Fase 3 dan Fase 4 lulus UAT Admin/Guru.
- Fase 5 lulus UAT Wali.
- Fase 6 disetujui owner akademik.
- Backup/restore dan security regression lulus.
- Tidak ada credential demo atau kontak development di production.
- Owner LIMO menandatangani hasil UAT.
