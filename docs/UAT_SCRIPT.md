# UAT Script

Gunakan data dummy yang menyerupai kondisi LIMO. Catat temuan sebagai `blocker`, `major`, `minor`, atau `change request`.

## Persiapan

- Database sudah dimigrasikan.
- Seed development atau data UAT sudah tersedia.
- Admin, Guru, dan Wali bisa login.
- Private storage path bisa ditulis aplikasi.
- APP_URL, session secret, dan environment payment dev sudah terisi.

## Skenario Publik

1. Buka landing page `/`.
2. Klik CTA daftar.
3. Submit pendaftaran dengan dokumen PDF/JPG/PNG valid.
4. Simpan kode pendaftaran.
5. Cek status di `/status-pendaftaran` memakai kode + email wali.
6. Uji status lookup dengan email salah, harus gagal aman.

## Skenario Admin

1. Login sebagai Admin.
2. Buka `/admin/pendaftaran`.
3. Unduh dokumen pendaftaran melalui link authorized.
4. Approve satu pendaftaran.
5. Reject satu pendaftaran lain dengan alasan aman.
6. Buat Program, Level, Kelas.
7. Buat Guru, Wali, Siswa.
8. Buat Tarif.
9. Generate tagihan dry-run, lalu non-dry-run.
10. Rekonsiliasi manual satu tagihan dengan alasan.
11. Buka `/admin/laporan`, pilih periode, periksa ringkasan kelas/siswa, lalu unduh CSV.

## Skenario Guru

1. Login sebagai Guru.
2. Pastikan hanya kelas yang diampu terlihat.
3. Buat sesi kelas.
4. Buat materi teks dan link video.
5. Upload file materi PDF/JPG/PNG.
6. Buat soal PG dan esai.
7. Buat ujian dari bank soal.
8. Input hasil ujian offline untuk satu siswa.
9. Input presensi dan progres untuk sesi.
10. Buka ringkasan kelas.

## Skenario Wali

1. Login sebagai Wali.
2. Pastikan hanya anak terhubung terlihat.
3. Buka ringkasan progres anak.
4. Cek presensi, progres, dan nilai final.
5. Buka tagihan anak.
6. Pastikan Wali tidak bisa membuka URL anak/tagihan lain.

## Skenario Security Regression Manual

- Akses `/admin` tanpa login harus redirect/login-blocked.
- Guru membuka URL kelas guru lain harus ditolak.
- Wali membuka ringkasan siswa lain harus ditolak.
- Download file tanpa login harus ditolak.
- Upload file `.html`, `.svg`, atau MIME palsu harus ditolak.
- Mutation tanpa origin valid harus ditolak.
- Webhook Pakasir signature salah harus ditolak.
- Laporan Admin hanya dapat dibuka Admin, filter periode mengubah data, dan CSV berisi header serta baris siswa.
- Jawaban ujian online tetap tersedia setelah reload, draft tidak tampil sebagai nilai final, dan attempt expired menolak perubahan.
- Saat koneksi Wali terputus, peringatan tampil, tombol submit tertahan, lalu draft tersimpan kembali setelah koneksi pulih.
- Wali dapat memilih satu anak atau `Semua Anak`; data dashboard dan menu utama berubah sesuai pilihan tanpa membuka data anak yang tidak terhubung.
