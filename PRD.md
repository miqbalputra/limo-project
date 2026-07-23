# Product Requirements Document (PRD)
## Sistem Informasi Kursus LIMO — LMS & Manajemen Peserta Didik

| | |
|---|---|
| **Dokumen** | PRD-LIMO-LMS-001 |
| **Referensi** | SF-LMS-001/VI/2026 |
| **Klien** | LIMO — Little Moslems Language Club |
| **Vendor** | SistemFlow (Muhammad Iqbal Putra) |
| **Versi** | 3.0 — Single Next.js Application Architecture |
| **Tanggal** | 21 Juli 2026 |
| **Status** | Siap digunakan sebagai acuan implementasi, dengan beberapa keputusan bisnis terbuka pada Bagian 22 |

---

## 1. Ringkasan Eksekutif

LIMO membutuhkan sistem informasi terpadu untuk mengelola pendaftaran, data peserta didik, kelas, materi pembelajaran, ujian, presensi, progres belajar, dan pembayaran SPP untuk program Bahasa Inggris dan Bahasa Arab.

Sistem dibangun sebagai **satu aplikasi Next.js 16 App Router** yang menangani antarmuka pengguna sekaligus backend melalui **Route Handlers**. Express.js terpisah dihapus dari arsitektur karena kebutuhan aplikasi masih berada dalam batas yang aman untuk pola full-stack Next.js: satu produk, satu database, satu domain utama, skala ratusan pengguna aktif, dan deployment pada satu VPS.

Penggabungan ini mengurangi jumlah proses Node.js, konfigurasi CORS, duplikasi tipe data, proxy autentikasi, dan beban operasional. Keamanan tetap dijaga dengan pemisahan kode secara logis melalui Data Access Layer, service layer, policy/RBAC, validasi server, session cookie yang aman, pembatasan upload, verifikasi webhook, dan reverse proxy Nginx.

Pekerjaan yang tidak boleh bergantung pada lifecycle request web—seperti generate tagihan bulanan, penandaan tunggakan, retry notifikasi, dan pembersihan session/file sementara—dijalankan oleh **cron VPS atau systemd timer** yang memanggil script idempoten, bukan timer yang ditanam di proses Next.js.

---

## 2. Keputusan Arsitektur Utama

### 2.1 Keputusan

Arsitektur final menggunakan:

- **Next.js 16 App Router + React 19 + TypeScript**
- **TailAdmin Next.js** sebagai dasar dashboard
- **Route Handlers** pada `app/api/**/route.ts` untuk endpoint HTTP
- **Server Components** untuk pembacaan data pada halaman server-rendered
- **MariaDB + Prisma ORM**
- **Session berbasis database** melalui cookie `httpOnly`, bukan access/refresh JWT untuk browser
- **Nginx** sebagai reverse proxy, TLS termination, payload limit, dan rate limit lapisan pertama
- **PM2** untuk menjalankan satu proses aplikasi Next.js
- **Cron VPS/systemd timer** untuk pekerjaan terjadwal
- **Penyimpanan file privat** di luar folder `public`, dengan opsi migrasi ke object storage

### 2.2 Alasan Express.js Dihapus

Express terpisah tidak memberikan keuntungan yang sebanding untuk cakupan MVP ini karena:

1. Frontend dan backend dimiliki oleh satu aplikasi dan tidak membutuhkan proses scaling terpisah.
2. Tidak ada kebutuhan WebSocket, streaming real-time berumur panjang, atau API publik untuk banyak consumer eksternal.
3. Webhook, file download, CRUD, autentikasi, laporan, dan integrasi pembayaran dapat ditangani Route Handlers pada Node.js runtime.
4. Satu origin menyederhanakan cookie, CSRF, CORS, deployment, logging, dan troubleshooting.
5. Satu proses Node.js lebih hemat RAM pada VPS kecil.

### 2.3 Batas Keputusan

Arsitektur perlu ditinjau ulang jika kelak terjadi salah satu kondisi berikut:

- API digunakan oleh aplikasi mobile native atau banyak consumer eksternal.
- Dibutuhkan WebSocket dalam jumlah besar atau pekerjaan background intensif.
- Upload video besar harus diproses/transcode di server.
- Web dan API perlu diskalakan secara independen.
- Sistem berkembang menjadi multi-cabang/multi-tenant dengan beban jauh lebih besar.

---

## 3. Latar Belakang dan Masalah

- Pendaftaran, presensi, nilai, progres, dan pembayaran masih berpotensi tersebar di WhatsApp, formulir, kertas, dan spreadsheet.
- Wali murid belum memiliki satu tempat untuk memantau perkembangan anak.
- Guru membutuhkan alur input yang cepat dan ramah perangkat seluler.
- Admin membutuhkan dashboard operasional serta histori perubahan yang dapat ditelusuri.
- Dokumen pendaftaran berisi data sensitif dan tidak boleh tersedia melalui URL publik.
- Materi dan soal Bahasa Arab membutuhkan dukungan teks Right-to-Left (RTL).
- Pengelolaan dua aplikasi Node.js pada VPS kecil meningkatkan konsumsi resource dan kompleksitas operasional.

---

## 4. Tujuan Produk

1. Menyatukan proses administrasi dan pembelajaran LIMO dalam satu platform.
2. Mengurangi pekerjaan manual melalui approval terstruktur, auto-skoring, rekap, tagihan otomatis, dan notifikasi.
3. Memberikan visibilitas progres anak kepada wali murid sesuai hak akses.
4. Mempermudah pendaftaran calon siswa secara mandiri.
5. Menyediakan pencatatan pembayaran SPP yang konsisten dan dapat direkonsiliasi.
6. Menjaga dokumen siswa, nilai, dan data keuangan dari akses tidak sah.
7. Menyediakan pengalaman mobile-first yang dapat dipasang sebagai PWA.
8. Menurunkan kompleksitas deployment dengan satu aplikasi Next.js tanpa Express terpisah.

---

## 5. Sasaran dan Batas MVP

### 5.1 Sasaran MVP

- Mendukung minimal ratusan siswa aktif dalam satu lembaga.
- Mendukung tiga role internal: Admin, Guru, dan Wali Murid.
- Mendukung calon siswa sebagai pengguna publik tanpa akun.
- Mendukung satu wali untuk beberapa siswa dan satu siswa untuk beberapa wali.
- Mendukung histori perpindahan kelas.
- Mendukung materi PDF, tautan video, teks Inggris, dan teks Arab RTL.
- Mendukung ujian serta penilaian sesuai keputusan mode ujian pada Bagian 22.
- Mendukung tagihan, pembayaran, webhook, dan rekonsiliasi dasar.

### 5.2 Bukan Sasaran MVP

- Aplikasi mobile native.
- Multi-cabang atau multi-tenant.
- Live video conference.
- Payroll guru.
- Transcoding/hosting video besar pada VPS.
- Akuntansi lengkap, buku besar, pajak, atau invoice fiskal.
- Chat real-time antara guru dan wali.
- Integrasi biometrik atau perangkat presensi fisik.

---

## 6. Pengguna dan Hak Akses

| Role | Deskripsi | Akses Utama |
|---|---|---|
| **Admin** | Pengelola lembaga | Seluruh data operasional, approval, akun, kelas, keuangan, laporan, audit |
| **Guru** | Pengajar | Hanya kelas yang diampu, materi, soal, ujian, presensi, dan progres siswa dalam scope |
| **Wali Murid** | Orang tua/wali | Hanya data siswa yang terhubung: progres, nilai, presensi, tagihan, pembayaran |
| **Calon Siswa** | Pengguna publik | Informasi program, formulir pendaftaran, dan pengecekan status dengan kredensial terbatas |

### 6.1 Prinsip Otorisasi

- Menyembunyikan menu bukan mekanisme keamanan.
- Setiap operasi sensitif wajib memeriksa session, role, dan kepemilikan data di server.
- Guru tidak boleh mengakses kelas guru lain kecuali diberi penugasan eksplisit.
- Wali tidak boleh mengakses data siswa lain meskipun mengetahui ID atau URL.
- Admin dapat melakukan override, tetapi tindakan penting dicatat dalam audit log.
- Selector anak wajib tersedia bagi wali yang terhubung ke lebih dari satu siswa.

---

## 7. Ruang Lingkup Produk

## 7.1 Modul 01 — Landing Page dan Profil Website

**Fitur:**

- Hero, profil singkat, program Bahasa Inggris dan Arab.
- Keunggulan, jadwal/kategori program, testimoni, kontak, CTA pendaftaran.
- SEO dasar: metadata, sitemap, robots, favicon, Open Graph image.
- Halaman kebijakan privasi dan syarat penggunaan sederhana.
- Konten publik dapat dikelola melalui konfigurasi atau data terstruktur; CMS penuh tidak termasuk MVP.

**Acceptance criteria:**

- Halaman dapat dibuka tanpa autentikasi.
- Tampilan responsif dari lebar 360px.
- CTA mengarah ke formulir pendaftaran.
- Metadata sosial dan mesin pencari tersedia.

## 7.2 Modul 02 — Pendaftaran Online

**Fitur:**

- Form data calon siswa, wali, program, dan dokumen.
- Nomor/kode pendaftaran unik.
- Status: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `CANCELLED`.
- Penolakan wajib menyertakan alasan yang aman ditampilkan kepada calon siswa.
- Approval membuat data siswa dan relasi wali secara atomik.
- Pengecekan status menggunakan kombinasi kode pendaftaran dan verifikasi identitas yang memadai; tidak hanya ID berurutan.
- Notifikasi perubahan status melalui provider yang dipilih.

**Acceptance criteria:**

- Pengiriman ganda tidak membuat dua pendaftaran identik tanpa peringatan.
- Dokumen tidak dapat diakses melalui URL publik.
- Approval tidak menghasilkan siswa ganda ketika tombol diproses ulang.
- Semua perubahan status memiliki waktu dan pelaku.

## 7.3 Modul 03 — Data Peserta Didik

**Fitur:**

- CRUD siswa dan wali.
- Relasi many-to-many wali–siswa.
- Nomor induk internal unik.
- Histori status siswa dan perpindahan kelas.
- Filter program, level, kelas, status, dan periode masuk.
- Ekspor CSV untuk data non-sensitif sesuai hak akses.
- Arsip/soft delete untuk menjaga histori relasi.

## 7.4 Modul 04 — Akun, Session, dan Multi-Role Access

**Fitur:**

- Login, logout, reset password, perubahan password.
- Admin membuat akun Guru/Wali atau mengaktifkan akun dari approval pendaftaran.
- Session berbasis database dengan token acak yang hanya disimpan pada cookie aman.
- Penonaktifan akun dan pencabutan seluruh session.
- RBAC dan data scoping pada Data Access Layer/service.
- Audit tindakan administratif penting.

## 7.5 Modul 05 — LMS Materi Pembelajaran

**Fitur:**

- Materi per program, level, kelas, sesi/pertemuan.
- Tipe materi: teks, PDF, gambar pendukung, tautan video eksternal.
- Judul dan isi dapat berbahasa Inggris/Indonesia/Arab.
- Komponen Arab menggunakan `dir="rtl"`, alignment dan font yang sesuai.
- Draft/publish serta urutan materi.
- Hak akses berdasarkan kelas.

**Kebijakan upload MVP:**

- Dokumen pendaftaran: maksimal 10 MB per file.
- Materi PDF/gambar: maksimal 25 MB per file.
- Video tidak diunggah langsung ke VPS; gunakan tautan YouTube unlisted atau provider lain.
- Jika upload lebih besar dibutuhkan, gunakan object storage dengan direct upload, bukan buffering melalui proses Next.js.

## 7.6 Modul 06 — Bank Soal, Ujian, dan Penilaian

**Fitur inti:**

- Bank soal pilihan ganda dan esai.
- Opsi jawaban tersimpan terstruktur, bukan satu JSON besar yang sulit divalidasi.
- Soal dapat menggunakan teks Arab/RTL.
- Builder ujian, bobot soal, urutan, status draft/publish.
- Auto-skoring pilihan ganda.
- Antrian penilaian esai manual.
- Riwayat perubahan nilai dan finalisasi nilai.

**Mode MVP default:**

- Karena role Siswa belum termasuk scope, default implementasi adalah **guru memasukkan jawaban/hasil ujian yang dilaksanakan offline**.
- Fitur siswa mengerjakan ujian online dengan timer memerlukan keputusan tambahan: menambahkan role Siswa atau mekanisme exam session yang aman. Fitur tersebut tidak boleh dibangun diam-diam tanpa keputusan pada Bagian 22.

## 7.7 Modul 07 — Presensi Kehadiran

**Fitur:**

- Sesi/pertemuan kelas sebagai sumber presensi.
- Status: hadir, izin, sakit, alpa, terlambat.
- Input massal per kelas dan koreksi dengan audit.
- Rekap bulanan dan filter periode.
- Wali melihat presensi hanya untuk anak yang terhubung.

## 7.8 Modul 08 — Progres Belajar

**Fitur:**

- Catatan guru per siswa per sesi.
- Skor pemahaman 1–5.
- Kategori opsional: vocabulary, speaking, reading, writing, adab/partisipasi.
- Timeline progres.
- Catatan privat internal dapat dibedakan dari catatan yang terlihat wali.

## 7.9 Modul 09 — Grafik Progres

**Fitur:**

- Grafik nilai, kehadiran, dan skor pemahaman.
- Filter periode dan kelas.
- Ringkasan tren tanpa menyimpulkan diagnosis atau label terhadap siswa.
- Empty state ketika data belum cukup.
- Grafik tidak menjadi satu-satunya penyajian; sediakan angka/tabel ringkas untuk aksesibilitas.

## 7.10 Modul 10 — Tagihan dan Payment Gateway

**Fitur:**

- Generate tagihan bulanan oleh script terjadwal.
- Aturan nominal berdasarkan program/kelas atau tarif siswa.
- Jatuh tempo dan status `DRAFT`, `UNPAID`, `PENDING`, `PAID`, `OVERDUE`, `CANCELLED`, `REFUNDED` bila didukung.
- Pembuatan transaksi QRIS/VA melalui adapter Pakasir.
- Webhook pembayaran dengan verifikasi signature berdasarkan dokumentasi provider.
- Idempotency: webhook berulang tidak menggandakan pembayaran.
- Rekonsiliasi manual oleh Admin dengan alasan dan audit trail.
- Histori pembayaran wali.
- Reminder jatuh tempo dan tunggakan.

**Catatan:** biaya transaksi provider tidak menjadi konstanta PRD dan harus mengikuti kontrak/dokumentasi aktif saat integrasi.

---

## 8. Alur Bisnis Kritis

### 8.1 Pendaftaran hingga Menjadi Siswa

1. Calon siswa mengisi form dan mengunggah dokumen.
2. Sistem memvalidasi data dan membuat kode pendaftaran.
3. Admin meninjau data.
4. Jika ditolak, alasan wajib diisi dan notifikasi dikirim.
5. Jika disetujui, transaksi database membuat/menghubungkan User Wali, profil wali, Siswa, relasi wali–siswa, serta histori status.
6. Operasi approval bersifat idempoten.

### 8.2 Input Presensi dan Progres

1. Guru memilih kelas yang diampu.
2. Guru membuat atau memilih sesi kelas.
3. Sistem menampilkan siswa aktif pada tanggal sesi.
4. Guru menyimpan presensi dan progres.
5. Perubahan setelah finalisasi dicatat pada audit log.

### 8.3 Generate Tagihan

1. Cron memperoleh lock agar hanya satu job berjalan.
2. Sistem memilih siswa aktif yang memenuhi aturan billing.
3. Tagihan dibuat menggunakan unique constraint siswa + periode + jenis tagihan.
4. Pengulangan job aman dan tidak membuat duplikat.
5. Hasil job dicatat dalam `JobRun`.

### 8.4 Pembayaran via Webhook

1. Provider mengirim webhook.
2. Route Handler membaca raw payload satu kali.
3. Signature, timestamp, nominal, referensi, dan merchant diverifikasi.
4. Event dicek terhadap tabel idempotency.
5. Dalam transaksi database, pembayaran disimpan dan tagihan diperbarui.
6. Event notifikasi dibuat setelah transaksi berhasil.
7. Response 2xx dikirim setelah perubahan penting tersimpan durable.

---

## 9. Kebutuhan Non-Fungsional

| Aspek | Target/Kebutuhan |
|---|---|
| **Platform** | Web mobile-first dan installable sebagai PWA |
| **Performa halaman** | Halaman utama operasional ditargetkan dapat digunakan dalam <3 detik pada koneksi 4G wajar, di luar upload file |
| **Performa API** | p95 endpoint CRUD normal ditargetkan <800 ms pada beban MVP, di luar provider eksternal dan laporan berat |
| **Skalabilitas** | Ratusan siswa aktif, pagination wajib pada tabel besar |
| **Ketersediaan** | Target operasional wajar untuk satu VPS; bukan SLA enterprise |
| **Backup** | Database harian, retensi minimal 7 hari, backup off-server bila tersedia |
| **Restore** | Prosedur restore terdokumentasi dan diuji sebelum go-live |
| **Keamanan** | Session aman, RBAC, scoping, CSRF control, rate limit, validasi file, audit log, HTTPS |
| **Aksesibilitas** | Kontras memadai, keyboard-friendly, label form, tap target mobile, status tidak hanya mengandalkan warna |
| **Internasionalisasi** | Dukungan teks Arab RTL pada materi, soal, dan input terkait |
| **Observability** | Structured logging, request ID, health endpoint, error tracking opsional |
| **Timezone** | Seluruh aturan bisnis menggunakan `Asia/Jakarta`; timestamp database disimpan konsisten |
| **Privasi** | Data sensitif tidak masuk log, response, cache PWA, atau folder publik |

---

## 10. Arsitektur Teknis Final

### 10.1 Stack

| Layer | Teknologi | Keputusan |
|---|---|---|
| UI dan web server | Next.js 16 App Router, React 19, TypeScript | Satu aplikasi full-stack |
| Dashboard | TailAdmin Next.js | Diadaptasi, bukan di-clone ulang setelah development berjalan |
| Styling | Tailwind CSS v4 | Tema LIMO melalui token/CSS variables |
| HTTP backend | Next.js Route Handlers | `app/api/v1/**/route.ts`; tanpa Express |
| Business logic | TypeScript service layer | Tidak ditempatkan langsung dalam komponen/Route Handler |
| Data access | Repository/DAL + Prisma | Semua query sensitif melalui policy/scoping |
| Database | MariaDB 11 | Prisma provider `mysql` |
| Auth | Database session + secure cookie | Same-origin, revocable, tidak diekspos ke client JS |
| Validasi | Schema validation server-side | Satu schema dapat dipakai form dan Route Handler bila aman |
| File storage | Private local storage; object storage opsional | Tidak di `public/` |
| Jadwal | Cron VPS/systemd timer + script TypeScript | Idempoten dan memakai lock |
| Reverse proxy | Nginx | TLS, rate limit, payload limit, header security |
| Process manager | PM2 | Satu proses Next.js production |
| PWA | Manifest dan service worker | Cache statis/offline shell saja; data privat tidak dicache |

### 10.2 Alur

```text
Browser/PWA
    │ HTTPS, same origin
    ▼
Nginx
    │ TLS, rate limit, request size, security headers
    ▼
Next.js 16
    ├── Public pages
    ├── Dashboard per role
    ├── Server Components
    └── Route Handlers /api/v1/*
            │
            ├── validation + auth + policy
            ├── service layer
            ├── Prisma → MariaDB
            ├── private file storage
            └── provider adapters

Cron VPS/systemd timer
    └── TypeScript scripts → service layer → MariaDB/provider
```

### 10.3 Aturan Implementasi

- Route Handler harus tipis: parse request, validasi, autentikasi, panggil service, bentuk response.
- Business logic tidak boleh bergantung pada objek `Request`/`Response`.
- Server Components dapat memanggil DAL/service secara langsung; jangan melakukan HTTP fetch ke API sendiri tanpa alasan khusus.
- Client Components memanggil Route Handlers untuk mutation atau data interaktif.
- Semua file server-only diberi batas modul yang jelas dan tidak boleh masuk client bundle.
- Tidak menggunakan custom Express server.
- Gunakan Node.js runtime untuk endpoint Prisma, file, crypto, dan payment.

---

## 11. Desain Autentikasi dan Session

### 11.1 Model Session

- Setelah login berhasil, server membuat token acak dengan entropy tinggi.
- Browser menerima token melalui cookie `limo_session` dengan `HttpOnly`, `Secure`, `SameSite=Lax`, dan path `/`.
- Database hanya menyimpan hash token, `userId`, waktu dibuat, expiry, lastSeen, user agent ringkas, dan revokedAt.
- Logout mencabut session saat ini.
- Admin dapat mencabut semua session user.
- Session expired dibersihkan oleh script terjadwal.

### 11.2 Password

- Gunakan Argon2id; bcrypt dapat digunakan bila ada kendala kompatibilitas dengan parameter cost yang layak.
- Password plaintext tidak pernah disimpan atau dicatat.
- Reset token bersifat sekali pakai, disimpan dalam bentuk hash, dan memiliki masa berlaku pendek.

### 11.3 Otorisasi

- `proxy.ts` hanya boleh dipakai untuk redirect/optimistic check dan bukan satu-satunya pengaman.
- Pemeriksaan aman dilakukan pada DAL/service sebelum query atau mutation.
- Setiap fungsi service sensitif menerima actor/session context.
- Query wali selalu memasukkan relasi wali–siswa.
- Query guru selalu memasukkan penugasan kelas.

### 11.4 CSRF dan Origin

- Mutation berbasis cookie harus memverifikasi origin/host untuk request browser.
- Endpoint webhook menggunakan signature provider, bukan CSRF token.
- Endpoint publik yang tidak memakai session dilindungi validasi, rate limit, dan anti-automation sesuai kebutuhan.

---

## 12. Keamanan Aplikasi

### 12.1 Kontrol Wajib

- HTTPS pada seluruh trafik.
- Header keamanan: CSP yang diuji, `X-Content-Type-Options`, frame policy, referrer policy, dan permissions policy yang sesuai.
- Validasi input pada boundary HTTP dan business rule pada service.
- Parameterized query melalui Prisma.
- Rate limit Nginx dan application-level untuk login, status pendaftaran, upload, reset password, dan webhook.
- Pagination dan batas filter/range laporan.
- Error response tidak membocorkan stack trace, query, secret, atau path server.
- Structured log tidak menyimpan password, cookie, nomor dokumen lengkap, payload sensitif, atau signature.
- Dependency audit dan update terkontrol.

### 12.2 Keamanan File

- File privat berada di luar `public/` dan tidak disajikan oleh Nginx secara langsung.
- Nama file server menggunakan UUID/random ID, bukan nama asli sebagai path.
- Simpan nama asli hanya sebagai metadata yang telah disanitasi.
- Validasi ekstensi, MIME, magic bytes, dan ukuran.
- Tolak executable, HTML aktif, SVG tidak tepercaya, dan archive berisiko kecuali diperlukan.
- File download melewati authorization dan menggunakan `Content-Disposition` aman.
- Folder upload tidak memiliki izin eksekusi.

### 12.3 Keamanan Webhook

- Gunakan raw body untuk verifikasi sesuai spesifikasi provider.
- Bandingkan signature secara timing-safe.
- Verifikasi merchant/project, nominal, currency, external reference, dan status.
- Terapkan toleransi timestamp/replay bila provider menyediakannya.
- Simpan event ID/hash unik untuk idempotency.
- Jangan menandai tagihan lunas hanya karena parameter redirect browser.

### 12.4 PWA dan Cache

- Service worker hanya melakukan cache aset statis, halaman publik tertentu, dan offline fallback.
- Response `/api/**`, dashboard authenticated, dokumen, nilai, presensi, tagihan, dan data pengguna tidak boleh disimpan dalam cache persisten.
- Logout menghapus cache aplikasi yang berpotensi mengandung data user.

---

## 13. Gambaran Model Data

Model final disusun di Prisma dan minimal mencakup:

### 13.1 Identity dan Audit

- `User`
- `Session`
- `PasswordResetToken`
- `GuruProfile`
- `WaliProfile`
- `AuditLog`

### 13.2 Akademik

- `Program`
- `Level`
- `Siswa`
- `WaliSiswa`
- `Kelas`
- `KelasSiswa` untuk histori enrollment/mutasi
- `SesiKelas`
- `Materi`
- `FileAsset`
- `Presensi`
- `ProgresBelajar`

### 13.3 Pendaftaran

- `Pendaftaran`
- `DokumenPendaftaran` atau relasi ke `FileAsset`
- `RiwayatStatusPendaftaran`

### 13.4 Ujian

- `BankSoal`
- `OpsiSoal`
- `Ujian`
- `UjianSoal`
- `HasilUjian`
- `JawabanUjian`
- `RiwayatNilai` bila koreksi nilai perlu diaudit terpisah

### 13.5 Keuangan dan Integrasi

- `Tarif`
- `Tagihan`
- `Pembayaran`
- `WebhookEvent`
- `Notifikasi`
- `NotificationDelivery`
- `JobRun`

### 13.6 Constraint Penting

- Email user unik dengan normalisasi lowercase.
- Nomor induk siswa unik.
- Enrollment aktif tidak boleh duplikat untuk siswa dan kelas yang sama.
- Presensi unik per siswa dan sesi.
- Progres dapat dibatasi unik per siswa, sesi, dan kategori sesuai desain.
- Tagihan unik per siswa, periode, dan jenis tagihan.
- Referensi transaksi provider unik.
- Event webhook/provider event ID unik.
- Nilai uang menggunakan tipe decimal, bukan floating point.
- Semua tabel penting memiliki `createdAt`, `updatedAt`, dan actor/audit yang relevan.

---

## 14. Kontrak API Internal

### 14.1 Konvensi

- Prefix: `/api/v1`.
- JSON response konsisten.
- Status HTTP digunakan dengan benar.
- Error memiliki `code`, pesan aman, dan `requestId`.
- Input list memakai pagination, filter yang dibatasi, dan sorting allowlist.
- Mutation penting menerima idempotency key atau dilindungi unique constraint.

### 14.2 Kelompok Endpoint

- `/api/v1/auth/*`
- `/api/v1/pendaftaran/*`
- `/api/v1/admin/siswa/*`
- `/api/v1/admin/kelas/*`
- `/api/v1/guru/kelas/*`
- `/api/v1/materi/*`
- `/api/v1/ujian/*`
- `/api/v1/presensi/*`
- `/api/v1/progres/*`
- `/api/v1/tagihan/*`
- `/api/v1/pembayaran/*`
- `/api/v1/files/*`
- `/api/v1/webhooks/pakasir`
- `/api/health` dan endpoint readiness internal bila diperlukan

API ini terutama untuk aplikasi LIMO sendiri. Dokumentasi OpenAPI penuh bersifat opsional untuk MVP, tetapi daftar endpoint dan schema input/output harus terdokumentasi dalam repository.

---

## 15. Integrasi Eksternal

| Integrasi | Fungsi | Prinsip Implementasi |
|---|---|---|
| **Pakasir** | QRIS/VA dan notifikasi pembayaran | Adapter terisolasi, signature verification, idempotency, timeout, retry terkontrol |
| **Email/WhatsApp** | Status pendaftaran dan pembayaran | Interface provider; provider dapat diganti tanpa mengubah business logic |
| **Video eksternal** | Materi video | Simpan URL tervalidasi; tidak melakukan download/transcode di server |
| **Object storage opsional** | File privat atau upload besar | Private bucket, signed URL, lifecycle dan backup yang jelas |

---

## 16. Desain dan Branding

### 16.1 Palet

| Warna | Hex | Penggunaan |
|---|---|---|
| Biru utama | `#2372B8` | Primary action, navigation, sidebar |
| Biru muda | `#94D3F2` | Informational accent/background |
| Merah | `#F73F3D` | Error/overdue, tidak menjadi satu-satunya indikator |
| Kuning | `#F9E06C` | Highlight/peringatan ringan |
| Hijau | `#09C467` | Sukses/lunas/hadir/disetujui |
| Netral | `#F3F3F3` | Background |

### 16.2 UI Principles

- Landing page boleh lebih playful; dashboard mengutamakan keterbacaan.
- Gunakan token tema/CSS variables agar perubahan tidak tersebar.
- Tabel kompleks tetap memiliki versi card/list yang usable di mobile.
- Form utama memiliki autosave/draft hanya bila benar-benar diperlukan.
- Konfirmasi khusus untuk aksi destructive dan perubahan status penting.
- Semua teks Arab diuji dengan konten nyata, bukan placeholder Latin.

---

## 17. Peta Halaman

| Area | Halaman |
|---|---|
| Publik | Landing, Program, Daftar, Status Pendaftaran, Kebijakan Privasi |
| Auth | Login, Lupa Password, Reset Password |
| Admin | Dashboard, Pendaftaran, Siswa, Wali, Guru, Program/Level, Kelas, Jadwal/Sesi, Tagihan, Pembayaran, User, Audit |
| Guru | Dashboard, Kelas Saya, Sesi, Materi, Bank Soal, Ujian, Presensi, Progres, Penilaian Esai |
| Wali | Dashboard Anak, Progres, Presensi, Nilai, Materi yang diizinkan, Tagihan, Pembayaran, Profil |

---

## 18. Testing dan Quality Assurance

### 18.1 Unit Test

- Kalkulasi nilai pilihan ganda.
- Aturan generate tagihan.
- Penentuan overdue.
- Policy/scoping guru dan wali.
- Normalisasi data dan status transition.
- Signature verification helper menggunakan fixture aman.

### 18.2 Integration Test

- Auth dan session dengan database test.
- Approval pendaftaran atomik dan idempoten.
- File authorization.
- Presensi dan progres.
- Webhook berulang, nominal salah, signature salah, dan replay.
- Cron dijalankan dua kali tanpa duplikasi.

### 18.3 End-to-End Test

- Login tiga role.
- Pendaftaran hingga approval/rejection.
- Guru hanya melihat kelas sendiri.
- Wali hanya melihat anak sendiri.
- Input presensi dan progres.
- Pembuatan tagihan dan simulasi pembayaran.
- PWA basic install/offline shell.

### 18.4 Security Regression

- IDOR pada siswa, file, hasil ujian, dan tagihan.
- CSRF pada mutation berbasis cookie.
- Brute-force login/status lookup.
- Upload file tidak valid.
- Open redirect.
- Sensitive data pada cache/log/response.

---

## 19. Deployment dan Operasional

### 19.1 Environment

- Development: lokal, MariaDB via Docker Compose.
- Staging: direkomendasikan minimal selama UAT; boleh berada pada VPS yang sama dengan database terpisah bila resource cukup.
- Production: satu Next.js server di belakang Nginx.

### 19.2 Production Topology

```text
Internet → Nginx :443 → Next.js :3000 → MariaDB :3306 (private/local)
                         │
                         └── private storage path
Cron/systemd timer → scripts/* → MariaDB/provider
```

### 19.3 Operational Requirements

- MariaDB tidak diekspos ke internet.
- `.env` production hanya dapat dibaca user service.
- PM2 menjalankan satu instance terlebih dahulu untuk mencegah masalah lock/cron/cache yang tidak perlu.
- Graceful shutdown dan health check tersedia.
- Backup database harian dengan rotasi minimal 7 hari.
- Backup file privat disertakan atau file dipindah ke storage yang memiliki durability memadai.
- Restore drill dilakukan sebelum serah terima.
- Deployment memiliki langkah migrasi, build, restart, health check, dan rollback.

---

## 20. Metrik Keberhasilan

- Mayoritas pendaftaran baru masuk melalui sistem.
- Admin tidak membutuhkan spreadsheet terpisah untuk rekap inti siswa, presensi, nilai, dan tagihan.
- Guru dapat menyelesaikan presensi satu kelas melalui HP tanpa alur yang berlebihan.
- Wali dapat menemukan progres, presensi, dan tagihan anak dalam maksimal beberapa navigasi sederhana.
- Webhook pembayaran tidak menghasilkan duplikasi dan dapat direkonsiliasi.
- Tidak ada akses lintas wali/guru pada pengujian scoping.
- Backup dan prosedur restore berhasil diuji.
- Tidak ada dokumen siswa yang tersedia langsung melalui folder publik.

---

## 21. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Scope 10 modul terlalu besar untuk timeline/biaya | Kualitas dan testing berkurang | Prioritaskan alur inti, gunakan keputusan default, hindari fitur tambahan tanpa change request |
| Upload besar membebani RAM/disk | Aplikasi lambat/crash | Batas file ketat, video eksternal, direct object-storage upload bila perlu |
| Cron tertanam di proses web berjalan ganda/terlewat | Tagihan duplikat/hilang | Cron VPS + lock + unique constraint + `JobRun` |
| Session/RBAC hanya dicek di UI/proxy | Kebocoran data | Policy di DAL/service dan test IDOR |
| Webhook palsu/berulang | Tagihan salah | Signature, raw body, idempotency, validasi nominal dan merchant |
| PWA menyimpan data privat | Kebocoran pada perangkat bersama | Tidak cache authenticated API/page, purge saat logout |
| Penyimpanan lokal hilang saat kerusakan VPS | Kehilangan dokumen | Backup off-server atau object storage privat |
| Kebijakan billing belum final | Rework | Konfigurasi rule dan keputusan tertulis sebelum fase pembayaran |
| Mode ujian tidak konsisten dengan role | Rework besar | Default offline teacher-entry; online exam melalui change decision |
| Provider notifikasi belum dipilih | Modul tertunda | Provider interface + email/console dev; kredensial final sebelum UAT |

---

## 22. Keputusan Bisnis yang Masih Terbuka

Keputusan berikut harus disetujui. Agar implementasi tidak berhenti, digunakan default yang tertulis sampai ada keputusan lain.

| Keputusan | Default Implementasi | Dampak jika Berubah |
|---|---|---|
| Kanal notifikasi | Email sebagai jalur awal; adapter WhatsApp disiapkan | Kredensial, template, biaya provider |
| Tagihan siswa masuk tengah bulan | Mulai ditagih pada periode penuh berikutnya, tanpa prorate | Logic billing dan komunikasi wali |
| Mode ujian | Offline, guru menginput jawaban/hasil | Online memerlukan akses Siswa dan tambahan keamanan/UI |
| Domain | Satu domain; API berada di `/api` | Tidak ada CORS dan cookie lintas subdomain |
| Penyimpanan file | Private filesystem VPS dengan backup | Object storage membutuhkan credential dan migrasi |
| Staging | Staging ringan direkomendasikan | Membutuhkan resource/subdomain tambahan |

---

## 23. Ketentuan Proyek

- Biaya, cicilan, revisi minor, dan garansi mengikuti proposal/kontrak yang berlaku.
- Materi, soal, data siswa, logo, dan konten resmi disediakan LIMO.
- Perubahan keputusan setelah fase terkait selesai dapat dikategorikan sebagai change request.
- Hosting, domain, biaya provider, dan maintenance setelah masa garansi tidak otomatis termasuk kecuali dinyatakan dalam kontrak.

---

## 24. Definition of Done Produk

Sistem dinyatakan siap serah terima jika:

- Seluruh acceptance criteria prioritas MVP lulus.
- Tidak ada temuan kritis pada auth, scoping, file access, atau webhook.
- Migration production berhasil pada salinan database/staging.
- Backup dan restore telah diuji.
- Admin, Guru, dan Wali menyelesaikan skenario UAT utama.
- Dokumen deployment, environment, akun awal, dan operasional tersedia.
- Training dasar selesai.
- Open decision yang memblokir fungsi production telah ditutup atau dicatat sebagai pengecualian yang disetujui.

---

*PRD v3.0 menetapkan arsitektur satu aplikasi Next.js App Router dengan Route Handlers. Express.js terpisah tidak digunakan pada MVP, sementara pekerjaan terjadwal tetap dijalankan di luar lifecycle request melalui cron VPS/systemd timer.*
