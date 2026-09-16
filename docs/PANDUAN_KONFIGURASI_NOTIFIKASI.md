# Panduan Konfigurasi Notifikasi Pendaftaran LIMO

Panduan ini menjelaskan cara mengaktifkan notifikasi pendaftaran (WhatsApp + email) Fase 1: konfigurasi environment aplikasi, penyiapan n8n + GOWA, workflow, scheduler, verifikasi, hingga troubleshooting.

## 1. Ringkasan Alur

```
Pendaftar submit ─┐
Admin approve   ─┼─▶ Notifikasi (DB, status PENDING)
Admin reject    ─┘        │
                          ▼
              npm run notifications:retry (cron 1 menit)
                          │  NOTIFICATION_PROVIDER=n8n
                          ▼
        ┌─────────────────┴──────────────────┐
   POST /webhook/limo-whatsapp        POST /webhook/limo-email
        │  X-Limo-Webhook-Secret            │
        ▼                                   ▼
      GOWA ─▶ WhatsApp                  SMTP ─▶ Email
                          │
                          ▼
        NotificationDelivery (SENT/FAILED, attempt) + JobRun
```

Template yang dikirim:

| Momen | Template | Kanal | Isi |
| --- | --- | --- | --- |
| Submit | `pendaftaran-submitted` | WhatsApp + email | Nomor pendaftaran, peserta, program, tautan cek status |
| Approve | `pendaftaran-approved` | WhatsApp + email | Status diterima, identifier akun wali, tautan aktivasi |
| Reject | `pendaftaran-rejected` | WhatsApp + email | Alasan penolakan, tautan cek status |
| Lainnya (pembayaran, deadline, dll.) | mis. `payment-success` | sesuai data | Lewat webhook yang sama |

Catatan: jika `NOTIFICATION_PROVIDER=email`, kanal WhatsApp dilewati. Jika `n8n`, kedua kanal dikirim ke webhook masing-masing.

## 2. Prasyarat

- Aplikasi LIMO production sudah berjalan (Docker/Dokploy atau PM2) dan `APP_URL` HTTPS valid.
- n8n self-host yang dapat diakses publik dengan HTTPS.
- Kredensial SMTP (host, port, user, password, alamat pengirim).
- GOWA (WhatsApp gateway) dengan nomor WhatsApp resmi LIMO.
- Akses ke scheduler (cron host, schedule Dokploy, atau container cron terpisah).

## 3. Konfigurasi Environment Aplikasi

Isi pada environment Application LIMO (Dokploy: `Environment Variables`; PM2: `.env.production`).

### 3.1 Wajib untuk n8n

```env
APP_URL=https://limo.example.com
NOTIFICATION_PROVIDER=n8n
N8N_EMAIL_WEBHOOK_URL=https://n8n.example.com/webhook/limo-email
N8N_WHATSAPP_WEBHOOK_URL=https://n8n.example.com/webhook/limo-whatsapp
N8N_WEBHOOK_SECRET=secret-acak-panjang-untuk-n8n
```

### 3.2 Penjelasan variabel

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `NOTIFICATION_PROVIDER` | Ya | `n8n` (WA + email), `email` (email saja), `console` hanya untuk dev. Production menolak `console`. |
| `N8N_EMAIL_WEBHOOK_URL` | Jika provider `n8n` | URL production webhook workflow email. |
| `N8N_WHATSAPP_WEBHOOK_URL` | Jika provider `n8n` | URL production webhook workflow WhatsApp. |
| `N8N_WEBHOOK_SECRET` | Jika provider `n8n` | Dikirim sebagai header `X-Limo-Webhook-Secret`. |
| `SMTP_*` | Jika provider `email`, atau dipakai node email di n8n | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASSWORD`. |
| `APP_URL` | Ya | Dipakai untuk tautan cek status dan tautan aktivasi. |

Validasi environment otomatis menolak konfigurasi tidak lengkap (`src/server/env.ts:95`). Jika `app` gagal start dengan pesan `Invalid application environment`, cek kembali ketiga variabel n8n atau variabel SMTP.

### 3.3 Alternatif tanpa WhatsApp (email saja)

```env
NOTIFICATION_PROVIDER=email
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_FROM=no-reply@limo.example.com
SMTP_USER=no-reply@limo.example.com
SMTP_PASSWORD=isi-password-smtp
```

## 4. Deploy n8n dan GOWA

Contoh `docker-compose` terpisah (sesuaikan domain, volume, dan versi image dengan dokumentasi resmi masing-masing tool).

```yaml
services:
  n8n:
    image: n8nio/n8n:latest
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=n8n.example.com
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://n8n.example.com/
      - GENERIC_TIMEZONE=Asia/Jakarta
      - N8N_SECURE_COOKIE=true
    volumes:
      - n8n-data:/home/node/.n8n

  gowa:
    image: aldinokemal2104/go-whatsapp-web-multidevice:latest
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      - WHATSAPP_ACCOUNT_VALIDATION=false
    command: ["rest", "--basic-auth=admin:secret-gowa", "--port=3000"]
    volumes:
      - gowa-data:/app/storages

volumes:
  n8n-data:
  gowa-data:
```

Langkah:

1. Jalankan service, buka `https://n8n.example.com` dan selesaikan setup owner n8n.
2. Buka `http://server:3001` (atau path scan pada versi GOWA Anda), lalu **scan QR** dengan nomor WhatsApp LIMO.
3. Pastikan GOWA berstatus tersambung dan uji kirim pesan manual.
4. Catat URL internal GOWA (mis. `http://gowa:3000`), basic auth, dan path kirim pesan sesuai versi. Umumnya `POST /send/message` dengan body `{"phone":"62812...","message":"..."}`. Verifikasi pada dokumentasi versi GOWA yang dipakai.

Catatan: aplikasi sudah menormalkan nomor WhatsApp ke format `62...` sehingga cocok untuk GOWA.

## 5. Workflow n8n — WhatsApp

Buat workflow baru berisi node berikut:

1. **Webhook**
   - HTTP Method: `POST`
   - Path: `limo-whatsapp`
   - Respond: `Using 'Respond to Webhook' Node`
2. **IF** — Validasi secret
   - Value 1 (String): `{{ $json.headers["x-limo-webhook-secret"] }}`
   - Operation: `equal`
   - Value 2: `secret-acak-panjang-untuk-n8n` (harus sama dengan `N8N_WEBHOOK_SECRET`)
3. **HTTP Request** (cabang `true`)
   - Method: `POST`
   - URL: `http://gowa:3000/send/message`
   - Authentication: `Generic Credential Type` → `Basic Auth` (user/password GOWA)
   - Send Body: `JSON`
   - Body:
     ```json
     {
       "phone": "{{ $json.body.recipient }}",
       "message": "{{ $json.body.body }}"
     }
     ```
   - Options: Timeout `10000` ms
4. **Respond to Webhook** (setelah HTTP Request sukses)
   - Respond With: `JSON`
   - Response Code: `200`
   - Response Body: `{ "ok": true }`
5. **Respond to Webhook** (cabang `false`)
   - Response Code: `401`
   - Response Body: `{ "ok": false, "error": "invalid secret" }`

Hubungkan: Webhook → IF; IF `true` → HTTP Request → Respond 200; IF `false` → Respond 401.

Simpan, klik **Active**, lalu salin **Production URL** ke `N8N_WHATSAPP_WEBHOOK_URL`.

### 5.1 Contoh JSON impor (opsional)

Import lalu **pilih ulang credential Basic Auth GOWA** dan ganti secret.

```json
{
  "name": "LIMO WhatsApp",
  "nodes": [
    { "parameters": { "httpMethod": "POST", "path": "limo-whatsapp", "responseMode": "responseNode", "options": {} }, "id": "w1", "name": "Webhook", "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [0, 0] },
    { "parameters": { "conditions": { "string": [{ "value1": "={{ $json.headers[\"x-limo-webhook-secret\"] }}", "operation": "equal", "value2": "secret-acak-panjang-untuk-n8n" }] } }, "id": "i1", "name": "IF Secret", "type": "n8n-nodes-base.if", "typeVersion": 1, "position": [220, 0] },
    { "parameters": { "method": "POST", "url": "http://gowa:3000/send/message", "authentication": "genericCredentialType", "genericAuthType": "httpBasicAuth", "sendBody": true, "specifyBody": "json", "jsonBody": "={\n  \"phone\": \"{{ $json.body.recipient }}\",\n  \"message\": \"{{ $json.body.body }}\"\n}", "options": { "timeout": 10000 } }, "id": "h1", "name": "GOWA Send", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [460, -80] },
    { "parameters": { "respondWith": "json", "responseBody": "={ \"ok\": true }", "options": { "responseCode": 200 } }, "id": "r1", "name": "Respond 200", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1, "position": [700, -80] },
    { "parameters": { "respondWith": "json", "responseBody": "={ \"ok\": false, \"error\": \"invalid secret\" }", "options": { "responseCode": 401 } }, "id": "r2", "name": "Respond 401", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1, "position": [460, 120] }
  ],
  "connections": {
    "Webhook": { "main": [[{ "node": "IF Secret", "type": "main", "index": 0 }]] },
    "IF Secret": { "main": [[{ "node": "GOWA Send", "type": "main", "index": 0 }], [{ "node": "Respond 401", "type": "main", "index": 0 }]] },
    "GOWA Send": { "main": [[{ "node": "Respond 200", "type": "main", "index": 0 }]] }
  },
  "settings": { "executionOrder": "v1" }
}
```

## 6. Workflow n8n — Email

1. **Webhook**: `POST`, path `limo-email`, response mode `responseNode`.
2. **IF** validasi header `x-limo-webhook-secret` sama dengan `N8N_WEBHOOK_SECRET`.
3. **Send Email** (cabang `true`), credential SMTP:
   - From: `LIMO <no-reply@limo.example.com>`
   - To: `{{ $json.body.recipient }}`
   - Subject: `{{ $json.body.subject }}`
   - Email Format: `Text`
   - Text: `{{ $json.body.body }}`
4. **Respond to Webhook** 200 `{ "ok": true }` setelah node email sukses.
5. **Respond to Webhook** 401 pada cabang `false`.

Aktifkan workflow dan salin Production URL ke `N8N_EMAIL_WEBHOOK_URL`.

## 7. Kontrak Payload (Referensi)

Aplikasi mengirim:

```json
{
  "event": "limo.notification",
  "notificationId": "cmxxxxxxxx",
  "channel": "whatsapp",
  "recipient": "6281234567890",
  "subject": "Pendaftaran LIMO-2026-ABC123 diterima",
  "body": "Terima kasih telah mendaftar di LIMO.\n\nNo. Pendaftaran: LIMO-2026-ABC123\n...",
  "metadata": {
    "kode": "LIMO-2026-ABC123",
    "program": "Bahasa Inggris",
    "participantType": "CHILD"
  }
}
```

Header: `X-Limo-Webhook-Secret: <N8N_WEBHOOK_SECRET>`.

n8n harus membalas `2xx` **hanya setelah** provider (GOWA/SMTP) menerima pesan. Balasan non-2xx akan tercatat sebagai `FAILED` dan dicoba ulang oleh job LIMO (maksimal 5 percobaan).

## 8. Scheduler `notifications:retry`

Job harus dijalankan **setiap menit** dan hanya di satu instance.

### 8.1 VM dengan crontab

```cron
* * * * * cd /var/www/limo && flock -n /var/lock/limo-notif.lock npm run notifications:retry -- --limit=50 >> /var/log/limo-notif.log 2>&1
```

### 8.2 PM2

```cron
* * * * * cd /var/www/limo && flock -n /var/lock/limo-notif.lock /usr/bin/env bash -lc 'npm run notifications:retry -- --limit=50'
```

Jalankan sebagai user aplikasi agar `.env.production` terbaca.

### 8.3 Dokploy

- Gunakan fitur **Schedules** pada Application dan jalankan:
  ```sh
  npm run notifications:retry -- --limit=50
  ```
- Interval: setiap menit.
- Pastikan working directory container `/app` dan environment Application terpasang.

### 8.4 Docker Compose (container cron terpisah)

Jalankan di host:

```cron
* * * * * docker exec limo-web npm run notifications:retry -- --limit=50 >> /var/log/limo-notif.log 2>&1
```

Atau tambahkan service `cron` dengan `supercronic` yang memakai image aplikasi yang sama dan mount environment yang sama. Jangan jalankan loop cron di dalam proses Next.js.

## 9. Verifikasi

1. **Cek environment**: `GET https://limo.example.com/api/health/ready` harus `200` dengan semua check `ok`.
2. **Uji webhook n8n**: di editor workflow, klik **Listen for Test Event**, lalu jalankan:
   ```sh
   curl -X POST https://n8n.example.com/webhook-test/limo-whatsapp \
     -H "Content-Type: application/json" \
     -H "X-Limo-Webhook-Secret: secret-acak-panjang-untuk-n8n" \
     -d '{"event":"limo.notification","notificationId":"test","channel":"whatsapp","recipient":"62812xxxx","subject":"Test","body":"Tes notifikasi LIMO","metadata":{}}'
   ```
   Pastikan pesan WA/email diterima dan workflow merespons 2xx.
3. **Uji end-to-end pendaftaran**: submit pendaftaran baru dari `/daftar`. Dalam < 2 menit seharusnya WA + email konfirmasi diterima.
4. **Uji approve**: admin menyetujui pendaftaran, pastikan WA + email berisi tautan aktivasi.
5. **Cek antrean**:
   ```sh
   npm run notifications:retry -- --dry-run
   ```
   Angka `sent` adalah jumlah notifikasi yang siap dikirim.
6. **Kirim manual**:
   ```sh
   npm run notifications:retry -- --limit=50
   ```
   Keluaran `{"sent": n, "failed": 0}`.
7. **Cek database** (MySQL):
   ```sql
   SELECT template, channel, status, COUNT(*) FROM Notifikasi GROUP BY template, channel, status;

   SELECT n.id, n.template, n.channel, n.recipient, d.provider, d.status, d.attempt, d.errorMessage
   FROM Notifikasi n
   LEFT JOIN NotificationDelivery d ON d.notificationId = n.id
   WHERE n.status <> 'SENT'
   ORDER BY n.createdAt DESC
   LIMIT 50;
   ```
8. **Cek job run**:
   ```sql
   SELECT name, status, successCount, failedCount, startedAt, finishedAt
   FROM JobRun WHERE name = 'retry-notifications'
   ORDER BY startedAt DESC LIMIT 10;
   ```
9. **Uji kegagalan**: matikan n8n, submit pendaftaran, jalankan retry → status `FAILED` dengan `errorMessage`. Nyalakan n8n dan jalankan retry lagi → status berubah `SENT`.

## 10. Troubleshooting

| Gejala | Penyebab umum | Solusi |
| --- | --- | --- |
| Webhook merespons `401` | `N8N_WEBHOOK_SECRET` berbeda dengan nilai di node IF | Samakan secret di aplikasi dan workflow. |
| Webhook `404` | Workflow belum **Active** atau memakai Test URL | Aktifkan workflow dan pakai Production URL. |
| Notifikasi tetap `PENDING` | Cron tidak berjalan | Cek `JobRun` dan log cron; pastikan perintah `notifications:retry` jalan. |
| `FAILED` dengan "Provider WhatsApp belum dikonfigurasi" | `NOTIFICATION_PROVIDER` bukan `n8n`/`email` yang didukung | Set `n8n` atau `email`. |
| WhatsApp tidak terkirim | GOWA logout / nomor tidak valid / basic auth salah | Scan ulang QR GOWA, pastikan format `62...`, cek credential. |
| Email masuk spam | SPF/DKIM/DMARC domain belum diatur | Atur DNS pengirim dan gunakan `SMTP_FROM` berdomain resmi. |
| `FAILED` permanen setelah 5 percobaan | Retry limit tercapai | Perbaiki penyebab, lalu reset notifikasi bermasalah (lihat di bawah). |
| Notifikasi ganda | Dua cron berjalan bersamaan | Pastikan hanya satu scheduler (gunakan `flock`/lock). |

Reset notifikasi yang sudah mencapai batas percobaan:

```sql
-- Hapus jejak percobaan agar job menganggap notifikasi baru (opsional)
DELETE FROM NotificationDelivery WHERE notificationId = '<id>';
UPDATE Notifikasi SET status = 'PENDING' WHERE id = '<id>';
```

## 11. Monitoring

- Pantau jumlah `Notifikasi` berstatus `PENDING`/`FAILED` dan kolom `errorMessage` pada `NotificationDelivery`.
- Pantau `JobRun` `retry-notifications` (status `FAILED` bila ada kiriman gagal).
- Aktifkan notifikasi error pada workflow n8n (mis. node Error Trigger → kirim ke email admin).
- Rekomendasi alert: kirim peringatan bila ada `FAILED` lebih dari 5 dalam 15 menit.

## 12. Checklist Go-Live

- [ ] `NOTIFICATION_PROVIDER=n8n` dan tiga variabel n8n terisi di environment production.
- [ ] Workflow `limo-whatsapp` dan `limo-email` berstatus **Active** dan Production URL disalin ke environment.
- [ ] Secret header sama di aplikasi dan workflow.
- [ ] GOWA tersambung dengan nomor WhatsApp LIMO dan uji kirim manual berhasil.
- [ ] SMTP terverifikasi untuk email.
- [ ] Scheduler `notifications:retry` berjalan tiap menit (hanya satu instance).
- [ ] Submit pendaftaran uji → WA + email konfirmasi diterima.
- [ ] Approve pendaftaran uji → WA + email berisi tautan aktivasi diterima.
- [ ] Reject pendaftaran uji → alasan diterima di WA + email.
- [ ] `JobRun` `retry-notifications` tercatat sukses.
- [ ] Tidak ada `Notifikasi` status `FAILED` yang belum ditindaklanjuti.

## 13. Referensi

- `src/server/providers/notification/notifier.ts` — pengiriman per provider (console/email/n8n).
- `src/server/services/pendaftaran-notification-service.ts` — template dan enqueue notifikasi pendaftaran.
- `src/server/services/notification-job-service.ts` — job `retryPendingNotifications`.
- `scripts/retry-notifications.ts` — entrypoint `npm run notifications:retry`.
- `docs/MAYAR_N8N_INTEGRATION.md` — kontrak webhook n8n.
- `docs/DEPLOYMENT.md` — build, migration, dan cron.
- `docs/DOKPLOY.md` — deployment production di Dokploy.
- `docs/PLAN_NOTIFIKASI_PENDAFTARAN.md` — rencana fase lanjutan (aktivasi 7 hari, resend, login via nomor WA).
