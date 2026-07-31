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
- Pakasir sandbox UAT: create, payment, webhook, reconcile.
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

Status: **MVP tersedia, perlu hardening**

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
- Pakasir credentials dan webhook URL.
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
