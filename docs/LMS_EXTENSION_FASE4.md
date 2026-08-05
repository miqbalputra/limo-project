# LMS Extension Fase 4

## Scope

Fase 4 menambahkan recording speaking audio/video, rubric reusable, penilaian berbasis snapshot, dan feedback published untuk Siswa serta Wali. Tidak ada transkripsi atau penilaian AI.

## Database

- Migration: `prisma/migrations/20260806020000_rubrics_feedback/migration.sql`.
- Template memakai `RubricTemplate`, `RubricCriterion`, dan `RubricLevel`.
- Assignment menyimpan `rubricTemplateId` dan `rubricSnapshot`; snapshot tidak berubah ketika template diedit.
- Penilaian memakai `SubmissionGrade` dan `CriterionGrade` dengan status `DRAFT`, `PUBLISHED`, dan `REVISED`.
- Koreksi published membuat grade baru, mengubah histori sebelumnya menjadi `REVISED`, dan mencatat audit before/after.
- File audio/video menyimpan checksum, MIME type, ukuran, dan `mediaDuration`.

## API

- `GET/POST /api/v1/guru/rubrik`
- `PATCH /api/v1/guru/rubrik/:rubricId` untuk publish/archive atau edit isi template.
- `PATCH /api/v1/guru/tugas/:assignmentId/rubric`
- `GET/PATCH /api/v1/guru/submissions/:submissionId/grade`
- `POST /api/v1/guru/submissions/:submissionId/grade/publish`
- `GET /api/v1/siswa/submissions/:submissionId/grade`
- `GET /api/v1/assignment-submissions/files/:fileId?inline=1` untuk playback media terotorisasi.

Mutation memakai same-origin check, feature flag assignment, role/policy scope, validation, audit log, dan notifikasi idempoten untuk Siswa/Wali.

## UI

- Guru mengelola rubric dan memasangnya pada `/guru/kelas/[kelasId]/tugas`.
- Guru membuka grading panel di `/guru/tugas/[assignmentId]/submissions` untuk melihat jawaban, playback media, draft nilai, publish, dan koreksi.
- Siswa dapat merekam dengan `MediaRecorder`, pause/resume bila didukung, stop, playback, hapus, dan rekam ulang. Upload file tetap tersedia sebagai fallback.
- Siswa dan Wali hanya melihat feedback setelah status `PUBLISHED`.

## Verification

- `npm run test:week6` mencakup rubric snapshot, draft/publish/correction, visibility, notification idempotency, dan audio fallback.
- `npm run typecheck` dan `npm run lint` lulus.
- `npm run test:e2e` lulus 16/16 pada database SQLite yang disiapkan untuk test.

## Known Limitations

- Migration MariaDB nyata dan UAT production masih menunggu environment MariaDB.
- Antivirus/malware scan belum tersedia pada environment lokal.
- Feedback audio Guru dan status `NEEDS_REVISION` belum memiliki UI khusus.
