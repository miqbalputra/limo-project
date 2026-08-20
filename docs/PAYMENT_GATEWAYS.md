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
