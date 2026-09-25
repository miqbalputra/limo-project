# Role Access Matrix

Matrix ini mendokumentasikan akses MVP berdasarkan implementasi saat ini. Menu bukan mekanisme keamanan; service dan policy tetap menjadi pengaman utama.

| Area | Admin | Guru | Wali | Siswa |
|---|---|---|---|---|
| Dashboard | Semua ringkasan operasional | Kelas yang diampu | Anak yang terhubung | Data akademik sendiri |
| Pendaftaran | Review, approve, reject, unduh dokumen | Tidak ada | Status publik via kode+email | Tidak ada |
| Program/Level/Kelas | Create/list dasar | Lihat kelas yang diampu | Tidak ada | Lihat kelas aktif sendiri |
| Guru/Wali/Siswa | Guru & Wali: CRUD, arsip/restore, aktif/nonaktif, kirim ulang aktivasi, kirim link reset password, impor CSV, cabut sesi. Siswa: buat akun portal | Tidak ada | Lihat anak terhubung | Lihat profil sendiri |
| File Dokumen Pendaftaran | Download authorized | Tidak ada | Belum ada portal download dokumen | Tidak ada |
| Materi | Service mendukung override admin | Create/list/upload untuk kelas diampu | Lihat materi published anak | Lihat materi published kelas sendiri |
| Modul Pembelajaran | Lihat operasional | Builder modul, item existing, reorder, publish/archive/duplicate untuk kelas diampu | Struktur published anak secara read-only | Struktur published kelas sendiri |
| Tugas Online | Lihat operasional | Create/publish/archive dan monitor submission kelas diampu | Lihat tugas, jawaban, file, dan status anak secara read-only | Autosave draft dan submit sesuai tipe tugas |
| RPP | Service mendukung admin | Create/publish/archive kelas diampu | Lihat RPP published anak | Belum ada akses khusus |
| Bank Soal | Service mendukung admin | Create/list soal kelas diampu/umum | Tidak ada | Tidak ada |
| Ujian | Service mendukung admin | Builder ujian, input hasil offline, koreksi | Kerjakan ujian daring mode wali untuk anak + lihat nilai final | Kerjakan ujian daring mode siswa (mulai/draf/kumpulkan), unduh berkas jawaban sendiri, lihat nilai setelah dirilis |
| Pengumuman | Lihat semua + kelola laporan | Buat/ubah/arsip pengumuman untuk kelas diampu | Baca sesuai audience (SISWA/WALI/SEMUA) + tandai sudah dibaca | Baca sesuai audience + tandai sudah dibaca |
| Diskusi | Tinjau laporan konten, putuskan selesaikan/abaikan | Buat/balas, pin/kunci/sembunyikan/hapus, tandai jawaban guru, lampirkan berkas | Baca + balas (tanpa moderasi) | Buat thread, baca, balas, laporkan |
| Presensi | Service mendukung admin | Input untuk sesi kelas diampu | Lihat ringkasan presensi anak | Lihat presensi sendiri |
| Progres | Service mendukung admin | Input untuk sesi kelas diampu | Lihat catatan publik anak | Lihat progres sendiri |
| Kalender | Kelola event global/kelas | Kalender kelas diampu dan event manual kelas | Kalender seluruh anak terhubung | Kalender kelas aktif sendiri |
| To-do | Tidak ada tindakan akademik | Draft, submission, sesi, dan nilai yang tertunda | Tugas, ujian, dan jadwal anak | Tugas, revisi, dan ujian sendiri |
| Tagihan | Tarif, generate, rekonsiliasi | Tidak ada | Lihat tagihan anak | Belum tersedia |
| Payment Webhook | Sistem/provider only | Tidak ada | Tidak ada | Tidak ada |
| Audit | Lihat dan ekspor | Tidak ada | Tidak ada | Tidak ada |

## Policy Utama

- `canAccessStudent`: Admin semua, Guru siswa kelas diampu, Wali anak terhubung, Siswa hanya record dirinya sendiri melalui `SiswaAccount` aktif.
- `canManageClass`: Admin semua, Guru kelas diampu.
- `canAccessInvoice`: Admin semua, Wali tagihan anak terhubung.
- `canDownloadFile`: Admin semua, Guru materi/RPP kelas diampu, Wali materi/RPP published kelas anak, Siswa hanya file owner dirinya sendiri.
- Attempt ujian di-scope ke pemiliknya: Wali lewat `UjianAttempt.waliProfileId`, Siswa lewat `UjianAttempt.siswaAccountId`. Service menolak akses lintas pemilik (wali↔siswa) dan lintas siswa, dan hanya satu attempt aktif per (ujian, siswa).
- Mode aman (`Ujian.secureMode`): pemutar mencatat perpindahan tab ke `UjianAttempt.violationCount`; hanya pemilik attempt yang dapat melapor, dan Guru melihatnya di halaman koreksi. Rilis nilai: `Ujian.showResultToSiswa` mengatur apakah nilai siswa tampil; saat ditahan status menjadi "Dikirim" tanpa nilai.
- Pengumuman & diskusi berada di balik flag `CLASS_DISCUSSION_ENABLED`; scoping kelas terpusat pada `assertViewKelasForum`/`assertManageKelasForum` (`src/server/policies/access-policy.ts`). Siswa/wali di luar kelas menerima **404**, guru non-pengampu menerima **403**.
- **Penyimpangan dari `rencana.md` FASE 9 yang disetujui**: wali boleh membalas thread (spesifikasi menyebut wali default read-only). Wali tidak boleh membuat thread baru.

## Catatan Gap

- Fase 1 sudah menyediakan akun, login, policy, API, dan dashboard Siswa.
- Modul akun Guru & Wali menyediakan arsip (soft delete)/restore, aktif/nonaktif, cabut sesi, kirim ulang aktivasi, kirim link reset password, dan impor CSV massal dengan pratinjau; semua aksi tercatat di audit log (`GURU_ARCHIVED`, `WALI_RESTORED`, `GURU_IMPORTED`, dst).
- Fase 2 sudah menyediakan schema, migration, API, builder Guru, struktur Siswa, dan tampilan read-only Wali; item assignment/quiz/discussion belum aktif.
- Fase 3 sudah menyediakan tugas, submission berversi, private file, late/cutoff, attempt history, dan Wali read-only; grading/rubrik masuk Fase 4.
- Siswa dapat mengerjakan tugas dan ujian daring melalui akun sendiri; ujian mode `ONLINE_VIA_SISWA`/`BOTH` memakai portal `/siswa/ujian`, sedangkan mode wali tetap jalur pendampingan orang tua. Rekaman speaking langsung, interaksi drag match/order, dan mode aman (deteksi pindah tab) masih backlog.
- Siswa belum memiliki akses billing, RPP khusus, atau menu notifikasi terpisah karena masih memakai shell dashboard bersama.
- Edit/update/delete/arsip masih terbatas pada beberapa modul existing.
