# Role Access Matrix

Matrix ini mendokumentasikan akses MVP berdasarkan implementasi saat ini. Menu bukan mekanisme keamanan; service dan policy tetap menjadi pengaman utama.

| Area | Admin | Guru | Wali |
|---|---|---|---|
| Dashboard | Semua ringkasan operasional | Kelas yang diampu | Anak yang terhubung |
| Pendaftaran | Review, approve, reject, unduh dokumen | Tidak ada | Status publik via kode+email |
| Program/Level/Kelas | Create/list dasar | Lihat kelas yang diampu | Tidak ada |
| Guru/Wali/Siswa | Create/list dasar | Tidak ada | Lihat anak terhubung |
| File Dokumen Pendaftaran | Download authorized | Tidak ada | Belum ada portal download dokumen |
| Materi | Service mendukung override admin | Create/list/upload untuk kelas diampu | Belum expose halaman materi wali |
| Bank Soal | Service mendukung admin | Create/list soal kelas diampu/umum | Tidak ada |
| Ujian | Service mendukung admin | Builder ujian dan input hasil offline | Lihat nilai final via ringkasan progres |
| Presensi | Service mendukung admin | Input untuk sesi kelas diampu | Lihat ringkasan presensi anak |
| Progres | Service mendukung admin | Input untuk sesi kelas diampu | Lihat catatan publik anak |
| Tagihan | Tarif, generate, rekonsiliasi | Tidak ada | Lihat tagihan anak |
| Payment Webhook | Sistem/provider only | Tidak ada | Tidak ada |
| Audit | Data model tersedia | Tidak ada | Tidak ada |

## Policy Utama

- `canAccessStudent`: Admin semua, Guru siswa kelas diampu, Wali anak terhubung.
- `canManageClass`: Admin semua, Guru kelas diampu.
- `canAccessInvoice`: Admin semua, Wali tagihan anak terhubung.
- `canDownloadFile`: Admin semua, Guru materi kelas diampu, Wali materi published kelas anak.

## Catatan Gap

- Halaman audit admin belum dibuat.
- Halaman materi untuk Wali belum dibuat.
- Edit/update/delete/arsip masih terbatas pada beberapa create/list dasar.
