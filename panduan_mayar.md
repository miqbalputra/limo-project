# Panduan Integrasi Mayar di LIMO

Dokumen ini menjelaskan konfigurasi dan alur pembayaran Mayar pada aplikasi LIMO.

Implementasi LIMO menggunakan Mayar Headless API V2. Data `Tagihan` di database LIMO tetap menjadi sumber kebenaran lokal. Mayar digunakan untuk membuat hosted checkout dan mengirimkan event pembayaran.

## Referensi Mayar

- [Mayar API V1 Introduction](https://docs.mayar.id/api-reference/introduction)
- [Mayar API V2 Introduction](https://docs.mayar.id/api-reference-v2/introduction)
- [V2 Create Invoice](https://docs.mayar.id/api-reference-v2/invoice/create)
- [V2 Invoice Detail](https://docs.mayar.id/api-reference-v2/invoice/detail)
- [Mayar Webhook](https://docs.mayar.id/integration/webhook)

## Keputusan Versi API

LIMO menggunakan API V2 karena endpoint dan response envelope-nya sesuai implementasi saat ini:

| Environment | Base URL |
|---|---|
| Sandbox | `https://api.mayar.io/hl/v2` |
| Production | `https://api.mayar.id/hl/v2` |

Endpoint yang digunakan:

- Membuat invoice: `POST /invoices/create`
- Membaca status invoice: `GET /invoices/{invoiceId}`
- Event webhook utama: `payment.received`

API key yang dipakai untuk membuat invoice harus memiliki akses **Read & Write**. API key Read Only hanya dapat digunakan untuk endpoint GET.

## Prasyarat

1. Buat akun Mayar di [mayar.id](https://mayar.id) atau akun sandbox di [web.mayar.io](https://web.mayar.io/).
2. Buat API key dari halaman API Keys Mayar.
3. Pastikan channel pembayaran yang akan digunakan aktif di dashboard Mayar.
4. Siapkan domain publik HTTPS untuk aplikasi LIMO agar dapat menerima webhook.
5. Pastikan setiap Wali yang akan membayar memiliki nama, email, dan nomor WhatsApp yang valid.

## Environment Variable

### Development atau Sandbox

Tambahkan ke `.env.local` atau file environment development:

```env
NODE_ENV=development
APP_URL=http://localhost:3000

MAYAR_ENV=sandbox
MAYAR_BASE_URL=
MAYAR_API_KEY=replace-with-sandbox-api-key
MAYAR_MERCHANT_ID=replace-with-sandbox-merchant-id
MAYAR_WEBHOOK_SECRET=replace-with-random-webhook-secret
```

Jika `MAYAR_BASE_URL` dikosongkan, LIMO otomatis menggunakan `https://api.mayar.io/hl/v2` saat `MAYAR_ENV=sandbox`.

### Production

```env
NODE_ENV=production
APP_URL=https://limo.example.com

MAYAR_ENV=production
MAYAR_BASE_URL=
MAYAR_API_KEY=replace-with-production-api-key
MAYAR_MERCHANT_ID=replace-with-production-merchant-id
MAYAR_WEBHOOK_SECRET=replace-with-long-random-secret
```

Jika `MAYAR_BASE_URL` dikosongkan, LIMO otomatis menggunakan `https://api.mayar.id/hl/v2` saat `MAYAR_ENV=production`.

Catatan keamanan:

- Jangan menyimpan API key di repository.
- Jangan memakai prefix `NEXT_PUBLIC_` untuk `MAYAR_API_KEY`.
- Jangan mengirim API key dari browser.
- Restart aplikasi setelah mengubah environment variable.
- Gunakan secret webhook acak yang panjang dan hanya melalui HTTPS.

## Alur Pembayaran

1. Admin membuat `Tagihan` untuk siswa. Status awal biasanya `UNPAID`.
2. Wali membuka halaman `/wali/tagihan`.
3. Wali memilih channel pembayaran dan menekan tombol `Buat Instruksi Bayar`.
4. LIMO memvalidasi session, akses Wali terhadap siswa, status tagihan, nominal, dan nomor telepon Wali.
5. Server LIMO memanggil Mayar `POST /hl/v2/invoices/create` menggunakan Bearer API key.
6. LIMO menyimpan `invoiceId`, `transactionId`, payment URL, channel, nominal, dan waktu expired ke `Pembayaran` berstatus `PENDING`.
7. Wali diarahkan ke hosted checkout Mayar.
8. Browser hanya memeriksa status lokal LIMO secara berkala. Browser tidak pernah mengubah tagihan menjadi lunas.
9. Mayar mengirim event `payment.received` ke webhook LIMO.
10. LIMO memvalidasi secret, merchant ID, referensi, dan nominal, lalu mengubah `Pembayaran` dan `Tagihan` menjadi `PAID` secara idempoten.
11. Notifikasi pembayaran dapat dikirim ke Wali dan Admin melalui provider notifikasi yang dikonfigurasi.

## Endpoint Internal LIMO

| Kebutuhan | Endpoint atau halaman |
|---|---|
| Halaman tagihan Wali | `/wali/tagihan` |
| Membuat link Mayar | `POST /api/v1/tagihan/{tagihanId}/payment` |
| Membaca status tagihan | `GET /api/v1/tagihan/{tagihanId}` |
| Webhook Mayar | `POST /api/v1/webhooks/mayar` |
| Riwayat pembayaran Wali | `/wali/pembayaran` |
| Ledger pembayaran Admin | `/admin/pembayaran` |
| Konfirmasi pembayaran | `/wali/tagihan/success?tagihanId={id}` |

Body untuk membuat link pembayaran:

```json
{
  "method": "qris"
}
```

Gunakan `"all"` untuk membiarkan Mayar menampilkan seluruh channel yang aktif. Endpoint ini membutuhkan session login dan request same-origin.

## Channel Pembayaran

Kode channel yang digunakan oleh form LIMO:

- `qris`
- `va/bni`
- `va/bri`
- `va/mandiri`
- `va/cimb`
- `va/permata`
- `va/bjb`
- `va/bsi`
- `ewallet/dana`
- `ewallet/gopay`
- `ewallet/linkaja`
- `ewallet/shopeepay`
- `ewallet/jenius`
- `outlet/alfamart`

Channel harus diaktifkan terlebih dahulu pada dashboard merchant Mayar. Jika channel tidak aktif, Mayar dapat mengembalikan HTTP 400.

## Request ke Mayar

Server LIMO mengirim request seperti berikut ke V2:

```http
POST https://api.mayar.id/hl/v2/invoices/create
Authorization: Bearer <MAYAR_API_KEY>
Content-Type: application/json
```

Contoh body:

```json
{
  "name": "Nama Wali",
  "email": "wali@example.com",
  "mobile": "081234567890",
  "description": "SPP Agustus",
  "expiredAt": "2026-08-11T00:00:00.000Z",
  "items": [
    {
      "quantity": 1,
      "rate": 250000,
      "description": "SPP Agustus"
    }
  ],
  "paymentMethod": "qris",
  "extraData": {
    "noCustomer": "tagihan-limo-id",
    "idProd": "tagihan-limo-id",
    "tagihanId": "tagihan-limo-id",
    "source": "limo"
  }
}
```

Response yang disimpan LIMO:

```json
{
  "statusCode": 200,
  "messages": "success",
  "data": {
    "id": "mayar-invoice-id",
    "transactionId": "mayar-transaction-id",
    "link": "https://merchant.myr.id/invoices/example",
    "expiredAt": 1781136000000
  }
}
```

## Konfigurasi Webhook

LIMO memvalidasi secret custom melalui query parameter `secret` atau header `x-mayar-webhook-secret`. Cara yang dipakai saat mendaftarkan URL di dashboard Mayar adalah query parameter.

URL production:

```text
https://limo.example.com/api/v1/webhooks/mayar?secret=<MAYAR_WEBHOOK_SECRET>
```

Langkah konfigurasi:

1. Deploy aplikasi LIMO ke domain publik HTTPS.
2. Pastikan `APP_URL`, `MAYAR_MERCHANT_ID`, dan `MAYAR_WEBHOOK_SECRET` sudah benar.
3. Buka menu Integration atau Webhook di dashboard Mayar.
4. Masukkan URL webhook publik LIMO.
5. Aktifkan event `payment.received`.
6. Jalankan fitur Test URL Hook dari Mayar.
7. Periksa response HTTP dan log aplikasi.

Contoh payload pembayaran diterima:

```json
{
  "event": "payment.received",
  "data": {
    "id": "mayar-transaction-id",
    "transactionId": "mayar-transaction-id",
    "productId": "mayar-invoice-id",
    "status": "SUCCESS",
    "transactionStatus": "paid",
    "merchantId": "mayar-merchant-id",
    "amount": 250000,
    "paymentMethod": "qris",
    "updatedAt": "2026-08-10T10:00:00.000Z"
  }
}
```

Syarat agar event menandai tagihan lunas:

- Secret webhook benar.
- `merchantId` sesuai `MAYAR_MERCHANT_ID` jika diisi.
- Referensi Mayar atau `extraData.tagihanId` dapat dipetakan ke tagihan LIMO.
- `amount` sama persis dengan nominal `Tagihan`.
- Tagihan tidak berstatus `CANCELLED` atau `REFUNDED`.

Webhook disimpan di tabel `WebhookEvent` dan pembayaran disimpan di tabel `Pembayaran`. Payload yang sama tidak diproses ulang.

## Rekonsiliasi Status

Webhook adalah mekanisme utama. Rekonsiliasi digunakan sebagai fallback jika webhook terlambat atau gagal dikirim.

Dry run:

```bash
npm run mayar:reconcile -- --dry-run
```

Memproses maksimal 50 pembayaran pending:

```bash
npm run mayar:reconcile -- --limit=50
```

Job ini membaca invoice pending dari database LIMO, memanggil `GET /invoices/{invoiceId}`, lalu menangani status:

- `paid`: pembayaran dan tagihan menjadi `PAID`.
- `expired` atau `closed`: pembayaran menjadi `EXPIRED` dan tagihan pending kembali `UNPAID`.
- `cancelled`: pembayaran menjadi `CANCELLED` dan tagihan pending kembali `UNPAID`.

Jalankan job melalui cron atau systemd timer dengan external lock. Jangan menjalankannya sebagai loop di proses web Next.js.

## Pengujian

Verifikasi lokal kode:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Pengujian webhook manual membutuhkan `tagihanId` dan nominal yang benar:

```bash
curl --request POST "https://limo.example.com/api/v1/webhooks/mayar?secret=<MAYAR_WEBHOOK_SECRET>" --header "Content-Type: application/json" --data-raw '{"event":"payment.received","data":{"id":"test-transaction-1","transactionId":"test-transaction-1","merchantId":"<MAYAR_MERCHANT_ID>","amount":250000,"status":"SUCCESS","transactionStatus":"paid","extraData":{"tagihanId":"<TAGIHAN_ID>"}}}'
```

Untuk Windows PowerShell, gunakan `Invoke-RestMethod` agar tidak bergantung pada alias `curl`:

```powershell
$payload = @{
  event = "payment.received"
  data = @{
    id = "test-transaction-1"
    transactionId = "test-transaction-1"
    merchantId = "<MAYAR_MERCHANT_ID>"
    amount = 250000
    status = "SUCCESS"
    transactionStatus = "paid"
    extraData = @{ tagihanId = "<TAGIHAN_ID>" }
  }
} | ConvertTo-Json -Compress

Invoke-RestMethod -Method Post -Uri "https://limo.example.com/api/v1/webhooks/mayar?secret=<MAYAR_WEBHOOK_SECRET>" -ContentType "application/json" -Body $payload
```

Jangan menggunakan payload test pada tagihan production yang nyata kecuali memang sedang melakukan UAT terkontrol.

## Troubleshooting

| Gejala | Penyebab dan solusi |
|---|---|
| `MAYAR_API_KEY belum dikonfigurasi` | Isi `MAYAR_API_KEY`, restart aplikasi, lalu pastikan environment yang aktif benar. |
| HTTP 400 dari Mayar | Periksa channel aktif, format nomor mobile, nominal integer, dan waktu `expiredAt`. |
| Link pembayaran tidak muncul | Pastikan API key tersedia dan Wali memiliki nomor telepon valid. |
| Status tetap `PENDING` | Periksa URL webhook publik, HTTPS, secret query, merchant ID, dan webhook history Mayar. Jalankan rekonsiliasi. |
| Webhook HTTP 400 | Payload bukan JSON valid, struktur `event/data` tidak sesuai, atau nominal tidak tersedia. |
| Webhook HTTP 403 | Secret atau merchant ID tidak sesuai. |
| Webhook HTTP 409 | Referensi tagihan atau nominal pembayaran tidak konsisten. |
| Link lama tidak dapat dibuka | Link sudah expired. Tekan `Buat Instruksi Bayar` untuk membuat invoice baru. |
| Notifikasi tidak diterima | Periksa `NOTIFICATION_PROVIDER`, konfigurasi SMTP atau n8n, lalu jalankan job retry notifikasi. |

## n8n untuk Notifikasi

Integrasi Mayar tidak bergantung pada n8n. n8n hanya dipakai jika LIMO menggunakan provider notifikasi `n8n`.

```env
NOTIFICATION_PROVIDER=n8n
N8N_EMAIL_WEBHOOK_URL=https://n8n.example.com/webhook/limo-email
N8N_WHATSAPP_WEBHOOK_URL=https://n8n.example.com/webhook/limo-whatsapp
N8N_WEBHOOK_SECRET=replace-with-n8n-secret
```

LIMO mengirim `X-Limo-Webhook-Secret` ke n8n. n8n harus memvalidasi header tersebut sebelum meneruskan notifikasi email atau WhatsApp.

## Checklist Production

- [ ] Menggunakan `MAYAR_ENV=production`.
- [ ] API key production memiliki akses Read & Write.
- [ ] `MAYAR_API_KEY` hanya tersedia di server.
- [ ] `MAYAR_MERCHANT_ID` sesuai merchant production.
- [ ] `MAYAR_WEBHOOK_SECRET` acak, panjang, dan tidak dibagikan.
- [ ] URL webhook menggunakan HTTPS dan dapat diakses dari internet.
- [ ] Event `payment.received` aktif di dashboard Mayar.
- [ ] Channel pembayaran sudah aktif di dashboard Mayar.
- [ ] Pembayaran sandbox berhasil diuji sebelum production.
- [ ] Rekonsiliasi Mayar dijadwalkan.
- [ ] Log webhook dan job dipantau.
- [ ] Notifikasi production menggunakan SMTP atau n8n, bukan `console`.

## File Implementasi LIMO

- `src/server/providers/payment/mayar.ts`: HTTP client, response validation, webhook parsing, dan konfigurasi endpoint.
- `src/server/services/payment-service.ts`: membuat payment, memproses webhook, dan rekonsiliasi manual.
- `src/server/services/job-service.ts`: rekonsiliasi invoice pending melalui API detail Mayar.
- `src/app/api/v1/tagihan/[id]/payment/route.ts`: endpoint pembuatan link pembayaran.
- `src/app/api/v1/webhooks/mayar/route.ts`: endpoint penerima webhook Mayar.
- `src/components/dashboard/payment-button.tsx`: form channel dan redirect ke hosted checkout.
- `docs/MAYAR_N8N_INTEGRATION.md`: ringkasan integrasi Mayar dan n8n.
