# LMS Extension Fase 10 — Laporan Perkembangan Berkala

Sumber rencana: `rencana.md` FASE 10. Flag: `periodicReportsEnabled`.

## Tujuan

Menggabungkan presensi, penyelesaian aktivitas, nilai, dan catatan Guru menjadi laporan periodik per siswa yang mudah dipahami Wali, dengan snapshot agar laporan lama tidak berubah ketika data sumber dikoreksi.

## Model Data

- `ProgressReport`: `studentId`, `kelasId`, `reportType` (`WEEKLY`/`MONTHLY`/`LEVEL_COMPLETION`), `status` (`DRAFT`/`PUBLISHED`/`REVISED`), `periodStart`, `periodEnd`, `summary`, `strengths`, `improvementAreas`, `teacherRecommendation`, `snapshotData` (JSON), `createdById`, `publishedAt`, `revisedAt`, `revisionReason`, `notifiedAt`.
- `ProgressReportRead`: `reportId`, `userId`, `readAt` (unik per laporan + user).

Migrasi: `20261001010000_progress_reports`.

## Aturan

- Snapshot data periode dibangun saat **draf dibuat** dan disimpan di `snapshotData`; publish/revisi tidak membangun ulang snapshot, sehingga data sumber yang dikoreksi setelah terbit tidak mengubah laporan lama.
- Hanya draf yang bisa diubah lewat jalur draf; laporan terbit diubah lewat **revisi** yang mewajibkan alasan dan mencatat audit before/after (`PROGRESS_REPORT_REVISED`).
- Wali hanya melihat laporan berstatus terbit milik anaknya; Siswa hanya miliknya; Guru hanya kelas yang diampu; Admin dapat memantau semua.

## Endpoint

- `POST /api/v1/guru/reports` (buat draf), `GET /api/v1/guru/reports` (daftar).
- `GET`/`PATCH /api/v1/guru/reports/[reportId]` (detail/ubah draf).
- `POST /api/v1/guru/reports/[reportId]/publish`, `POST /api/v1/guru/reports/[reportId]/revise`.
- `GET /api/v1/admin/reports`.
- `GET /api/v1/wali/reports`, `POST /api/v1/wali/reports/[reportId]/read`.
- `GET /api/v1/siswa/reports`, `POST /api/v1/siswa/reports/[reportId]/read`.
- `GET /api/v1/reports/[reportId]/pdf` (dari snapshot terbit).

## Halaman

- Guru: `/guru/laporan-perkembangan` (buat draf, ubah narasi, terbitkan, revisi, unduh PDF).
- Wali: `/wali/laporan`; Siswa: `/siswa/laporan` (baca + tandai dibaca + PDF).
- Admin: `/admin/laporan-perkembangan` (pemantauan).

## Notifikasi

Saat terbit (dan setelah revisi) mengirim notifikasi `laporan-perkembangan` ke Wali dan Siswa dengan klaim atomik `notifiedAt` (idempoten).

## Verifikasi

`typecheck` · `lint` 0 error · `npm test` 43 · `test:guards` 231 route · `npm run build` (159 halaman) · integrasi `npm run test:laporan` 14/14.
