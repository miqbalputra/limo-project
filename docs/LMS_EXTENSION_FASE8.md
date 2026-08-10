# LMS Extension Fase 8

## Scope

Fase 8 menambahkan remedial dan revisi assignment tanpa membuat sistem submission kedua. Assignment existing tetap menjadi sumber jawaban, attempt, file, rubric, dan feedback.

## Remedial

- `RemedialAssignment` menyimpan sumber, kelas, instruksi, waktu tersedia, deadline, status, dan score policy.
- `RemedialParticipant` membatasi remedial ke Siswa yang ditugaskan dan menyimpan alasan, status, serta snapshot skor.
- Snapshot skor awal mengikat submission original dan tidak berubah ketika nilai original dikoreksi setelah remedial dipublikasikan.
- Sumber yang executable pada fase ini adalah `ASSIGNMENT`.
- `QUIZ`, `EXAM`, dan `COMPETENCY` ditolak secara eksplisit karena belum memiliki flow submission/synchronization yang aman untuk remedial.

Status peserta: `ASSIGNED`, `IN_PROGRESS`, `SUBMITTED`, `COMPLETED`, `CANCELLED`, dan `EXPIRED`.

## Score Policy

Skor policy dihitung pada nilai normalized `0-100`:

- `LATEST`: memakai skor remedial jika tersedia, jika tidak skor awal.
- `HIGHEST`: memakai skor tertinggi antara skor awal dan remedial.
- `AVERAGE`: rata-rata skor awal dan remedial.
- `CAPPED`: skor remedial dibatasi `scoreCap`, tetapi tidak boleh menurunkan skor awal.


## Revisi Assignment

- Guru dapat meminta revisi dari submission `SUBMITTED`, `LATE`, atau `GRADED`.
- Submission sumber berubah menjadi `NEEDS_REVISION`.
- Siswa mendapat `AssignmentRevisionRequest` dan membuat attempt berikutnya melalui `AssignmentSubmission` existing.
- Request menyimpan alasan, instruksi, deadline, source submission, response submission, dan status.
- Saat response revision dinilai dan dipublikasikan, request menjadi `COMPLETED`; attempt awal tetap tersimpan.

## API

- `GET/POST /api/v1/guru/kelas/:kelasId/remedial`
- `PATCH /api/v1/guru/remedial/:remedialId`
- `POST /api/v1/guru/submissions/:submissionId/revision`
- `GET /api/v1/siswa/remedial`
- `GET /api/v1/wali/anak/:siswaId/kelas/:kelasId/remedial`
- `GET /api/v1/siswa/tugas/:assignmentId?remedialId=:participantId`
- `POST/PATCH /api/v1/siswa/tugas/:assignmentId/submit|draft` dengan `remedialId` atau `revisionRequestId`

Semua endpoint memakai authorization kelas/participant, same-origin untuk mutation, request ID, dan response error standar.
POST remedial menerima header opsional `Idempotency-Key` untuk retry yang aman.

## Kalender, To-do, dan Reminder

- Deadline remedial menghasilkan derived calendar event `REMEDIAL_DUE`.
- Siswa hanya melihat remedial yang ditugaskan kepada dirinya.
- Wali melihat remedial anak secara read-only.
- To-do Siswa/Wali mengarahkan ke assignment source dengan konteks participant.
- Reminder H-3, H-1, DUE, dan OVERDUE memakai idempotency key yang sama dengan sumber remedial.
- Assignment revision muncul sebagai To-do prioritas tinggi saat status `NEEDS_REVISION`.

## UI

- Guru: `/guru/kelas/[kelasId]/remedial` untuk membuat, publish, dan memantau peserta.
- Siswa: `/siswa/remedial` dan assignment page dengan konteks `remedialId`.
- Wali: `/wali/progres/[siswaId]/remedial` read-only.
- Guru submission monitor menyediakan aksi `Minta Revisi`.

## Database

- Migration: `prisma/migrations/20260806060000_remedial_revision/migration.sql`.
- Feature flag: `REMEDIAL_ENABLED`; default development/test aktif dan production nonaktif.
- SQLite schema dibuat ulang dari `prisma/schema.prisma` melalui `npm run sqlite:setup`.

## Verification

- Unit test score policy `LATEST`, `HIGHEST`, `AVERAGE`, dan `CAPPED`.
- `npm run test:week10` menguji original grade, request revision, global attempt numbering, participant scoping, remedial submission retry, frozen original score, gradebook effective score, calendar, notification, create idempotency, dan reminder idempotency.
- `tests/e2e/week10.spec.ts` menguji halaman Guru, Siswa, dan Wali pada viewport mobile.

## Known Limitations

- Remedial `EXAM`, `QUIZ`, dan `COMPETENCY` menunggu domain attempt/source yang kompatibel.
- Score policy disimpan pada normalized score; aturan institusi yang membutuhkan formula berbeda perlu fase lanjutan.
- Migration MariaDB nyata dan UAT production masih menunggu environment MariaDB.
