# Known Limitations and Open Issues

Dokumen ini mencatat gap MVP saat ini agar tidak dianggap selesai diam-diam.

## Infrastruktur

- Migration database nyata belum dijalankan di environment ini karena Docker CLI/MariaDB belum tersedia.
- Acceptance test SQLite dan E2E Playwright sudah tersedia; parity test MariaDB production belum dijalankan di environment ini.
- Rate limit aplikasi masih in-process; deployment multi-instance tetap membutuhkan Redis atau rate limit di reverse proxy.

## Payment

- Mayar menjadi provider pembayaran resmi. Webhook dilindungi secret LIMO dan validasi merchant/nominal jika credential production sudah dikonfigurasi.
- Reconciliation Mayar menggunakan detail invoice API melalui `npm run mayar:reconcile`.
- Kredensial production Mayar dan UAT end-to-end di merchant nyata belum dilakukan di environment ini.
- Redirect browser tidak mengubah status pembayaran, sesuai PRD.

## Notifikasi

- Provider email SMTP tersedia melalui `NOTIFICATION_PROVIDER=email` dan script `npm run notifications:retry`.
- Provider n8n tersedia untuk email/WhatsApp; pengiriman WhatsApp tetap dilakukan oleh workflow GOWA eksternal, bukan langsung dari LIMO.

## UI/UX

- Dashboard shell sudah memakai pola TailAdmin termasuk sidebar collapse, command search, profile dropdown, breadcrumb, dan dropdown notifikasi berbasis data; polish visual per modul masih bisa dilanjutkan.
- Modul akun Guru/Wali sudah memiliki CRUD, arsip/restore, reset password, kirim ulang aktivasi, dan impor CSV; modul lain belum semuanya memiliki edit/update/delete/arsip lengkap.
- Tabel besar belum semua memakai pagination UI penuh, meskipun query utama dibatasi.
- Aksi destruktif pada materi, ujian, sesi, dan hero carousel memakai `ConfirmDialog` in-app (bukan `window.confirm`); label enum (mis. aksi audit) tidak lagi mencetak token mentah. Sisa `window.confirm` hanya tombol bersihkan jawaban di pemutar kuis publik.
- Halaman `/guru/bank-soal` kini memberi `aria-label` pada `<select>` kelas/tipe soal, dan tombol "Simpan sesi" memenuhi target sentuh ≥44px; audit axe halaman Guru (`/guru/sesi`, `/guru/penilaian-esai`, `/guru/bank-soal`) lulus.
- Beberapa form dashboard masih memanggil `event.currentTarget.reset()` **setelah** `await`, yang di React bernilai `null` sehingga `router.refresh()` tidak pernah jalan (item tersimpan tetapi daftar tidak menyegar tanpa reload). Sudah diperbaiki di `session-workspace.tsx` (buat sesi) & `hasil-ujian-form.tsx`; pola sama masih ada di `ujian-form.tsx`, `student-account-form.tsx`, `rpp-form.tsx`, `remedial-manager.tsx`, `master-data-forms.tsx`, `lms-forms.tsx`, `learning-module-builder.tsx`, `hero-carousel-form.tsx`, `billing-forms.tsx`, `bank-soal-form.tsx`, dan `assignment-builder.tsx`.

## Akademik

- Online exam kini memiliki paritas Google Forms: penegakan jawaban wajib di server, grace window + auto-submit, kunci alternatif, validasi kotak centang/paragraf, branching semua tipe pilihan, email responden + limit per email, salinan/notifikasi respons, rilis nilai tertunda, mode satu soal per halaman, dan impor soal. Yang masih backlog: rekaman suara (speaking), interaksi menjodohkan/urutan berbasis drag di pemutar, dan impor soal per-butir (saat ini seluruh soal formulir sumber).
- Ujian mandiri siswa: siswa dapat mengerjakan ujian daring dari akun sendiri (mode `ONLINE_VIA_SISWA`/`BOTH`) melalui portal `/siswa/ujian`; attempt ter-scope ke `siswaAccountId`. Mode aman (`Ujian.secureMode`) mencatat perpindahan tab pada attempt, nilai dapat ditahan guru lewat `Ujian.showResultToSiswa`, dan siswa dapat mengunduh berkas jawabannya sendiri. Backlog: mode aman lebih kuat (fullscreen/anti-paste) serta rilis nilai per attempt, bukan per ujian.
- Hasil `NEEDS_REVIEW`, `FINAL`, dan `CORRECTED` memiliki jalur review/koreksi Guru; hasil final tetap dikunci dari input biasa.
- Gradebook Siswa/Wali hanya menampilkan nilai final yang sudah dipublikasikan: skor provisional (`calculatedScore`, skor kategori/item, `letterGrade`) tidak dikirim ke klien sebelum `FinalGrade` dipublikasikan (`exposeProvisionalScores:false`), diverifikasi `npm run test:week7`.
- Pengumuman & diskusi kelas tersedia (fase A/B/C dari Fase 9 `rencana.md`): pengumuman dengan audience, prioritas, jadwal terbit/berakhir, dan status baca; thread + balasan dengan pin/kunci/sembunyikan/soft-delete + audit; lapor konten ke antrean admin; lampiran thread berpenyimpanan privat. Yang masih backlog: Q&A per materi/modul (entri `ModuleItemType.DISCUSSION` masih ditolak service), lampiran pada balasan (hanya thread), pengumuman sekolah-wide (`kelasId` null), notifikasi langsung untuk materi baru, dan laporan isi dari siswa per konten dengan bukti.
- Sesi Guru memiliki workflow finalisasi yang mengunci presensi dan progres setelah data lengkap.

## Operasional

- Backup/restore terjadwal, SQL import, ZIP checksum, dan endpoint n8n sudah tersedia; belum diuji nyata terhadap MariaDB staging serta storage off-site.
- Nginx/PM2 config final belum dibuat sebagai file deploy siap pakai.
- Domain/staging/credential provider masih open decision.
