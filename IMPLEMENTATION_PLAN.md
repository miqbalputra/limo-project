# Rencana Implementasi Bertahap — Sistem LIMO
## Panduan Eksekusi untuk Coding Agent

| | |
|---|---|
| **Acuan** | `PRD.md` versi 3.0 |
| **Arsitektur** | Satu aplikasi Next.js 16 App Router; tanpa Express terpisah |
| **Database** | MariaDB 11 + Prisma |
| **Deployment** | Nginx + PM2 + cron/systemd timer pada VPS |
| **Tanggal** | 21 Juli 2026 |

Dokumen ini memecah PRD menjadi langkah implementasi yang dapat dieksekusi berurutan. Coding agent wajib menyelesaikan verifikasi dan test pada setiap fase sebelum melanjutkan.

---

## 1. Keputusan dan Guardrail Arsitektur

### 1.1 Keputusan Final

- Gunakan **Next.js App Router Route Handlers**, bukan Pages Router API Routes.
- Jangan membuat aplikasi Express, custom server Express, atau subdomain API terpisah.
- Gunakan satu origin: halaman dan API berada di domain yang sama; endpoint di `/api/v1`.
- Gunakan Node.js runtime untuk Route Handler yang mengakses Prisma, filesystem, crypto, dan payment provider.
- Gunakan satu proses Next.js production di PM2 pada MVP.
- Pekerjaan terjadwal dijalankan melalui cron VPS/systemd timer yang mengeksekusi script TypeScript/JavaScript terpisah.

### 1.2 Aturan Layering

```text
Route Handler / Server Component / Script
                │
                ▼
        Application Service
                │
        ┌───────┼────────┐
        ▼       ▼        ▼
      Policy   Repository Provider Adapter
                │
                ▼
              Prisma
```

- Route Handler tidak boleh berisi business logic panjang.
- Service tidak boleh menerima `Request`, `Response`, atau objek framework.
- Repository/DAL bertanggung jawab atas query dan data scoping.
- Policy memeriksa role dan ownership.
- Provider adapter membungkus Mayar/notifikasi/storage.
- Server Component boleh memanggil DAL/service langsung; jangan fetch ke API aplikasi sendiri hanya untuk membaca data server-side.
- Client Component hanya menerima data minimum dan menggunakan API untuk mutation/interaksi dinamis.

### 1.3 Larangan

- Jangan menyimpan secret dengan prefix `NEXT_PUBLIC_`.
- Jangan menyimpan auth token di `localStorage`/`sessionStorage`.
- Jangan menyimpan dokumen siswa di `public/`.
- Jangan menggunakan `request.formData()` untuk upload besar tanpa mempertimbangkan buffering dan limit.
- Jangan memakai `node-cron` di dalam proses web untuk tagihan bulanan.
- Jangan mengandalkan `proxy.ts` atau hidden menu sebagai satu-satunya otorisasi.
- Jangan melakukan update tagihan dari redirect browser; hanya dari hasil verifikasi API/webhook atau rekonsiliasi admin.
- Jangan cache response authenticated di service worker.

---

## 2. Struktur Repository Target

Gunakan satu repository dan satu aplikasi:

```text
limo-system/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx
│   │   │   ├── daftar/page.tsx
│   │   │   └── status-pendaftaran/page.tsx
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── lupa-password/page.tsx
│   │   │   └── reset-password/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── admin/
│   │   │   ├── guru/
│   │   │   └── wali/
│   │   ├── api/
│   │   │   ├── health/route.ts
│   │   │   └── v1/
│   │   │       ├── auth/
│   │   │       ├── pendaftaran/
│   │   │       ├── admin/
│   │   │       ├── guru/
│   │   │       ├── wali/
│   │   │       ├── files/
│   │   │       └── webhooks/mayar/route.ts
│   │   ├── manifest.ts
│   │   ├── sitemap.ts
│   │   └── robots.ts
│   ├── components/
│   │   ├── ui/
│   │   ├── dashboard/
│   │   └── forms/
│   ├── server/
│   │   ├── auth/
│   │   ├── db/
│   │   ├── dal/
│   │   ├── policies/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── providers/
│   │   │   ├── payment/
│   │   │   ├── notification/
│   │   │   └── storage/
│   │   ├── validation/
│   │   ├── errors/
│   │   ├── logging/
│   │   └── security/
│   ├── lib/
│   └── types/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── scripts/
│   ├── generate-monthly-invoices.ts
│   ├── mark-overdue-invoices.ts
│   ├── retry-notifications.ts
│   ├── cleanup-expired-sessions.ts
│   └── verify-storage.ts
├── storage/
│   ├── .gitkeep
│   └── README.md
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docker-compose.yml
├── ecosystem.config.cjs
├── next.config.ts
├── package.json
├── .env.example
└── README.md
```

`storage/` pada repository hanya menjadi placeholder development. Path production harus dikonfigurasi melalui environment dan berada di direktori privat dengan permission yang benar.

---

## 3. Standar Teknis Bersama

### 3.1 TypeScript dan Code Quality

- Aktifkan strict TypeScript.
- Hindari `any`; gunakan `unknown` pada boundary lalu validasi.
- ESLint dan formatter harus lulus sebelum merge.
- Gunakan path alias yang jelas.
- Gunakan `server-only` pada modul yang tidak boleh masuk client bundle.
- Semua status bisnis menggunakan enum terpusat.

### 3.2 API Response

Contoh response sukses:

```json
{
  "data": {},
  "meta": {
    "requestId": "..."
  }
}
```

Contoh error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Data yang dikirim belum valid",
    "fields": {}
  },
  "meta": {
    "requestId": "..."
  }
}
```

Jangan mengirim stack trace atau pesan database ke client.

### 3.3 Database

- Provider Prisma: `mysql` untuk MariaDB.
- Gunakan migration, bukan `db push`, untuk environment bersama/production.
- Gunakan transaksi pada approval pendaftaran, payment webhook, dan operasi lintas tabel.
- Uang menggunakan `Decimal`.
- Timestamp bisnis diproses dengan timezone `Asia/Jakarta`; penyimpanan dibuat konsisten.
- Tambahkan index berdasarkan query list/filter nyata.
- Semua list menggunakan pagination.

### 3.4 Security Baseline

- Session cookie: `HttpOnly`, `Secure` di production, `SameSite=Lax`, path `/`.
- Password Argon2id; fallback bcrypt dengan cost yang memadai.
- Origin validation untuk mutation berbasis cookie.
- Nginx dan aplikasi melakukan rate limit pada endpoint rawan.
- CSP dan security headers dikonfigurasi setelah daftar sumber eksternal diketahui.
- Audit log untuk approval, perubahan role, koreksi nilai, rekonsiliasi pembayaran, dan akses file sensitif bila diperlukan.

---

# Fase 0 — Audit Template dan Baseline Proyek

## Tujuan

Membuat baseline yang stabil tanpa membawa arsitektur Express lama.

## Langkah

1. Clone atau gunakan repository TailAdmin Next.js terbaru yang kompatibel dengan Next.js 16.
2. Hapus metadata Git bawaan template bila memulai repository baru.
3. Jalankan install tanpa `--legacy-peer-deps` terlebih dahulu; gunakan flag tersebut hanya jika benar-benar diperlukan dan dokumentasikan alasan.
4. Catat versi Node.js dan package manager pada `engines`/README.
5. Hapus halaman demo yang tidak dipakai secara bertahap, tetapi pertahankan komponen yang berguna.
6. Tambahkan `.env.example` tanpa secret.
7. Tambahkan Docker Compose MariaDB development.
8. Tambahkan `/api/health` yang hanya mengembalikan status aplikasi; readiness database dapat dibuat terpisah dan tidak perlu dibuka publik.
9. Setup test runner, Playwright, ESLint, dan TypeScript check.
10. Buat README berisi setup lokal, migration, seed, test, dan run.

## Verifikasi

- `npm run dev` menampilkan TailAdmin.
- `npm run lint`, `npm run typecheck`, dan test kosong/baseline lulus.
- MariaDB development berjalan.
- `/api/health` mengembalikan 200.
- Tidak ada folder `apps/api`, dependency Express, CORS, Multer, atau node-cron.

---

# Fase 1 — Foundation Server, Environment, dan Observability

## Tujuan

Membuat fondasi server yang konsisten sebelum menulis modul bisnis.

## Langkah

1. Buat loader environment yang memvalidasi variable saat startup/runtime.
2. Buat singleton Prisma yang aman untuk hot reload development.
3. Buat logger structured dengan redaction field sensitif.
4. Buat request ID dan sertakan pada log/response.
5. Buat kelas error/domain error: validation, unauthorized, forbidden, not found, conflict, rate limited, provider error.
6. Buat helper response untuk Route Handler.
7. Buat validation schema bersama untuk pagination, ID, tanggal, dan upload metadata.
8. Buat utility timezone `Asia/Jakarta` dan dilarang memakai perhitungan tanggal ad hoc tersebar.
9. Buat modul security untuk origin check, timing-safe compare, hash token, dan sanitasi filename.
10. Tambahkan `instrumentation.ts` atau hook observability sesuai kebutuhan.

## Environment Minimum

```dotenv
NODE_ENV=development
APP_URL=http://localhost:3000
DATABASE_URL=mysql://limo:limo@localhost:3306/limo_db
SESSION_SECRET=replace-with-random-secret
SESSION_COOKIE_NAME=limo_session
PRIVATE_STORAGE_PATH=./storage/private
MAX_REGISTRATION_FILE_MB=10
MAX_MATERIAL_FILE_MB=25
MAYAR_ENV=sandbox
MAYAR_API_KEY=
MAYAR_MERCHANT_ID=
MAYAR_WEBHOOK_SECRET=
NOTIFICATION_PROVIDER=console
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
```

Tidak semua variable provider harus diisi pada development; adapter `console` dipakai untuk notifikasi lokal.

## Verifikasi

- Aplikasi gagal dengan pesan aman ketika environment wajib tidak valid.
- Log memiliki request ID dan tidak mencetak cookie/secret.
- Error yang dilempar service berubah menjadi response HTTP konsisten.
- Prisma tidak membuat banyak connection pool pada hot reload.

---

# Fase 2 — Prisma Schema, Migration, dan Seed

## Tujuan

Menyediakan model data yang mendukung histori, scoping, idempotency, dan audit.

## Model Minimum

### Identity

- `User`
- `Session`
- `PasswordResetToken`
- `GuruProfile`
- `WaliProfile`
- `AuditLog`

### Pendaftaran dan Akademik

- `Program`
- `Level`
- `Pendaftaran`
- `RiwayatStatusPendaftaran`
- `Siswa`
- `WaliSiswa`
- `Kelas`
- `KelasSiswa`
- `SesiKelas`
- `FileAsset`
- `Materi`
- `Presensi`
- `ProgresBelajar`

### Ujian

- `BankSoal`
- `OpsiSoal`
- `Ujian`
- `UjianSoal`
- `HasilUjian`
- `JawabanUjian`

### Keuangan dan Integrasi

- `Tarif`
- `Tagihan`
- `Pembayaran`
- `WebhookEvent`
- `Notifikasi`
- `NotificationDelivery`
- `JobRun`

## Constraint Wajib

- Unique normalized email.
- Unique nomor induk siswa.
- Unique presensi `(siswaId, sesiKelasId)`.
- Unique tagihan `(siswaId, periode, jenis)`.
- Unique provider reference/event ID.
- Foreign key dan delete behavior eksplisit.
- Soft delete hanya pada model yang memerlukan histori; jangan diterapkan tanpa aturan query.
- Status transition tidak hanya bergantung pada enum database; validasi di service.

## Seed

- Satu Admin development.
- Program Bahasa Inggris dan Bahasa Arab.
- Beberapa level dan kelas dummy.
- Satu Guru, satu Wali, dan dua Siswa yang terhubung untuk menguji child selector.
- Jangan memakai password production pada seed.

## Verifikasi

- Migration dari database kosong berhasil.
- Seed berhasil dan idempoten atau memiliki instruksi reset yang jelas.
- Prisma Studio menunjukkan relasi yang benar.
- Test constraint duplikasi tagihan, presensi, dan webhook lulus.

---

# Fase 3 — Authentication, Session, RBAC, dan Data Access Layer

## Tujuan

Membangun keamanan akses sebelum modul data sensitif.

## Langkah

1. Implementasikan password hashing dan verification.
2. Implementasikan database session:
   - generate token acak;
   - simpan hash token;
   - kirim raw token hanya di cookie;
   - lookup session dan user aktif;
   - expiry dan revoke.
3. Endpoint:
   - `POST /api/v1/auth/login`
   - `POST /api/v1/auth/logout`
   - `GET /api/v1/auth/me`
   - `POST /api/v1/auth/forgot-password`
   - `POST /api/v1/auth/reset-password`
4. Implementasikan login throttling.
5. Implementasikan `getCurrentActor`, `requireActor`, `requireRole`.
6. Buat policy:
   - `canManageUsers`
   - `canAccessStudent`
   - `canManageClass`
   - `canAccessInvoice`
   - `canDownloadFile`
7. Buat DAL untuk query per role; jangan mengirim seluruh user object ke client.
8. `proxy.ts` hanya melakukan redirect awal berdasarkan keberadaan session secara optimistik. Semua service tetap memvalidasi session/role.
9. Buat halaman login, logout, forgot/reset password dari komponen TailAdmin.
10. Tambahkan audit untuk login gagal berulang, perubahan role, deactivate user, dan revoke session sesuai kebutuhan.

## Session Defaults

- Masa berlaku absolut dan idle timeout dibuat configurable.
- Session dirotasi setelah login dan perubahan password.
- Perubahan password mencabut session lain.
- User nonaktif tidak dapat memakai session lama.

## Test Wajib

- Login benar/salah.
- Cookie tidak dapat dibaca client JS.
- Session expired/revoked.
- Wali mencoba ID siswa lain → 403/404 aman.
- Guru mencoba kelas lain → 403/404 aman.
- Admin dapat mengakses scope yang diizinkan.
- Proxy dilewati secara langsung tetapi service tetap aman.

## Exit Criteria

Tidak ada modul berikutnya yang boleh mengakses data sensitif sebelum test scoping lulus.

---

# Fase 4 — Branding, Layout, dan Navigation per Role

## Tujuan

Membuat shell aplikasi yang konsisten dan tidak mencampur akses role.

## Langkah

1. Definisikan design tokens LIMO di CSS variables/Tailwind.
2. Ganti logo, favicon, app icon, dan metadata.
3. Buat layout publik, auth, dan dashboard terpisah.
4. Buat navigation config per role.
5. Tambahkan child selector untuk Wali.
6. Buat komponen standar:
   - page header;
   - breadcrumb;
   - status badge dengan ikon/teks;
   - responsive table/card;
   - empty/error/loading state;
   - confirmation dialog;
   - form field RTL.
7. Pastikan hidden menu tidak dianggap authorization.
8. Uji mobile 360px dan keyboard navigation.

## Verifikasi

- Admin, Guru, dan Wali melihat menu berbeda.
- Direct URL tetap dijaga server-side.
- Tema LIMO konsisten tanpa mengubah banyak file komponen satu per satu.
- Teks Arab contoh tampil benar.

---

# Fase 5 — Landing Page dan Pendaftaran Online

## Tujuan

Menyelesaikan alur publik sampai approval admin.

## API/Actions

- `POST /api/v1/pendaftaran`
- `POST /api/v1/pendaftaran/:id/files`
- `GET /api/v1/pendaftaran/status`
- `GET /api/v1/admin/pendaftaran`
- `GET /api/v1/admin/pendaftaran/:id`
- `POST /api/v1/admin/pendaftaran/:id/approve`
- `POST /api/v1/admin/pendaftaran/:id/reject`

Gunakan pola path Next.js yang sesuai, misalnya folder dinamis `[id]`.

## Upload Strategy

1. Endpoint menggunakan Node.js runtime.
2. Terapkan limit di Nginx dan aplikasi.
3. Validasi content length bila tersedia, lalu validasi bytes aktual.
4. Untuk file MVP kecil, gunakan parser yang mendukung streaming atau implementasi yang tidak menggandakan seluruh file di memori.
5. Simpan ke temporary path, validasi, lalu atomic move ke private storage.
6. Buat `FileAsset` setelah file tersimpan aman; rollback/hapus file jika transaksi metadata gagal.
7. Simpan checksum bila berguna untuk integrity/dedup.
8. Download file melalui endpoint authorized, bukan static URL.

## Approval Service

Dalam satu transaksi:

- lock/cek status pendaftaran;
- buat atau hubungkan user wali;
- buat profil wali bila belum ada;
- buat siswa;
- buat relasi wali–siswa;
- catat status/history/audit;
- buat event notifikasi.

Jika endpoint dipanggil ulang pada pendaftaran yang sudah approved, response harus konsisten dan tidak menggandakan data.

## Anti-Abuse

- Rate limit form dan status lookup.
- Gunakan honeypot atau challenge adaptif bila spam terjadi.
- Status lookup tidak boleh mengungkap data berdasarkan ID saja.
- Pesan error email terdaftar/tidak terdaftar jangan mempermudah enumerasi.

## Test Wajib

- File terlalu besar, MIME palsu, ekstensi terlarang.
- Approval dua kali.
- Reject tanpa alasan.
- Status lookup brute force/rate limit.
- File diakses oleh role yang tidak berhak.
- Approval menghasilkan relasi Wali–Siswa yang benar.

## Exit Criteria

Alur `submit → review → approve/reject → notification record` lulus E2E.

---

# Fase 6 — Data Siswa, Wali, Guru, Program, Level, dan Kelas

## Tujuan

Menyelesaikan master data serta histori enrollment.

## Langkah

1. CRUD Program dan Level dengan validasi penggunaan.
2. CRUD Guru dan penugasan kelas.
3. CRUD Siswa dan Wali.
4. Kelola relasi wali–siswa.
5. Buat kelas, jadwal, status, dan guru pengampu.
6. Gunakan `KelasSiswa` untuk enrollment dan mutasi; jangan hanya menyimpan `kelasId` pada siswa.
7. Mutasi menutup enrollment lama dan membuat enrollment baru dalam transaksi.
8. List menggunakan server-side pagination/filter/sort allowlist.
9. Export CSV hanya field yang disetujui dan tidak menyertakan dokumen/password/session.
10. Tambahkan dashboard count menggunakan query agregat yang efisien.

## Test Wajib

- Wali memiliki dua anak dan selector bekerja.
- Siswa memiliki dua wali.
- Mutasi menjaga histori.
- Guru hanya melihat siswa aktif di kelas yang diampu pada tanggal relevan.
- Penghapusan master yang sedang dipakai ditolak atau diarsipkan sesuai aturan.

---

# Fase 7 — Sesi Kelas, Materi, dan File Privat

## Tujuan

Menjadi fondasi bersama untuk materi, presensi, dan progres.

## Langkah

1. Buat `SesiKelas` dengan tanggal, pertemuan ke, topik, status draft/final.
2. Materi terkait kelas dan opsional sesi.
3. Dukungan tipe teks, PDF/gambar, dan link video.
4. Upload mengikuti storage service yang sama dengan dokumen pendaftaran, tetapi policy berbeda.
5. Link video divalidasi scheme/host allowlist sesuai keputusan.
6. Implementasikan draft/publish dan urutan.
7. Wali hanya melihat materi kelas anak bila fitur tersebut diaktifkan.
8. Arabic input/render menggunakan direction per field/content, bukan membalik seluruh dashboard.

## Batas

- Tidak ada upload video langsung pada MVP.
- Tidak ada transcoding/thumbnail extraction server-side.
- PDF tidak dirender inline bila kontrol keamanan browser/storage belum memadai; download authorized adalah fallback.

## Test Wajib

- Guru A tidak dapat membuat materi untuk kelas B.
- Draft tidak terlihat oleh Wali.
- File URL langsung tidak tersedia.
- RTL campuran Arab/angka/Latin tampil layak.

---

# Fase 8 — Bank Soal, Ujian, dan Penilaian

## Decision Gate

Default PRD: ujian berlangsung offline dan Guru menginput jawaban/hasil. Jangan menambahkan akun Siswa atau ujian online tanpa change decision tertulis.

## Langkah MVP Default

1. CRUD bank soal PG/esai scoped ke Guru/Admin.
2. Opsi jawaban disimpan terstruktur dan satu opsi benar untuk PG single-answer.
3. Builder ujian memakai join `UjianSoal` berisi urutan dan bobot.
4. Guru membuat hasil ujian untuk siswa dalam kelas.
5. Saat jawaban PG diinput, service menghitung skor deterministik.
6. Esai masuk status `NEEDS_REVIEW` sampai diberi skor.
7. Nilai final dihitung setelah seluruh item selesai.
8. Koreksi setelah final mencatat actor, alasan, nilai lama, dan nilai baru.
9. Wali melihat nilai final saja, bukan kunci jawaban atau catatan internal.

## Jika Online Exam Disetujui

Buat change plan terpisah yang minimal mencakup:

- role/account Siswa atau exam session token sekali pakai;
- device/session binding secukupnya;
- start/submit timestamps server-side;
- timer server-authoritative;
- autosave jawaban;
- rules resume;
- anti-enumeration dan rate limit;
- test concurrency dan submission idempotency.

## Test Wajib

- Auto-skoring dengan bobot.
- Esai belum dinilai tidak dianggap final.
- Guru tidak menilai siswa di luar kelas.
- Koreksi nilai memiliki audit.
- Wali tidak melihat draft/kunci jawaban.

---

# Fase 9 — Presensi, Progres, dan Grafik

## Presensi

1. Guru memilih/menyiapkan sesi kelas.
2. Sistem mengambil siswa aktif berdasarkan enrollment pada tanggal sesi.
3. Input massal dengan default yang tidak berbahaya; jangan otomatis menandai semua hadir tanpa konfirmasi.
4. Unique constraint mencegah duplikasi.
5. Koreksi setelah final menyimpan audit.

## Progres

1. Catatan per siswa dan sesi.
2. Skor pemahaman 1–5 dengan validasi.
3. Pisahkan catatan internal dan catatan terlihat wali bila diperlukan.
4. Timeline urut berdasarkan tanggal sesi.

## Grafik

1. Query agregasi server-side.
2. Filter periode memiliki batas maksimum untuk mencegah query berat.
3. Grafik disertai angka/tabel ringkas.
4. Empty state untuk data tidak cukup.
5. Jangan cache data wali/guru secara publik.

## Test Wajib

- Siswa yang baru masuk/keluar kelas tidak muncul pada sesi yang salah.
- Rekap bulanan sesuai timezone.
- Grafik dan tabel menghasilkan angka yang sama.
- Scope guru/wali tetap berlaku pada endpoint agregasi.

---

# Fase 10 — Tagihan, Payment Gateway, dan Notifikasi

## 10.1 Domain Billing

1. Buat `Tarif` dan aturan effective date.
2. Tagihan menyimpan snapshot nominal/deskripsi saat dibuat; perubahan tarif tidak mengubah histori.
3. Billing service menerima periode eksplisit, bukan bergantung pada `new Date()` tersebar.
4. Unique constraint menjamin satu tagihan per siswa/periode/jenis.
5. Status transition terpusat.

## 10.2 Script Terjadwal

Buat script:

- `generate-monthly-invoices.ts`
- `mark-overdue-invoices.ts`
- `retry-notifications.ts`
- `cleanup-expired-sessions.ts`

Setiap script:

- memperoleh lock (`flock` di command atau lock database);
- membuat `JobRun`;
- idempoten;
- memiliki exit code benar;
- mencatat jumlah success/skipped/failed;
- dapat dijalankan manual dengan `--dry-run` bila relevan.

Contoh jadwal production disimpan dalam dokumentasi deployment, bukan hard-coded pada source.

## 10.3 Mayar Adapter

Buat interface semacam:

```ts
interface PaymentGateway {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>
  verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedPaymentEvent>
  getPaymentStatus?(reference: string): Promise<PaymentStatusResult>
}
```

Business service tidak boleh mengetahui detail HTTP Mayar selain model adapter.

## 10.4 Webhook Route Handler

`POST /api/v1/webhooks/mayar`

Urutan wajib:

1. Terapkan payload limit dan timeout.
2. Baca raw body satu kali.
3. Verifikasi signature sebelum mempercayai payload.
4. Validasi schema event.
5. Verifikasi project/merchant, reference, amount, dan status.
6. Cek `WebhookEvent` unik.
7. Dalam transaksi: simpan event, upsert pembayaran yang valid, update tagihan.
8. Buat notification/outbox record.
9. Return response aman.

Webhook duplicate harus return sukses konsisten setelah mengetahui event telah diproses.

## 10.5 Notification Provider

- Interface `NotificationProvider`.
- Provider `console` untuk development.
- Email sebagai default implementasi awal bila keputusan belum berubah.
- Template terpisah untuk approval, rejection, payment success, due reminder, overdue.
- Delivery status dan retry count tersimpan.
- Jangan mengirim notifikasi sebelum transaksi bisnis committed.

## Test Wajib

- Generate tagihan dua kali tidak duplikat.
- Siswa tengah bulan mengikuti rule default/config.
- Signature salah, amount salah, merchant salah ditolak.
- Webhook duplicate tidak menggandakan pembayaran/notifikasi.
- Manual reconciliation memerlukan alasan dan audit.
- Provider timeout tidak membatalkan pembayaran yang sudah valid; delivery dapat diretry.

---

# Fase 11 — PWA, SEO, Security Hardening, dan Performance

## PWA

1. Buat `app/manifest.ts`.
2. Sediakan icon 192x192 dan 512x512 serta maskable bila tersedia.
3. Buat service worker dengan scope dan versioning yang jelas.
4. Cache hanya:
   - build assets immutable;
   - icon/font lokal yang aman;
   - halaman publik tertentu;
   - offline fallback.
5. Network-only/no-store untuk:
   - `/api/**`;
   - dashboard authenticated;
   - file privat;
   - nilai, presensi, progres, tagihan, dan profil.
6. Logout membersihkan cache aplikasi relevan.
7. Uji update service worker agar user tidak terjebak pada bundle lama.

## SEO

- Metadata landing page.
- Sitemap publik saja.
- Dashboard/auth tidak diindeks.
- OG image LIMO.
- Canonical URL.

## Hardening

1. Nginx request size berbeda untuk endpoint normal dan upload bila memungkinkan.
2. Rate limit login, registration, status lookup, reset password, dan webhook.
3. CSP disusun berdasarkan asset/provider aktual dan diuji di report-only lebih dulu bila perlu.
4. Security headers.
5. Dependency audit dan lockfile committed.
6. Nonaktifkan source map publik bila dapat membocorkan detail sensitif.
7. Pastikan error page tidak mencetak stack production.
8. Review cache headers semua endpoint sensitif.

## Performance

- Pagination pada table.
- Index query populer.
- Hindari N+1 query.
- Gunakan Server Components untuk initial data.
- Lazy load chart/komponen berat.
- Batasi query grafik/laporan.
- Uji ukuran bundle setelah adaptasi TailAdmin.

## Verifikasi

- PWA installable dan offline fallback bekerja.
- Data user tidak terlihat dari Cache Storage setelah logout.
- Lighthouse/cek manual tidak menunjukkan masalah kritis.
- Rate limit dan payload limit terbukti bekerja.

---

# Fase 12 — Testing Menyeluruh dan UAT

## Unit

- Auth token/session helper.
- Policy dan scoping.
- Billing rules.
- Auto-scoring.
- Status transitions.
- Signature helper dengan fixture.

## Integration

Gunakan database test terpisah:

- migration dan seed test;
- login/session;
- approval/rejection;
- mutasi kelas;
- authorized file download;
- ujian dan nilai;
- presensi/progres;
- invoice scripts;
- webhook idempotency.

## E2E Playwright

Skenario minimum:

1. Publik mendaftar.
2. Admin review dan approve.
3. Wali login dan memilih anak.
4. Guru login dan mengelola kelasnya.
5. Guru upload materi kecil yang valid.
6. Guru input presensi/progres.
7. Guru input hasil ujian.
8. Cron membuat tagihan.
9. Webhook fixture menandai pembayaran.
10. Wali melihat status lunas.

## Security Matrix

Ulangi akses setiap resource dengan:

- tanpa login;
- role salah;
- role benar tetapi resource milik user lain;
- ID acak/tidak ada;
- session revoked;
- request tanpa origin yang valid untuk mutation browser.

## UAT

- Data dummy menyerupai kondisi LIMO.
- Admin, minimal satu Guru, dan perwakilan Wali mengikuti script UAT.
- Temuan dikategorikan: blocker, major, minor, change request.
- Revisi minor tidak boleh mengubah arsitektur atau scope inti tanpa persetujuan.

## Exit Criteria

- Semua blocker/major selesai.
- Test critical flow hijau.
- Tidak ada vulnerability kritis yang diketahui.
- Open decision production ditutup.

---

# Fase 13 — Deployment VPS dan Operasional

## 13.1 Persiapan VPS

- Node.js versi yang didukung project.
- MariaDB lokal/private.
- Nginx.
- PM2.
- Certbot atau mekanisme TLS yang disepakati.
- User Linux khusus aplikasi tanpa login root.
- Direktori release, logs, dan private storage dengan ownership tepat.

## 13.2 Build

- Gunakan build production Next.js.
- `output: 'standalone'` dapat digunakan untuk artefak deployment minimal setelah diuji dengan Prisma, assets, dan service worker.
- Jalankan migration sebagai langkah eksplisit sebelum restart aplikasi.
- Jangan menjalankan seed development di production.

## 13.3 PM2

Satu proses aplikasi terlebih dahulu:

```text
limo-web → Next.js production server pada 127.0.0.1:3000
```

- Auto-start saat boot.
- Environment production dari file aman.
- Graceful reload.
- Memory restart threshold diset setelah observasi, bukan angka acak terlalu rendah.

## 13.4 Nginx

- Redirect HTTP ke HTTPS.
- Proxy hanya ke localhost Next.js.
- Forward header host/proto/IP dengan benar.
- Rate limit endpoint rawan.
- Payload limit default kecil dan exception khusus upload.
- Timeout upload/provider disesuaikan tanpa membuka koneksi terlalu lama.
- Jangan expose private storage atau MariaDB.

## 13.5 Cron

Gunakan cron/systemd timer dengan lock. Contoh konsep:

```text
flock -n /var/lock/limo-invoice.lock <command generate invoice>
```

Jadwal final harus mengikuti kebijakan LIMO dan timezone server yang diverifikasi.

## 13.6 Backup

- `mysqldump` harian.
- Retensi minimal 7 hari.
- Salinan off-server bila memungkinkan.
- Backup private file atau gunakan storage durable.
- File backup memiliki permission ketat.
- Restore diuji, bukan hanya backup dibuat.

## 13.7 Deployment Runbook

1. Backup database.
2. Upload/pull release.
3. Install dependency dari lockfile.
4. Generate Prisma client.
5. Run migration.
6. Build.
7. Reload PM2.
8. Health/readiness check.
9. Smoke test login dan critical API.
10. Rollback jika gagal; migration destructive membutuhkan rencana khusus.

## Verifikasi

- Domain HTTPS aktif.
- Tidak ada port 3000/3306 terbuka publik.
- Health check lulus.
- Cron manual dry-run/laporan lulus.
- Backup dan restore test lulus.
- PWA dapat dipasang pada perangkat uji.

---

# Fase 14 — Dokumentasi, Training, dan Serah Terima

## Dokumen Wajib

- README development.
- Environment variable reference.
- Database migration/backup/restore guide.
- Deployment dan rollback runbook.
- Cron schedule dan cara menjalankan manual.
- Provider credential setup tanpa menulis secret aktual.
- Role/access matrix.
- UAT result.
- Known limitations dan open issues.

## Training

- Admin: pendaftaran, user, siswa, kelas, tagihan, rekonsiliasi.
- Guru: kelas, sesi, materi, ujian, presensi, progres.
- Wali: child selector, progres, presensi, nilai, tagihan.

## Serah Terima

- Akun admin awal dipindahkan dengan proses aman.
- Secret production tidak ditempel ke dokumen/chat publik.
- Masa garansi dimulai sesuai berita acara/kontrak.
- Daftar issue garansi dibedakan dari change request.

---

## 4-Minggu Delivery Mapping

| Minggu | Fokus | Fase |
|---|---|---|
| 1 | Baseline, foundation, schema, auth, branding, pendaftaran | 0–5 |
| 2 | Master data, kelas, materi, ujian | 6–8 |
| 3 | Presensi, progres, grafik, billing, payment | 9–10 |
| 4 | PWA, hardening, test, UAT, deployment, training | 11–14 |

Timeline ini agresif. Coding agent harus memprioritaskan flow inti dan test keamanan daripada menambah variasi UI atau fitur yang belum disetujui.

---

## Endpoint Inventory Awal

Daftar ini adalah baseline; nama final harus konsisten dan tidak menduplikasi fungsi.

### Auth

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`

### Pendaftaran

- `POST /api/v1/pendaftaran`
- `GET /api/v1/pendaftaran/status`
- `POST /api/v1/pendaftaran/[id]/files`
- `GET /api/v1/admin/pendaftaran`
- `GET /api/v1/admin/pendaftaran/[id]`
- `POST /api/v1/admin/pendaftaran/[id]/approve`
- `POST /api/v1/admin/pendaftaran/[id]/reject`

### Master Data dan Akademik

- `/api/v1/admin/users/*`
- `/api/v1/admin/guru/*`
- `/api/v1/admin/wali/*`
- `/api/v1/admin/siswa/*`
- `/api/v1/admin/program/*`
- `/api/v1/admin/level/*`
- `/api/v1/admin/kelas/*`
- `/api/v1/guru/kelas/*`
- `/api/v1/guru/sesi/*`

### LMS

- `/api/v1/materi/*`
- `/api/v1/bank-soal/*`
- `/api/v1/ujian/*`
- `/api/v1/hasil-ujian/*`
- `/api/v1/presensi/*`
- `/api/v1/progres/*`

### Keuangan

- `/api/v1/tagihan/*`
- `/api/v1/pembayaran/*`
- `POST /api/v1/webhooks/mayar`

### File

- `POST /api/v1/files`
- `GET /api/v1/files/[id]`
- `DELETE /api/v1/files/[id]`

Jangan membuat endpoint generic file yang mengizinkan client menentukan path/owner secara bebas. File harus selalu dikaitkan ke konteks domain dan policy.

---

## Definition of Done per Task

Sebuah task coding dianggap selesai hanya jika:

- Implementasi mengikuti layering.
- Input tervalidasi server-side.
- Auth dan policy diterapkan bila diperlukan.
- Error response aman dan konsisten.
- Test unit/integration yang relevan ditambahkan.
- Tidak ada secret/data sensitif di log.
- UI memiliki loading, error, empty, dan success feedback.
- Mobile dan RTL diperiksa jika relevan.
- Migration dan dokumentasi diperbarui jika schema/config berubah.
- Lint, typecheck, dan test lulus.

---

## Checklist Keputusan Sebelum Fase Terkait

- [ ] Provider notifikasi final dan kredensial sandbox/production.
- [ ] Kebijakan siswa masuk tengah bulan.
- [ ] Mode ujian tetap offline teacher-entry atau berubah menjadi online.
- [ ] Tarif, tanggal generate, dan jatuh tempo tagihan.
- [ ] Domain production dan staging.
- [ ] Logo SVG/PNG resolusi tinggi serta icon PWA.
- [ ] Jenis dan jumlah dokumen pendaftaran.
- [ ] Retensi dokumen dan siapa yang boleh mengunduh.
- [ ] Credential Mayar, merchant ID, dan contoh payload webhook resmi.
- [ ] Apakah materi dapat dilihat Wali atau hanya Guru/Admin.

---

*Rencana ini sengaja mempertahankan satu aplikasi Next.js dan memindahkan pekerjaan terjadwal ke script cron. Pemisahan tanggung jawab dilakukan pada level modul dan service, bukan dengan menambah proses Express yang tidak diperlukan untuk MVP.*
