# Role Access Matrix

Matrix ini mendokumentasikan akses MVP berdasarkan implementasi saat ini. Menu bukan mekanisme keamanan; service dan policy tetap menjadi pengaman utama.

| Area | Admin | Guru | Wali | Siswa |
|---|---|---|---|---|
| Dashboard | Semua ringkasan operasional | Kelas yang diampu | Anak yang terhubung | Data akademik sendiri |
| Pendaftaran | Review, approve, reject, unduh dokumen | Tidak ada | Status publik via kode+email | Tidak ada |
| Program/Level/Kelas | Create/list dasar | Lihat kelas yang diampu | Tidak ada | Lihat kelas aktif sendiri |
| Guru/Wali/Siswa | Create/list dasar | Tidak ada | Lihat anak terhubung | Lihat profil sendiri |
| File Dokumen Pendaftaran | Download authorized | Tidak ada | Belum ada portal download dokumen | Tidak ada |
| Materi | Service mendukung override admin | Create/list/upload untuk kelas diampu | Lihat materi published anak | Lihat materi published kelas sendiri |
| Modul Pembelajaran | Lihat operasional | Builder modul, item existing, reorder, publish/archive/duplicate untuk kelas diampu | Struktur published anak secara read-only | Struktur published kelas sendiri |
| Tugas Online | Lihat operasional | Create/publish/archive dan monitor submission kelas diampu | Lihat tugas, jawaban, file, dan status anak secara read-only | Autosave draft dan submit sesuai tipe tugas |
| RPP | Service mendukung admin | Create/publish/archive kelas diampu | Lihat RPP published anak | Belum ada akses khusus |
| Bank Soal | Service mendukung admin | Create/list soal kelas diampu/umum | Tidak ada | Tidak ada |
| Ujian | Service mendukung admin | Builder ujian dan input hasil offline | Lihat nilai final via ringkasan progres | Lihat ujian published, belum submit |
| Presensi | Service mendukung admin | Input untuk sesi kelas diampu | Lihat ringkasan presensi anak | Lihat presensi sendiri |
| Progres | Service mendukung admin | Input untuk sesi kelas diampu | Lihat catatan publik anak | Lihat progres sendiri |
| Tagihan | Tarif, generate, rekonsiliasi | Tidak ada | Lihat tagihan anak | Belum tersedia |
| Payment Webhook | Sistem/provider only | Tidak ada | Tidak ada | Tidak ada |
| Audit | Lihat dan ekspor | Tidak ada | Tidak ada | Tidak ada |

## Policy Utama

- `canAccessStudent`: Admin semua, Guru siswa kelas diampu, Wali anak terhubung, Siswa hanya record dirinya sendiri melalui `SiswaAccount` aktif.
- `canManageClass`: Admin semua, Guru kelas diampu.
- `canAccessInvoice`: Admin semua, Wali tagihan anak terhubung.
- `canDownloadFile`: Admin semua, Guru materi/RPP kelas diampu, Wali materi/RPP published kelas anak, Siswa hanya file owner dirinya sendiri.

## Catatan Gap

- Fase 1 sudah menyediakan akun, login, policy, API, dan dashboard Siswa.
- Fase 2 sudah menyediakan schema, migration, API, builder Guru, struktur Siswa, dan tampilan read-only Wali; item assignment/quiz/discussion belum aktif.
- Fase 3 sudah menyediakan tugas, submission berversi, private file, late/cutoff, attempt history, dan Wali read-only; grading/rubrik masuk Fase 4.
- Siswa belum dapat mengerjakan tugas atau ujian online melalui actor sendiri; alur tersebut masuk fase assignment berikutnya.
- Siswa belum memiliki akses billing, RPP khusus, atau menu notifikasi terpisah karena masih memakai shell dashboard bersama.
- Edit/update/delete/arsip masih terbatas pada beberapa modul existing.
