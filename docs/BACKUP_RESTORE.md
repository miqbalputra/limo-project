# Backup and Restore

## Backup Database

Jalankan minimal harian dengan retensi 7 hari.

Contoh konsep:

```bash
mysqldump --single-transaction --routines --triggers limo_db > limo_db_YYYYMMDD.sql
```

Simpan backup dengan permission ketat dan salinan off-server bila memungkinkan.

## Backup File Privat

Backup `PRIVATE_STORAGE_PATH` bersama database agar metadata `FileAsset` tetap cocok dengan file fisik.

Contoh konsep:

```bash
tar -czf limo_private_storage_YYYYMMDD.tar.gz /var/lib/limo/private-storage
```

## Restore Drill

Sebelum go-live, lakukan restore ke database staging/test:

1. Buat database kosong.
2. Restore SQL dump.
3. Restore file privat ke path test.
4. Set `.env` staging mengarah ke database/path tersebut.
5. Jalankan aplikasi.
6. Smoke test login, download file, pendaftaran, presensi, tagihan.

Backup dianggap valid hanya jika restore berhasil diuji.
