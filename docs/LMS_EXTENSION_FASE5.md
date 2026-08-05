# LMS Extension Fase 5

## Scope

Fase 5 menambahkan Gradebook Terpadu yang menggabungkan Assignment, Ujian, dan entry manual tanpa menyalin atau mengubah sumber nilai. Sinkronisasi berjalan satu arah dari assessment ke Gradebook.

## Database

- Migration: `prisma/migrations/20260806030000_gradebook/migration.sql`.
- `GradeCategory` menyimpan bobot, urutan, dan aturan drop-lowest.
- `GradeItem` menyimpan sumber `ASSIGNMENT`, `EXAM`, `MANUAL`, serta status publish/lock.
- `GradeEntry` menyimpan raw score, normalized score, status `MISSING`, `SUBMITTED`, `GRADED`, `EXEMPT`, `REMEDIAL`, atau `FINAL`.
- `FinalGrade` menyimpan kalkulasi, nilai published, letter grade, status, dan histori koreksi.

## Perhitungan

- Bobot kategori harus tepat 100% sebelum final grade dapat dipublikasikan.
- `MISSING` dan `SUBMITTED` tidak menjadi skor nol dan dikeluarkan dari denominator preview.
- `EXEMPT` dikeluarkan dari denominator.
- Skor `GRADED`, `FINAL`, dan `REMEDIAL` dinormalisasi deterministik dari raw score.
- Drop-lowest diterapkan pada item reguler dengan skor terendah.
- Perubahan final published membutuhkan `correctionReason` dan audit before/after.

## API

- `GET /api/v1/guru/kelas/:kelasId/gradebook`
- `POST /api/v1/guru/kelas/:kelasId/gradebook/categories`
- `PATCH /api/v1/guru/gradebook/categories/:categoryId`
- `POST /api/v1/guru/kelas/:kelasId/gradebook/items`
- `PATCH /api/v1/guru/gradebook/items/:itemId`
- `POST /api/v1/guru/gradebook/items/:itemId/sync`
- `PUT /api/v1/guru/gradebook/items/:itemId/entries`
- `POST /api/v1/guru/kelas/:kelasId/gradebook/publish`
- `GET /api/v1/siswa/kelas/:kelasId/gradebook`
- `GET /api/v1/wali/anak/:siswaId/kelas/:kelasId/gradebook`

## UI

- Guru: `/guru/kelas/[kelasId]/gradebook` dengan konfigurasi kategori/item, sinkronisasi sumber, tabel siswa berpaginasi, entry manual, dan publish final.
- Siswa: `/siswa/kelas/[kelasId]/gradebook` hanya menampilkan item/kategori serta final grade published.
- Wali: `/wali/progres/[siswaId]/gradebook` read-only dengan ringkasan komponen belum selesai.

## Verification

- `npm run test:week7` menguji bobot kategori, Assignment/Ujian sync, missing vs zero, publish final, akses role, dan remedial correction.
- `npm run typecheck` dan `npm run lint` lulus.

## Known Limitations

- Quiz, attendance, dan progress belum memiliki source domain sehingga item-nya belum dapat disinkronkan otomatis.
- Tabel Guru memakai pagination client-side; virtualization server belum diperlukan untuk baseline ini.
- Migration MariaDB nyata dan UAT production masih menunggu environment MariaDB.
