# Integrasi Payment Gateway LIMO

LIMO mendukung Mayar dan Pakasir secara bersamaan. Pengaturan dilakukan Admin melalui:

`/admin/pembayaran/pengaturan`

## Keamanan

Tambahkan satu secret stabil di Dokploy sebelum menyimpan credential dari dashboard:

```env
PAYMENT_CONFIG_ENCRYPTION_KEY=<base64-dari-32-byte-random>
```

Contoh membuat key:

```bash
openssl rand -base64 32
```

Jangan mengganti key tersebut setelah konfigurasi tersimpan. Jika key hilang atau berubah, credential terenkripsi tidak dapat dibuka.

## Mayar

Isi API key Read & Write, environment, merchant ID, dan webhook secret. Setelah menyimpan, salin URL webhook dari kartu Mayar ke dashboard Mayar dan aktifkan event `payment.received`.

```text
https://domain-aplikasi/api/v1/webhooks/mayar?secret=<secret-yang-sama>
```

Konfigurasi `MAYAR_*` lama tetap dapat dipakai sebagai fallback selama belum ada konfigurasi gateway yang disimpan dari dashboard.

## Pakasir

Buat project Pakasir, lalu isi project slug, API key, dan webhook secret LIMO pada kartu Pakasir. Salin URL berikut ke pengaturan webhook project Pakasir:

```text
https://domain-aplikasi/api/v1/webhooks/pakasir?secret=<secret-yang-sama>
```

LIMO menggunakan hosted checkout Pakasir. Wali dapat memilih semua metode atau QRIS saja. Status pembayaran dikonfirmasi melalui webhook dan Transaction Detail API.

## Mode provider

- Satu provider aktif: Wali langsung diarahkan ke provider tersebut.
- Dua provider aktif: Wali dapat memilih Mayar atau Pakasir; provider utama menjadi pilihan awal.
- Tidak ada provider aktif: aplikasi tetap berjalan, tetapi tombol pembayaran dinonaktifkan.

Menonaktifkan provider hanya mencegah pembuatan pembayaran baru. Riwayat pembayaran dan tagihan lama tidak dihapus.

## Rekonsiliasi

Gunakan scheduler sesuai kebutuhan:

```bash
npm run mayar:reconcile -- --dry-run
npm run pakasir:reconcile -- --dry-run
```

Jalankan tanpa `--dry-run` setelah hasil pemeriksaan sesuai. Jangan mencetak API key, webhook secret, atau `PAYMENT_CONFIG_ENCRYPTION_KEY` ke log.

## UAT Merchant Nyata (wajib sebelum go-live)

Uji integrasi dengan **merchant sungguhan dan transaksi kecil** (mis. Rp 1.000–10.000) sebelum dipakai tagihan asli. Uji di domain produksi (HTTPS wajib untuk webhook) atau staging yang dapat dijangkau dashboard merchant.

### Persiapan

1. Set `PAYMENT_CONFIG_ENCRYPTION_KEY` di environment.
2. Login Admin → `/admin/pembayaran/pengaturan` → isi kredensial Mayar/Pakasir (API key, secret webhook, merchant ID/project slug) dari dashboard merchant.
3. Klik **Tes koneksi** pada kartu provider — harus sukses tanpa membuat transaksi.
4. Salin URL webhook ke dashboard merchant dan pastikan event `payment.received` (Mayar) / webhook (Pakasir) aktif.

### Skenario wajib (per provider)

| # | Skenario | Hasil yang diharapkan |
|---|----------|----------------------|
| 1 | Wali buka tagihan → klik Bayar → checkout provider terbuka | URL pembayaran terbentuk, nominal & deskripsi benar |
| 2 | Bayar transaksi kecil (QRIS/VA) sampai sukses di sisi provider | Webhook masuk dalam ±1 menit, status tagihan → `PAID` tanpa reload manual |
| 3 | Kirim ulang webhook yang sama (replay) | Aman: tidak ada double-payment, respons idempoten |
| 4 | Webhook dengan secret salah / merchant ID salah | Ditolak 4xx dan tidak mengubah tagihan (lihat log) |
| 5 | Biarkan satu invoice kedaluwarsa | Status → `EXPIRED`/terlambat, tombol bayar nonaktif |
| 6 | `npm run mayar:reconcile -- --dry-run` (atau `pakasir:reconcile`) | Transaksi uji terbaca; jalankan tanpa `--dry-run` untuk sinkronisasi bila ada selisih |
| 7 | Notifikasi wali | Wali menerima notifikasi pembayaran berhasil (email/WhatsApp sesuai provider notifikasi) |

### Lulus UAT bila

- Seluruh skenario di atas hijau di **kedua** provider yang akan diaktifkan.
- Satu pembayaran uji berhasil dilihat di `/admin/pembayaran` dengan sumber provider yang benar.
- Audit log mencatat pembayaran dan perubahan status tagihan.
- Tidak ada secret yang muncul di log aplikasi maupun log n8n.

Setelah UAT lulus, hapus/arsipkan tagihan uji (rekonsiliasi manual dengan alasan "UAT" bila perlu) agar laporan keuangan tidak tercemar transaksi uji.
