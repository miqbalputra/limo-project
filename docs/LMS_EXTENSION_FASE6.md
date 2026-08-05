# LMS Extension Fase 6

## Scope

Fase 6 menambahkan kalender terpadu, To-do berbasis aktivitas, dan reminder deadline tanpa menyalin jadwal sumber akademik.

## Calendar

`src/server/services/calendar-service.ts` menghasilkan derived event dari:

- `SesiKelas` menjadi `CLASS_SESSION`.
- `LearningModule.releaseAt/publishedAt` menjadi `MODULE_RELEASE`.
- `Assignment.dueAt` menjadi `ASSIGNMENT_DUE`.
- `Ujian.examDate/availableUntil/availableFrom` menjadi `EXAM`.
- `CalendarEvent` manual menjadi `HOLIDAY` atau `ANNOUNCEMENT`.

Derived event tidak disimpan ulang. Perubahan deadline assignment langsung terlihat pada query kalender berikutnya.

`CalendarEvent` hanya dipakai untuk event manual. Event dapat global atau terikat kelas, memiliki visibility `ALL`, `GURU`, `SISWA`, atau `WALI`, dan setiap mutation tercatat pada audit log.

## To-do

- Siswa: submission tugas, revisi, dan ujian yang belum selesai.
- Guru: draft assignment/modul/materi, submission belum dinilai, sesi belum difinalkan, dan final grade yang belum dipublikasikan.
- Wali: aktivitas tugas/ujian anak dan jadwal kelas terdekat, dikelompokkan per anak.
- Status derived: `OPEN`, `OVERDUE`, dan item `DONE` dihilangkan dari daftar To-do.
- Materi belum dibuka dan completion aktivitas ditunda ke Fase 7 karena belum ada tracking aktivitas siswa.
- Remedial deadline ditunda ke Fase 8 karena belum ada domain remedial terpisah.

## Reminder

`src/server/services/reminder-service.ts` membuat notifikasi in-app untuk tugas dan ujian yang belum selesai pada window:

- `H3`: tiga hari kalender Jakarta sebelum deadline.
- `H1`: satu hari kalender Jakarta sebelum deadline.
- `DUE`: setelah waktu deadline pada hari yang sama.
- `OVERDUE`: setelah hari deadline berlalu.

Idempotency key menggabungkan role penerima, penerima, tanggal job, window, dan sumber. Reminder Wali dikelompokkan per akun dan window agar tidak spam untuk beberapa anak.

Job dijalankan melalui:

```text
npm run reminders:send
npm run reminders:send -- --dry-run
```

Scheduler production tetap dijalankan dari cron/systemd di luar proses web. Job menghormati `CALENDAR_ENABLED` dan default production tetap nonaktif.

## Routes

- `/admin/kalender`
- `/guru/kalender`
- `/guru/todo`
- `/siswa/kalender`
- `/siswa/todo`
- `/wali/kalender`
- `/wali/todo`
- `GET /api/v1/calendar`
- `GET/POST /api/v1/calendar/events`
- `PATCH/DELETE /api/v1/calendar/events/:eventId`
- `GET /api/v1/todo`

## Verification

- `npm run sqlite:setup` berhasil dengan model `CalendarEvent`.
- `npm test` menguji window reminder berbasis timezone Jakarta.
- `npm run test:week8` menguji role scope kalender, deadline live, To-do, submit completion, dan reminder idempotency.
- `tests/e2e/week8.spec.ts` menguji navigasi Kalender/To-do untuk Guru, Siswa, dan Wali pada viewport mobile.

## Known Limitations

- `QUIZ_DUE` dan `REMEDIAL_DUE` belum memiliki source domain pada fase ini.
- Belum ada preference kanal notifikasi per user; reminder fase ini menggunakan in-app notification.
- Migration MariaDB dan UAT production masih menunggu environment MariaDB.
