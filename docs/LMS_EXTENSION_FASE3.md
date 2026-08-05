# LMS Extension Fase 3

## Scope

Fase 3 menambahkan tugas harian terpisah dari `Ujian` dan `UjianAttempt` existing. Actor Siswa dapat menyimpan draft dan mengirim jawaban; Wali hanya memantau. Assisted submission tetap dikendalikan oleh `guardianAssistedSubmissionEnabled` dan defaultnya nonaktif.

## Database

- Schema: `Assignment`, `AssignmentSubmission`, dan `AssignmentSubmissionFile`.
- Migration: `prisma/migrations/20260806010000_assignments/migration.sql`.
- Submission memakai `attemptNumber` historis dan unique key per assignment/siswa/attempt.
- Autosave memakai `version` untuk optimistic concurrency.
- File submission memakai private storage existing, storage key acak, checksum, dan metadata MIME/ukuran.

## API

- `GET/POST /api/v1/guru/kelas/:kelasId/tugas`
- `GET/PATCH /api/v1/guru/tugas/:assignmentId`
- `POST /api/v1/guru/tugas/:assignmentId/publish`
- `POST /api/v1/guru/tugas/:assignmentId/archive`
- `GET /api/v1/guru/tugas/:assignmentId/submissions`
- `GET /api/v1/siswa/kelas/:kelasId/tugas`
- `GET /api/v1/siswa/tugas/:assignmentId`
- `PATCH /api/v1/siswa/tugas/:assignmentId/draft`
- `POST /api/v1/siswa/tugas/:assignmentId/submit`
- `GET /api/v1/wali/anak/:siswaId/kelas/:kelasId/tugas`
- `GET /api/v1/assignment-submissions/files/:fileId`

Mutation assignment memakai same-origin check, feature flag, role/policy scope, server-side validation, audit log, dan rate limit pada submit/upload. Status terlambat dihitung dari waktu server. Submission final tanpa resubmission diulang secara idempotent.

## UI

- Guru: `/guru/kelas/[kelasId]/tugas` dan monitoring `/guru/tugas/[assignmentId]/submissions`.
- Siswa: `/siswa/kelas/[kelasId]/tugas` dan `/siswa/tugas/[assignmentId]`.
- Wali: `/wali/progres/[siswaId]/tugas` sebagai read-only.
- Assignment dapat dipasang ke module item `ASSIGNMENT` pada builder Fase 2.

## Known Limitations

- Grading, feedback, rubrik, dan status `NEEDS_REVISION` belum memiliki workflow Guru; masuk Fase 4.
- Recording audio/video native belum dibuat; upload fallback sudah tersedia untuk tipe audio/video.
- Antivirus/malware scan belum tersedia pada environment lokal.
- Cleanup file draft yatim belum dijalankan oleh scheduled job.

## Verification

- `npm test` lulus.
- `npm run test:week4` lulus setelah integrasi `ASSIGNMENT` ke module builder.
- `npm run test:week5` lulus.
- E2E Fase 3 menambah smoke flow Guru, Siswa, dan Wali.
- `npm run typecheck` dan `npm run lint` lulus.

Migration parity MariaDB dan UAT production tetap menunggu environment MariaDB yang belum tersedia lokal.
