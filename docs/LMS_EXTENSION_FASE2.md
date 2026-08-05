# LMS Extension Fase 2

## Scope

Fase 2 menambahkan alur modul pembelajaran tanpa mengganti daftar `Materi` existing. `ModuleItem` menggunakan referensi polymorphic terkontrol untuk `MATERIAL`, `EXAM`, dan `CLASS_SESSION`; tipe `ASSIGNMENT`, `QUIZ`, dan `DISCUSSION` sudah disiapkan pada enum tetapi ditolak service sampai fase domainnya tersedia.

## Database

- Schema: `LearningModule` dan `ModuleItem` di `prisma/schema.prisma`.
- Migration: `prisma/migrations/20260805030000_learning_modules/migration.sql`.
- Unique constraint mencegah entity yang sama dipasang dua kali pada modul yang sama.
- Reorder dan duplicate item berjalan dalam transaksi.
- Duplicate hanya menyalin struktur modul; tidak ada submission atau nilai yang ikut disalin.

## API

- `GET/POST /api/v1/guru/kelas/:kelasId/modul`
- `GET/PATCH /api/v1/guru/modul/:moduleId`
- `POST /api/v1/guru/modul/:moduleId/items`
- `DELETE /api/v1/guru/modul/:moduleId/items/:itemId`
- `PATCH /api/v1/guru/modul/:moduleId/reorder`
- `POST /api/v1/guru/modul/:moduleId/publish`
- `POST /api/v1/guru/modul/:moduleId/archive`
- `POST /api/v1/guru/modul/:moduleId/duplicate`
- `GET /api/v1/siswa/kelas/:kelasId/modul`
- `GET /api/v1/wali/anak/:siswaId/kelas/:kelasId/modul`

Semua mutation memakai same-origin check, session actor, feature flag, policy kelas, validasi server-side, dan audit log. Siswa/Wali hanya menerima modul `PUBLISHED` yang sudah melewati `releaseAt`.

## UI

- Guru: `/guru/kelas/[kelasId]/modul` untuk builder, schedule, publish/archive, duplicate, add/remove item, dan reorder item.
- Siswa: `/siswa/kelas/[kelasId]/modul` untuk struktur alur belajar published.
- Wali: `/wali/progres/[siswaId]/modul` untuk struktur read-only per kelas anak.

## Verification

- `npm test` lulus.
- `npm run test:week4` lulus.
- `npm run test:week1`, `npm run test:week2`, dan `npm run test:week3` lulus.
- `npm run test:e2e` lulus, `14/14`.
- `npm run typecheck`, `npm run lint`, dan `npm run build` lulus.

MariaDB migration parity dan UAT production tetap menunggu environment MariaDB yang belum tersedia lokal.
