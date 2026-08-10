# LMS Extension Fase 7

## Scope

Fase 7 menambahkan tracking completion aktivitas dan progres belajar pada Learning Module. Sumber completion berasal dari materi, tugas, ujian, rule manual, dan prerequisite antar aktivitas.

## Database

- Migration: `prisma/migrations/20260806050000_activity_completion/migration.sql`.
- `CompletionRule` menyimpan tipe rule, minimum score, durasi minimum, dan status wajib.
- `StudentActivityCompletion` menyimpan status per Siswa dan aktivitas, sumber evidence, waktu evaluasi, serta audit actor manual.
- `StudentModuleProgress` menyimpan jumlah aktivitas wajib, jumlah selesai, persentase, dan waktu kalkulasi per modul.
- `ModuleItem.archivedAt` dan `archivedById` menambahkan soft archive agar completion history tidak hilang.

## Completion Rules

- `VIEWED`: Siswa menekan `Tandai dilihat` pada aktivitas yang tersedia.
- `SUBMITTED`: submission tugas final atau late sudah tersimpan.
- `GRADED`: nilai tugas published atau hasil ujian final/corrected tersedia.
- `PASSED`: hasil penilaian memenuhi `minimumScore`.
- `MANUAL`: Guru menandai completion dengan alasan yang disimpan pada audit log.

Rule default dibuat berdasarkan tipe item:

- `MATERIAL` menjadi `VIEWED`.
- `ASSIGNMENT` menjadi `SUBMITTED`.
- `EXAM` menjadi `GRADED`.
- `CLASS_SESSION` menjadi `MANUAL`.

Completion otomatis dievaluasi ulang setelah submission tugas, publish nilai rubric, finalisasi/correction ujian offline, dan finalisasi ujian online. Evaluasi bersifat idempotent dan mempertahankan histori completion ketika item diarsipkan.

## Prerequisite and Progress

- Aktivitas dengan `prerequisiteItemId` tidak dapat ditandai dilihat sebelum aktivitas prasyarat berstatus `COMPLETED`.
- Progres modul hanya menghitung `ModuleItem` aktif dan rule/item wajib.
- Siswa menerima progres modul dan tombol `Tandai dilihat`.
- Wali menerima tampilan read-only progres anak.
- Guru menerima matrix Siswa x aktivitas dan dapat mengubah rule `MANUAL` dengan alasan.

## API

- `PATCH /api/v1/guru/modul/:moduleId/items/:itemId` untuk completion rule.
- `DELETE /api/v1/guru/modul/:moduleId/items/:itemId` untuk soft archive aktivitas.
- `POST /api/v1/siswa/kelas/:kelasId/modul/:moduleId/items/:itemId/view` untuk `VIEWED`.
- `GET /api/v1/siswa/kelas/:kelasId/modul/progres` untuk progres Siswa.
- `GET /api/v1/wali/anak/:siswaId/kelas/:kelasId/modul/progres` untuk progres Wali.
- `GET /api/v1/guru/kelas/:kelasId/progres/aktivitas` untuk matrix Guru.
- `PUT /api/v1/guru/kelas/:kelasId/progres/aktivitas/:siswaId/:itemId/manual` untuk completion manual.

## UI

- Guru: `/guru/kelas/[kelasId]/progres` menampilkan matrix completion dan audit manual.
- Siswa: `/siswa/kelas/[kelasId]/modul` menampilkan progres modul, status aktivitas, prerequisite, dan tombol `Tandai dilihat`.
- Wali: `/wali/progres/[siswaId]/modul` menampilkan struktur serta progres modul anak secara read-only.

## Feature Flag

`ACTIVITY_COMPLETION_ENABLED` mengendalikan completion bersama `LEARNING_MODULES_ENABLED`. Default development/test aktif dan default production nonaktif.

## Verification

- `npm run prisma:generate` berhasil.
- `npm run sqlite:setup` berhasil dengan model completion baru.
- `npm test` lulus.
- `npm run typecheck` lulus.
- `npm run lint` lulus.
- `npm run test:week1` sampai `npm run test:week9` lulus.
- `tests/e2e/week9.spec.ts` menguji navigasi mobile Guru, Siswa, dan Wali.

## Known Limitations

- Tracking durasi belum diaktifkan sebagai sumber completion otomatis; field `requiredDurationSeconds` sudah tersedia untuk fase berikutnya.
- Completion rule belum menyediakan builder UI lengkap untuk seluruh tipe rule; endpoint rule sudah tersedia.
- Migration MariaDB nyata dan UAT production masih menunggu environment MariaDB.
