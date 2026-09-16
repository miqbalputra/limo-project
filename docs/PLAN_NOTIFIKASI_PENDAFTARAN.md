# Rencana Notifikasi Alur Pendaftaran LIMO (revisi_v2)

Dokumen ini menjawab pertanyaan: **bagaimana pendaftar mendapat info bahwa (1) data pendaftarannya sudah masuk, (2) ia diterima, dan (3) akun orang tua/wali sudah dibuat?** serta rencana implementasinya (n8n sebagai orkestrator).

## 1. Ringkasan Jawaban

Saat ini pendaftar **belum otomatis mendapat info apa pun**:

- Saat submit tidak ada notifikasi dibuat.
- Saat admin menyetujui, notifikasi **hanya email** ke `waliEmail` dan **baru terkirim saat job cron `notifications:retry` berjalan**.
- WhatsApp belum pernah dipakai untuk pendaftaran, padahal dokumen revisi menempatkan **Nomor WhatsApp orang tua/wali sebagai kontak wajib** dan email sebagai opsional.

Rencana: app tetap menjadi *source of truth* (tabel `Notifikasi` + `NotificationDelivery`), lalu **n8n** dipakai untuk mengirim WhatsApp (GOWA) dan/atau email. Tambahkan notifikasi saat submit dan saat approve (WA + email), lalu pastikan pengiriman cepat dan andal.

## 2. Kondisi Sistem Saat Ini (temuan kode)

| Momen | Sudah ada? | Bukti kode |
| --- | --- | --- |
| Submit pendaftaran | Tidak ada notifikasi | `src/server/services/pendaftaran-service.ts:111` (hanya create pendaftaran + riwayat) |
| Approve | Email saja, masuk queue `PENDING` | `pendaftaran-service.ts:532` (`channel:"email"`, template `pendaftaran-approved`, body memuat link aktivasi) |
| Reject | Email, atau WhatsApp jika email kosong | `pendaftaran-service.ts:597` |
| Pengiriman | Cron `npm run notifications:retry` | `src/server/services/job-service.ts:70`, `scripts/retry-notifications.ts` |
| Provider | `console` / `email` (SMTP) / `n8n` (email+WA) / `whatsapp` (belum diimplementasi) | `src/server/providers/notification/notifier.ts` |
| Kontrak n8n | Sudah didokumentasikan | `docs/MAYAR_N8N_INTEGRATION.md:42` |
| Token aktivasi | Berlaku **30 menit** | `src/server/auth/password-reset.ts:4` |
| Approve tanpa email | Diblokir | `pendaftaran-service.ts:433` (`Email wali belum diisi…`) |

### Gap yang perlu ditutup

1. **Tidak ada konfirmasi "pendaftaran diterima"** ke pendaftar (padahal halaman sukses mengklaim "Nomor pendaftaran dikirim ke WhatsApp/email Anda").
2. **WhatsApp tidak dipakai** untuk info diterima/akun, padahal itu kanal utama menurut dokumen.
3. **Tidak real-time**: pengiriman bergantung pada cron; belum ada trigger setelah submit/approve.
4. **Token aktivasi 30 menit terlalu singkat** untuk dikirim via WA/email dan diklik orang tua.
5. **Approve terblokir bila email kosong**, walaupun dokumen menyatakan email opsional.
6. Belum ada aksi **kirim ulang aktivasi wali** (siswa sudah punya: `student-account-service.ts:113`).

## 3. Rekomendasi Arsitektur

**Pakai n8n sebagai orkestrator notifikasi**, bukan memanggil GOWA langsung dari app.

```
LIMO (Next.js)                    n8n (self-host)                 Kanal
─────────────────                 ───────────────                 ─────
submit / approve / reject
   │ enqueue Notifikasi (DB)
   │ status PENDING
   ▼
retry-notifications (cron 1 mnt) ──POST──▶ /webhook/limo-whatsapp ──▶ GOWA ──▶ WA
   │ (validasi X-Limo-Webhook-Secret)  /webhook/limo-email    ──▶ SMTP/Email node
   │ catat NotificationDelivery (attempt, status, error)
   ▼
PENDING → SENT / FAILED (retry maks 5x)
```

Alasan:

- Kontrak webhook + retry + attempt limit **sudah ada** di app (`notifier.ts`, `job-service.ts`), tinggal diaktifkan (`NOTIFICATION_PROVIDER=n8n`).
- n8n menangani kredensial GOWA (QR/session) dan SMTP, sehingga app tidak menyimpan state session WhatsApp.
- Keandalan tetap di app: kalau n8n mati, notifikasi tetap `FAILED` dan di-retry, tidak hilang.

Alternatif (dicatat, bukan rekomendasi utama):

- **App → GOWA langsung**: lebih sedikit komponen, tapi app harus mengelola session/QR, reconnect, dan retry GOWA.
- **WhatsApp Business Cloud API (resmi, via n8n)**: paling patuh kebijakan, butuh verifikasi Meta + template pesan disetujui. Cocok sebagai fase lanjutan.
- **Email saja**: paling murah, tapi tidak sesuai ekspektasi dokumen (WA wajib).

## 4. Alur Notifikasi yang Diusulkan

### 4.1 Saat submit (baru)

- Template `pendaftaran-submitted`.
- Penerima: `waliPhone` (WA) selalu; `waliEmail` (email) bila diisi.
- Isi: nomor pendaftaran, nama peserta, program, status "Pendaftaran Diterima", link cek status, dan info tahapan selanjutnya.
- Efek: halaman sukses `/daftar/berhasil` yang menjanjikan kirim nomor menjadi benar.

### 4.2 Saat approve (perluas)

- Template `pendaftaran-approved` diperluas: selain "disetujui", sertakan **akun wali sudah dibuat**, identifier login, dan **link aktivasi**.
- Penerima: `waliPhone` (WA) dan `waliEmail` (email).
- Bila akun wali memakai email yang sudah ada sebelumnya, tidak ada link aktivasi — cukup info akun aktif.
- Efek: pendaftar tahu diterima + akun orang tua siap.

### 4.3 Saat reject (sudah ada, rapikan)

- Template `pendaftaran-rejected` dengan alasan; kirim ke WA dan email bila tersedia.

### 4.4 Aktivasi akun wali

- Pisahkan token **aktivasi akun** (berlaku 7 hari) dari **reset password** (30 menit) agar link di WA/email tidak cepat kedaluwarsa.
- Tambah aksi admin **Kirim Ulang Aktivasi Wali** (mengikuti pola `resendSiswaActivation`).

## 5. Perubahan Teknis yang Diperlukan

1. **Service notifikasi pendaftaran** baru, mis. `src/server/services/pendaftaran-notification-service.ts`:
   - `enqueuePendaftaranSubmitted(pendaftaran)`
   - `enqueuePendaftaranApproved(pendaftaran, { activationUrl? , existingAccount })`
   - `enqueuePendaftaranRejected(pendaftaran, reason)`
   - Membuat baris `Notifikasi` untuk channel `whatsapp` dan `email` dengan `dedupeKey` (pola `notification-service.ts:10`).
2. **`submitPendaftaran`**: panggil `enqueuePendaftaranSubmitted` setelah transaksi sukses (`pendaftaran-service.ts:158`).
3. **`approvePendaftaran`**: ganti blok notifikasi email-only (`pendaftaran-service.ts:532`) dengan enqueue WA+email berisi info akun + aktivasi.
4. **Dispatch lebih cepat**:
   - Cron `notifications:retry` tiap **1 menit** (safety net).
   - Opsional *best-effort immediate*: setelah commit, jalankan `retryPendingNotifications({ limit: 5 })` secara non-blocking (aman karena deploy Node/PM2/Docker, bukan serverless).
5. **Token aktivasi wali 7 hari** (tambah fungsi baru di `password-reset.ts` atau parameter durasi) + endpoint resend.
6. **Approve tanpa email** (pilihan):
   - **Opsi A (MVP, rekomendasi)**: tetap butuh email untuk membuat akun `User` (karena `User.email` unik), admin melengkapi via `PATCH /api/v1/admin/pendaftaran/[id]` yang sudah ada; pesan WA tetap terkirim. UI admin diberi petunjuk jelas.
   - **Opsi B (lanjutan)**: buat identifier login berbasis nomor WhatsApp (mis. `628xx@wali.limo.local`) dan aktifkan login via nomor. Perlu perubahan auth + UX.
7. **Template pesan** disimpan rapi (helper string), bukan inline panjang, agar mudah diubah.
8. **Monitoring**: halaman/section admin "Log Notifikasi" dari `Notifikasi` + `NotificationDelivery` (status, attempt, error) dan `JobRun` untuk `retry-notifications`.

## 6. Kontrak n8n (sudah ada, tinggal dipakai)

LIMO mengirim `POST` JSON:

```json
{
  "event": "limo.notification",
  "notificationId": "...",
  "channel": "whatsapp|email",
  "recipient": "62812xxxx|ortu@email.com",
  "subject": "...",
  "body": "...",
  "metadata": { "kode": "LIMO-2026-XXXX", "program": "...", "template": "pendaftaran-approved" }
}
```

Header `X-Limo-Webhook-Secret`. Workflow n8n:

1. **Webhook** (path `/webhook/limo-whatsapp`, `/webhook/limo-email`).
2. **IF** validasi header `X-Limo-Webhook-Secret` → tolak 401 bila salah.
3. **Switch** `channel`.
4. **GOWA node** (WA) / **SMTP atau Email node** (email).
5. **Respond to Webhook** 2xx hanya setelah provider menerima; selain itu biarkan gagal agar LIMO retry.
6. Idempotensi: gunakan `notificationId` (mis. simpan di n8n atau abaikan duplikat) — LIMO sudah punya `dedupeKey`.

Env produksi (app):

```env
NOTIFICATION_PROVIDER=n8n
N8N_EMAIL_WEBHOOK_URL=https://n8n.example.com/webhook/limo-email
N8N_WHATSAPP_WEBHOOK_URL=https://n8n.example.com/webhook/limo-whatsapp
N8N_WEBHOOK_SECRET=replace-with-random-secret
```

Validasi env sudah menolak `console` di produksi dan mewajibkan ketiga nilai di atas (`src/server/env.ts:95`).

## 7. Isi Pesan (contoh)

**WA – pendaftaran diterima**

```
Terima kasih telah mendaftar di LIMO.
No. Pendaftaran: LIMO-2026-XXXX
Peserta: Aisyah Putri
Program: Bahasa Inggris
Status: Pendaftaran Diterima

Tim LIMO akan menghubungi Anda untuk assessment dan penempatan kelas.
Cek status: {APP_URL}/status-pendaftaran
```

**WA/Email – disetujui + akun wali**

```
Pendaftaran LIMO Disetujui
Peserta: Aisyah Putri (LIMO-2026-XXXX)
Program: Bahasa Inggris

Akun orang tua/wali telah dibuat.
Identifier login: ortu@email.com
Aktifkan akun & atur password (berlaku 7 hari): {aktivasiUrl}

Tahapan: Assessment -> Penempatan Kelas -> Pembayaran -> Enrollment.
```

## 8. Scheduler & Operasional

Tambahkan ke cron (contoh, `docs/DEPLOYMENT.md:48`):

```text
* * * * * flock -n /var/lock/limo-notif.lock npm run notifications:retry -- --limit=50
```

Pada Docker/Dokploy gunakan cron container/PM2 cron atau systemd timer. Pastikan hanya satu instance menjalankan job (flock/lock).

## 9. Keamanan & Privasi

- Persetujuan kontak & penggunaan data sudah direkam saat submit (`consentContact`), jadi pengiriman WA sah dilakukan.
- Minimalkan data di pesan (nama, program, kode); jangan kirim dokumen/berkas.
- Link aktivasi/reset bersifat rahasia; jangan log token (`NotificationDelivery.response` hanya metadata aman).
- Verifikasi `X-Limo-Webhook-Secret` di n8n; jangan expose URL webhook tanpa secret.
- Token aktivasi disimpan sebagai hash (`passwordResetToken.tokenHash`).

## 10. Rencana Implementasi Bertahap

**Fase 1 — Fondasi (0,5–1 hari)**
- Service notifikasi pendaftaran + template submit/approve/reject (WA + email).
- Enqueue saat submit dan approve.
- Aktifkan `NOTIFICATION_PROVIDER=n8n` + workflow n8n + cron 1 menit.

**Fase 2 — Aktivasi ramah (1 hari)**
- Token aktivasi 7 hari + endpoint & tombol admin "Kirim Ulang Aktivasi Wali".
- Link cek status di setiap pesan.

**Fase 3 — Ketahanan & monitoring (1–2 hari)**
- Immediate best-effort dispatch setelah submit/approve.
- Section admin Log Notifikasi (status/attempt/error dari `NotificationDelivery`).
- Test: unit + integrasi (mock webhook n8n) + e2e submit→approve→notifikasi.

**Fase 4 — Opsional (2–3 hari)**
- Approve tanpa email (login via nomor WhatsApp) atau WhatsApp Cloud API resmi.
- Template pesan dapat dikelola admin.

## 11. Kriteria Penerimaan

1. Submit menghasilkan notifikasi WA (dan email bila diisi) berisi nomor pendaftaran dalam < 2 menit.
2. Approve menghasilkan notifikasi WA + email berisi status diterima **dan** info akun wali + link aktivasi yang masih berlaku.
3. `Notifikasi`/`NotificationDelivery` mencatat status, attempt, dan error; retry maksimal 5x.
4. Kegagalan n8n tidak menghilangkan data; notifikasi di-retry dan terlihat di monitoring admin.
5. Admin dapat mengirim ulang aktivasi wali dari dashboard.
6. Email tetap opsional tanpa memblokir pengiriman WhatsApp (sesuai dokumen revisi).

## 12. Keputusan yang Perlu Dikonfirmasi Klien

1. Kanal WhatsApp: **GOWA** (nomor LIMO sendiri) atau WhatsApp Business API resmi?
2. Bila orang tua tidak mengisi email: cukup admin melengkapi email (Opsi A) atau perlu login via nomor WA (Opsi B)?
3. Masa berlaku link aktivasi (usulan 7 hari) dan isi template pesan final.
4. Nomor/akun pengirim resmi untuk WA dan email (`SMTP_FROM`).
