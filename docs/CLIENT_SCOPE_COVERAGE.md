# Client Scope Coverage

This matrix maps the 10 modules in the June 2026 SistemFlow proposal plus the requested RPP module to the current LIMO implementation. Payment gateway references to Pakasir in the proposal are replaced by Mayar V2.

| Proposal module | Current implementation | Main entry points | Status |
| --- | --- | --- | --- |
| Landing Page / Profil | Hero, program English/Arabic, testimonials, contact, public registration CTA, privacy/terms, PWA metadata | `/` | Implemented; final client content remains UAT input |
| Pendaftaran Online | Public form, PDF/JPG/PNG upload, status code lookup, Admin list/detail, private files, approve/reject, Wali activation and notifications | `/daftar`, `/status-pendaftaran`, `/admin/pendaftaran` | Implemented |
| Data Peserta Didik | Student CRUD, archive/restore, class transfer history, Wali linking, CSV export, pagination/filter, Admin recap | `/admin/siswa`, `/admin/wali`, `/admin/guru` | Implemented |
| Multi-Role Access | Admin, Guru, Wali session/RBAC, same-origin mutation protection, scoped student/class/invoice/file access | `/login` and role dashboards | Implemented |
| Student Portal | Akun Siswa terhubung ke data Siswa existing, login email/nomor induk, dashboard, kelas aktif, profil, materi, jadwal, nilai, progres, dan policy own-record | `/siswa`, `/siswa/kelas`, `/siswa/profil` | Implemented; assignment actor flow pending |
| Structured Learning Modules | Modul berurutan, item materi/sesi/ujian existing, release schedule, prerequisite guard, publish/archive/duplicate, builder Guru, struktur Siswa, dan view Wali read-only | `/guru/kelas/[kelasId]/modul`, `/siswa/kelas/[kelasId]/modul`, `/wali/progres/[siswaId]/modul` | Implemented; completion and new activity types pending |
| Online Assignments | Tugas draft/published, tipe teks/link/file, autosave draft berversi, attempt history, late/cutoff, private file route, Siswa submit, Guru monitoring, Wali read-only | `/guru/kelas/[kelasId]/tugas`, `/siswa/kelas/[kelasId]/tugas`, `/siswa/tugas/[assignmentId]`, `/wali/progres/[siswaId]/tugas` | Implemented; grading/rubric and media recording pending |
| LMS Materi | Session/class material, text/video/PDF/JPG/PNG support, program/level/class context, publish state, Wali published-only access | `/guru/materi`, `/guru/kelas`, `/wali/materi` | Implemented |
| RPP / Perencanaan Pembelajaran | Guru creates a direct form RPP or uploads private Word/PDF, draft/publish/archive lifecycle, Wali access limited to active child enrollment | `/guru/rpp`, `/wali/rpp` | Implemented; MariaDB migration and client UAT pending |
| Bank Soal & Ujian | PG/esai bank, structured options, timer, online attempt autosave/resume, auto-scoring, offline result, correction review, history/notification | `/guru/bank-soal`, `/guru/ujian`, `/wali/tugas`, `/wali/nilai` | Implemented |
| Presensi | Per-session attendance, completion/finalization lock, monthly Wali recap, scoped Guru roster, report aggregation | `/guru/presensi`, `/wali/presensi`, `/admin/laporan` | Implemented |
| Progres Belajar | Per-session note, score 1-5, public/internal note, timeline and Wali notification | `/guru/progres`, `/wali/progres` | Implemented |
| Grafik Progress | Attendance, progress, score graphs and Admin period report/CSV | `/wali/progres`, `/guru/kelas/*/ringkasan`, `/admin/laporan` | Implemented |
| Payment Gateway SPP | Monthly invoice generation, Mayar hosted checkout, QRIS/VA method selection, webhook, idempotency, nominal/merchant validation, reconciliation, payment history, Wali notification | `/admin/tagihan`, `/wali/tagihan`, `/api/v1/webhooks/mayar` | Implemented; Mayar credentials/channel enablement and real UAT pending |

## Admin Command Center

Admin navigation covers registration, students, guardians, teachers, program, level, class, billing, reports, users, audit, and password management. The Admin dashboard also shows current-month open/overdue billing, attendance rate, exam/material activity, pending registrations, and quick links to reports, billing, and audit.

Guru owns day-to-day teaching operations for materials, questions, exams, attendance, and progress. Admin oversees those modules through class/student data, reports, audit logs, and operational billing controls rather than impersonating Guru actions.

## External Acceptance Gates

- Run `prisma migrate deploy` against MariaDB 11 staging.
- Enable QRIS and required VA channels in the Mayar merchant dashboard.
- Configure Mayar webhook to `/api/v1/webhooks/mayar` with the LIMO secret.
- Test invoice creation for QRIS and at least one VA, `payment.received`, duplicate webhook, expired invoice, and reconciliation.
- Configure the scheduler for `npm run billing:generate`, `npm run mayar:reconcile`, notification retry, overdue marking, and backup workflow.
