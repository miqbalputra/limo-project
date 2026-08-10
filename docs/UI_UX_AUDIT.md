# Audit Frontend/UI-UX LIMO

Tanggal audit awal: 8 Agustus 2026  
Pembaruan remediasi: 9 Agustus 2026  
Baseline: PRD bagian 16-17 dan worktree saat audit  
Stack terdeteksi: Next.js 16, React 19, TypeScript, Tailwind CSS 4.1, App Router

## Ringkasan Eksekutif

LIMO sudah jauh dari sekadar halaman dummy: mayoritas data dashboard berasal dari service/DAL, ikon utama sudah relevan dengan LMS, dan beberapa alur seperti pendaftaran serta presensi Guru telah memiliki pola mobile dan state yang cukup baik. Audit awal memberi kesiapan **4/10** karena palet indigo template, copy generik, enum mentah, serta halaman showcase. Fase 1-3 telah menutup isu correctness yang teridentifikasi, memindahkan visual ke token LIMO, menghapus showcase template, dan menambah guardrail seed/color. Temuan struktural, mobile 360px, serta RTL di bagian bawah dokumen tetap menjadi backlog produk.

## Status Implementasi

### Fase 1 - P0 selesai (8 Agustus 2026)

| Temuan | Status | Bukti implementasi dan regresi |
|---|---|---|
| Guru tidak dapat memilih `TERLAMBAT` | Selesai | `attendance-progress-forms.tsx` menyediakan lima radio-card status, termasuk label dan tone warning untuk Terlambat. Ringkasan presensi kini memecah lima status. `tests/e2e/week3.spec.ts` memverifikasi lima opsi; `tests/run-week3-integration.mjs` memverifikasi persistence API `TERLAMBAT`. |
| Nilai progres kategori lama dapat tersimpan sebagai kategori baru | Selesai | Baris progres diremount dengan key `studentId:normalizedCategory`; kategori disamakan dengan normalisasi payload sehingga nilai dan catatan dimuat ulang atomik saat kategori berubah. E2E memverifikasi skor/catatan kembali ke default kategori baru. |
| Selector anak Wali dapat berbeda dari URL/data halaman | Selesai | Konteks anak memakai `?anak=<siswaId>` pada halaman koleksi dan `[siswaId]` pada detail. Cookie tidak lagi menjadi source of truth; selector mengarahkan route secara atomik, mempertahankan history browser, dan dikunci saat attempt ujian aktif. Validasi server memastikan ID anak milik Wali. E2E memverifikasi filter URL, detail switch, all-children, dan Back. |

Verifikasi Fase 1 lulus: `npm test`, `npm run typecheck`, `npm run lint`, `npm run test:e2e -- tests/e2e/week3.spec.ts`, `npm run test:week3`, dan `npm run build`.

### Fase 2 - Finansial dan safety mutasi selesai (8 Agustus 2026)

| Temuan | Status | Bukti implementasi dan regresi |
|---|---|---|
| Wali tidak dapat melihat riwayat transaksi invoice | Selesai | DTO `listTagihan` kini meneruskan lima transaksi terbaru yang aman tanpa `rawPayload`, jumlah total transaksi, provider, reference, status, metode, nominal, dan waktu. Detail invoice Wali dan Admin menampilkan riwayat tersebut; Admin juga dapat mencari provider/reference/metode. `tests/run-week3-integration.mjs` memverifikasi scope, DTO aman, dan nominal numerik; `tests/e2e/week3.spec.ts` memverifikasi presentation Wali. |
| Filter `DRAFT` Tagihan diam-diam berubah menjadi semua status | Selesai | `tagihanStatusSchema` menjadi satu source of truth untuk page, API, service, filter cepat, dan pagination. Unit, integration, serta E2E memverifikasi URL `?status=DRAFT` dipertahankan dan hasil API hanya berstatus draft. |
| Generate invoice dapat langsung menulis data tanpa review | Selesai | `generateInvoiceSchema` aman secara default dengan `dryRun: true` dan menolak periode/tanggal yang tidak valid. UI selalu menjalankan preview, menampilkan created/skipped/failed, lalu mengirim `dryRun: false` hanya setelah konfirmasi eksplisit. Integration memverifikasi preview tidak menambah invoice; E2E memverifikasi request kedua baru terjadi setelah konfirmasi. |
| Konfirmasi aksi mutasi penting tidak konsisten | Selesai | `ConfirmDialog` reusable memakai `alertdialog`, focus trap, Escape, scroll lock, dan pengembalian fokus. Dipakai untuk generate/reconcile pembayaran, perubahan status siswa, transfer, arsip/lepas Wali, status akun siswa, serta hapus agenda kalender. E2E Week 1 dan Week 8 memverifikasi aksi tidak mengirim request sebelum konfirmasi. |
| Ledger pembayaran lintas invoice sebagai halaman/route terpisah | Masih parsial | Fase ini menutup kebutuhan history per invoice. `/admin/pembayaran` dan `/wali/pembayaran` terpisah belum dibuat; bila volume transaksi bertambah, pertahankan ini sebagai keputusan information architecture P1. |

Verifikasi Fase 2 lulus: `npm test`, `npm run typecheck`, `npm run lint`, `npm run test:week1`, `npm run test:week3`, `npm run test:week8`, `npm run test:e2e -- tests/e2e/week1.spec.ts`, `npm run test:e2e -- tests/e2e/week3.spec.ts`, `npm run test:e2e -- tests/e2e/week8.spec.ts`, dan `npm run build`.

### Fase 3 - Identitas LIMO dan hardening demo seed (9 Agustus 2026)

| Temuan | Status | Bukti implementasi |
|---|---|---|
| Palet indigo/template dan token tidak lengkap | Selesai | `src/app/globals.css` mendefinisikan ramp LIMO blue/sky/red/yellow/green/neutral, semantic status ramp, typography yang dipakai, focus state, serta primary/secondary button. Seluruh utility `brand-*` di bawah `src/` telah dipindahkan ke `limo-*`; `src/lib/limo-brand.ts` menjadi constants bersama untuk media, PDF, dan Excel. |
| Hex warna tersebar di surface aplikasi | Selesai | OG image, manifest, landing, kalender, export PDF/Excel, dan auth memakai token/constants LIMO. `npm run check:colors` memblokir hex di bawah `src/` di luar `globals.css` dan `limo-brand.ts`. |
| Residu showcase/template dan copy generik | Selesai | Route/component showcase tabel Admin dihapus; nav/quick action hanya menampilkan workflow operasional. Badge snapshot `Live` dihapus dan copy dashboard, billing, form, serta role utama dilokalkan. |
| Enum internal muncul di UI | Selesai | `src/lib/ui-labels.ts` memusatkan label Indonesia dan tone status; dipakai pada Admin, Guru, Wali, Siswa, serta komponen dashboard. Nilai enum tetap dipertahankan untuk API/form. |
| Demo seed dapat dipanggil dari jalur production | Selesai | `prisma/seed.ts` memerlukan `LIMO_ALLOW_DEMO_SEED=true` dan menolak `NODE_ENV=production` kecuali `DOKPLOY_SQLITE_DEMO=true`. Entrypoint menolak seed pada jalur MariaDB production dan dokumentasi/env diperbarui. |

Verifikasi Fase 3 final lulus: `npx next typegen`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:week1`, `npm run test:week3`, `npm run test:week8`, `npm run test:e2e -- tests/e2e/week1.spec.ts`, `npm run test:e2e -- tests/e2e/week3.spec.ts`, `npm run test:e2e -- tests/e2e/week8.spec.ts`, `npm run build`, `npm run check:colors`, dan `git diff --check`. Pemeriksaan diff hanya menampilkan peringatan normalisasi CRLF pada worktree.

Guard seed juga diverifikasi secara langsung: seed tanpa `LIMO_ALLOW_DEMO_SEED=true` dan seed pada `NODE_ENV=production` ditolak; syntax `docker-entrypoint.sh` lulus melalui Git Bash. Capture Chromium final tersedia di `test-results/fase3-admin-dashboard.png` (1440x1000), `test-results/fase3-guru-presensi-mobile.png` (390x844), dan `test-results/fase3-wali-tagihan-mobile.png` (390x844).

## Temuan Baseline dan Batas Audit

Kecuali bagian Status Implementasi, temuan, skor, daftar residu, dan rekomendasi berikut adalah snapshot baseline sebelum remediasi Fase 1-3. Catatan tersebut dipertahankan untuk jejak audit dan bukan pernyataan kondisi source saat ini.

- Membaca 18 halaman Admin, 23 halaman Guru, 21 halaman Wali, layout dashboard, komponen yang diimpor, service/DAL yang memengaruhi informasi UI, global CSS, PWA surface, seed, dan test E2E.
- Audit dilakukan terhadap source aktual, bukan berdasarkan nama route saja.
- Temuan mobile didasarkan pada markup/class responsif dan cakupan test yang ada. Audit ini tidak menjalankan visual regression atau device lab.
- Public, Auth, dan portal Siswa tidak diaudit halaman per halaman karena peta yang diminta berfokus pada Admin, Guru, dan Wali; file lintas-area tetap dibaca bila memengaruhi branding, RTL, PWA, atau konsistensi komponen.
- `P0` berarti release blocker/correctness risk, `P1` tinggi sebelum UAT produksi, `P2` sedang, dan `P3` polish.
- Tidak ada `tailwind.config.*`. Ini valid untuk Tailwind 4 karena konfigurasi dilakukan melalui `@theme` di `src/app/globals.css:2-54`.

## Pemetaan Cakupan Halaman PRD

### Admin

| Halaman PRD | Route/Implementasi | Status | Catatan |
|---|---|---|---|
| Dashboard | `/admin` | Ada | Data service-backed dan relevan; aksi cepat berfokus pada pendaftaran, siswa, kelas, tagihan, laporan, pengguna, berkas materi, dan audit. |
| Pendaftaran | `/admin/pendaftaran`, `/admin/pendaftaran/[id]` | Ada | List/detail, filter, dokumen privat, approve/reject, dan konfirmasi tersedia. Transisi ke `UNDER_REVIEW` tidak tersedia di UI. |
| Siswa | `/admin/siswa`, `/admin/siswa/[id]`, `/admin/siswa/[id]/akun` | Ada, parsial | CRUD operasional cukup luas, tetapi filter PRD dan beberapa konfirmasi status belum lengkap. |
| Wali | `/admin/wali` | Parsial | Create/search/list/status akun ada; tidak ada detail/edit profil Wali. |
| Guru | `/admin/guru` | Parsial | Create/search/list/status akun ada; tidak ada detail/edit profil atau pengelolaan penugasan yang fokus. |
| Program/Level | `/admin/program`, `/admin/level` | Ada | Create/edit/archive ada; restore tidak tersedia dan enum masih mentah pada beberapa tampilan. |
| Kelas | `/admin/kelas` | Ada, parsial | Master kelas tersedia, tetapi bukan pengelolaan sesi/jadwal dan lifecycle inactive/archive membingungkan. |
| Jadwal/Sesi | Tidak ada `/admin/jadwal` atau `/admin/sesi` | **Gap** | `/admin/kalender` hanya kalender agregat dan event manual, bukan CRUD `SesiKelas`. |
| Tagihan | `/admin/tagihan` | Ada | Workspace finansial nyata, tetapi default tabel tidak mobile-first, tarif hanya create/read, dan ada defect filter. |
| Pembayaran | Tertanam di `/admin/tagihan` | **Parsial/Gap IA** | Histori dan rekonsiliasi tertanam per invoice; tidak ada halaman pembayaran/ledger tersendiri. |
| User | `/admin/users` | Ada | Filter, status akun, pagination, dan revoke session tersedia. |
| Audit | `/admin/audit` | Ada, parsial | Data nyata dan export ada; metrik/filter/copy masih menyesatkan atau kurang lengkap. |

### Guru

| Halaman PRD | Route/Implementasi | Status | Catatan |
|---|---|---|---|
| Dashboard | `/guru` | Ada | Informasi kelas dan agenda relevan, tetapi beberapa metrik diberi makna yang tidak didukung rule bisnis. |
| Kelas Saya | `/guru/kelas`, `/guru/kelas/[kelasId]` | Ada | Kartu kelas, roster, detail, dan ringkasan tersedia. |
| Sesi | Form/list di `/guru/kelas/[kelasId]`, agenda `/guru/jadwal` | **Parsial/Gap IA** | Tidak ada `/guru/sesi`; edit/cancel dan lifecycle sesi tidak lengkap. |
| Materi | `/guru/materi` -> `/guru/kelas/[kelasId]` | Parsial | Halaman Materi hanya launcher kelas; workspace aktual bercampur dengan sesi dan roster. |
| Bank Soal | `/guru/bank-soal` | Ada, parsial | Create/list/pagination tersedia; search/filter/edit dan empty state belum matang. |
| Ujian | `/guru/ujian`, nested hasil/koreksi | Ada | Builder dan input hasil tersedia, dengan beberapa konflik PRD, RTL, dan scaling. |
| Presensi | `/guru/presensi`, `/guru/presensi/[sesiKelasId]` | Ada, bermasalah | Card-first dan bulk hadir bagus, tetapi `TERLAMBAT` tidak dapat diinput. |
| Progres | `/guru/progres`, `/guru/progres/[sesiKelasId]` | Ada, bermasalah | Ada autosave dan input per siswa, tetapi pergantian kategori dapat menyimpan nilai kategori lain. |
| Penilaian Esai | Nested di `/guru/ujian/[ujianId]/hasil/.../koreksi` | **Parsial/Gap IA** | Tidak ada queue lintas ujian, count pekerjaan, filter `NEEDS_REVIEW`, atau menu khusus. |

### Wali Murid

| Halaman PRD | Route/Implementasi | Status | Catatan |
|---|---|---|---|
| Dashboard Anak | `/wali` | Ada, parsial | Kartu per anak dan alert tersedia; agregat memakai subset data tanpa disclosure. |
| Progres | `/wali/progres`, `/wali/progres/[siswaId]` | Ada, parsial | Ringkasan, bar chart, timeline tersedia; filter, tanggal, kategori, dan histori penuh belum ada. |
| Presensi | `/wali/presensi` | Ada, parsial | Rekap per anak/bulan tersedia; `TERLAMBAT` disamarkan sebagai Hadir dan tidak ada filter periode. |
| Nilai | `/wali/nilai` | Ada, parsial | Nilai final tersedia; kartu hanya memperlihatkan tiga hasil dan tidak ada histori/filter lengkap. |
| Materi yang diizinkan | `/wali/materi` | Ada | Hanya materi published dan file privat; konteks anak dan RTL masih lemah. |
| Tagihan | `/wali/tagihan` | Ada | Card-first, filter, dan pembayaran Mayar tersedia. |
| Pembayaran | Tidak ada `/wali/pembayaran` | **Gap** | Tidak ada ledger histori transaksi, metode, provider reference, atau refund/reconciliation history. |
| Profil | `/wali/profil` | Ada | Read-only dengan penjelasan proses koreksi data dan relasi anak. |

## Temuan Lintas Role

| File/Halaman | Temuan | Kategori (Visual/UX/Mobile/RTL/Konsistensi) | Dampak | Rekomendasi | Prioritas |
|---|---|---|---|---|---|
| `src/app/globals.css:19-65` | Warna resmi LIMO hanya dideklarasikan sebagai variable `:root`, sedangkan utility dashboard memakai ramp `brand-*` TailAdmin dengan `brand-500: #465fff`. | Visual, Konsistensi | Primary action, sidebar, focus ring, badge, dan link tampil seperti TailAdmin, bukan brand `#2372B8`. | Bentuk tonal ramp LIMO di `@theme`, map seluruh semantic token ke palet resmi, lalu hapus sistem warna paralel. | P1 |
| `src/app/globals.css:11-18,41-49,198-208` | Skala token tidak lengkap, tetapi UI memakai `text-title-md`, `text-theme-lg`, `success-200/300/400/600/900`, `error-200/300/600/800`, dan utility `tailadmin-button-secondary` yang tidak didefinisikan. Contoh: `dashboard-widgets.tsx:14`, `attendance-progress-forms.tsx:17-20`, `admin/audit/page.tsx:69`. | Visual, Konsistensi | Styling dapat tidak dihasilkan Tailwind sehingga hierarchy, state color, dan action tertentu tidak sesuai desain. | Lengkapi token yang benar-benar dipakai dan tambahkan pemeriksaan statis custom utility vs token. | P1 |
| `src/components/dashboard/dashboard-widgets.tsx:6-42`; `src/app/globals.css:248-267` | Hampir semua area memakai hero dengan blob blur, metric card, radius, border, dan shadow yang sama; global CSS kemudian menimpa radius/hover lokal. | Visual, Konsistensi | Hierarki terasa aman, simetris, dan template-like; class komponen tidak lagi menjadi sumber kebenaran. | Buat primitive `Surface/Card/Hero` dengan variant berdasar fungsi, lalu hapus override berbasis `#dashboard-content`. | P1 |
| `src/components/dashboard/dashboard-widgets.tsx:34-41` | Semua `MetricCard` diberi badge `Live`, meskipun nilainya snapshot server-rendered. | UX, Visual | Menimbulkan klaim real-time yang tidak benar dan terlihat seperti badge boilerplate dashboard. | Hapus badge atau ganti dengan timestamp/sumber data yang benar. | P2 |
| `src/app/(dashboard)/loading.tsx:1-10`; `src/app/(dashboard)/error.tsx:12-20` | Seluruh role memakai satu skeleton generik dan satu error state; CTA error mengarah ke landing `/`, bukan dashboard role. | UX, Konsistensi | State tidak mencerminkan bentuk halaman dan memutus konteks pengguna yang sedang login. | Tambahkan loading/error boundary per role atau per workspace utama serta home link berbasis role. | P2 |
| `tests/e2e/week1.spec.ts:3-12,51-69`; `tests/e2e/week2.spec.ts:15-16`; `tests/e2e/week3.spec.ts:15-16,71-72`; `playwright.config.ts:12-17` | Hanya landing diuji di 360px; dashboard diuji di 390px dengan Desktop Chromium yang di-resize, tanpa WebKit/mobile Safari atau visual snapshot. | Mobile, Konsistensi | Clipping akibat `overflow-hidden` dan target sentuh kecil dapat lolos meskipun `scrollWidth` dinyatakan aman. | Tambah matriks 360px dan 390px, Chromium + WebKit, serta assertion bounding-box/screenshot untuk area kritis. | P1 |
| `src/app/layout.tsx:38`; `src/app/globals.css:1,91-96` | Root selalu `lang="id"`; CSS menyebut Noto Naskh Arabic/Amiri tetapi font tersebut tidak dimuat. | RTL, Konsistensi | Teks Arab bergantung pada fallback perangkat dan tidak memiliki metadata bahasa yang benar. | Load/self-host font Arab, pasang `lang="ar"` pada content island, dan gunakan logical CSS properties. | P1 |
| `src/components/dashboard/assignment-builder.tsx:31`; `gradebook-manager.tsx:14`; `learning-module-builder.tsx:55`; `remedial-manager.tsx:12`; `rubric-manager.tsx:21`; `submission-grade-panel.tsx:27` | Sedikitnya enam komponen menduplikasi helper `requestJson`; Admin/Wali billing juga menduplikasi metric, status mapping, format, dan mini-stat. | Konsistensi | Error contract, loading behavior, status label, dan visual mudah menyimpang antar fitur. | Ekstrak typed API client dan semantic primitives seperti `StatusBadge`, `Money`, `ResponsiveDataView`, dan metric surface. | P2 |
| `src/app/manifest.ts:13-25`; `public/sw.js:41-56`; `src/components/pwa/service-worker-register.tsx:5-16` | Baseline PWA ada, tetapi hanya satu SVG dipakai untuk `any` dan `maskable`, tidak ada update/install UX, dan navigasi offline selalu jatuh ke `offline.html` alih-alih memakai public page yang sudah diprecache. | UX, Konsistensi | Instalasi dan offline behavior belum terasa production-grade, khususnya pada perangkat mobile orang tua/guru. | Putuskan strategi offline yang eksplisit, sediakan icon PNG/maskable yang benar, update prompt, dan PWA E2E. | P2 |
| `PRD.md:321-334`; `src/components/dashboard/dashboard-shell.tsx:117-168`; `src/components/dashboard/calendar-view.tsx:135-156`; `src/components/dashboard/wali-child-selector.tsx:17-22` | Baseline aksesibilitas terlihat pada skip link, `aria-current`, label status berbasis teks, dan row navigasi 44px. Namun belum ada audit contrast/axe, selector anak hanya 40px, dan event kalender memakai teks 9px serta target kecil. | UX, Mobile, Konsistensi | Keyboard dan screen-reader baseline cukup baik, tetapi target sentuh/kontras tidak terbukti konsisten pada flow operasional. | Tambah axe/contrast check, keyboard route test, dan audit target sentuh >=44px untuk semua action primer. | P2 |

## Temuan per Role

### Admin

| File/Halaman | Temuan | Kategori (Visual/UX/Mobile/RTL/Konsistensi) | Dampak | Rekomendasi | Prioritas |
|---|---|---|---|---|---|
| Tidak ada `/admin/jadwal` atau `/admin/sesi`; `src/components/dashboard/navigation.ts:12-29`; `src/server/services/calendar-service.ts:160-176` | Jadwal/Sesi pada peta PRD belum diimplementasikan sebagai workspace Admin. Kalender dapat memantau sesi agregat dan membuat pengumuman/hari libur, sedangkan kelas hanya menyimpan `scheduleNote`; CRUD sesi khusus Admin tidak ada. | UX, Konsistensi | Admin dapat melihat agenda, tetapi tidak memiliki workspace terpusat untuk pencarian, oversight, atau perubahan sesi sesuai ownership yang disepakati. | Tetapkan ownership sesi Admin/Guru, lalu buat workspace Jadwal/Sesi dengan list/agenda mobile dan action yang memang diizinkan. | P1 |
| Tidak ada `/admin/pembayaran`; `src/components/dashboard/admin-billing-workspace.tsx:178-195` | Pembayaran hanya tertanam saat invoice dibuka; ledger pembayaran lintas invoice tidak tersedia. | UX, Konsistensi | Rekonsiliasi, pencarian provider reference, status transaksi, dan audit pembayaran sulit dilakukan. | Tambahkan halaman Pembayaran atau formalkan tab/route ledger di workspace finansial. | P1 |
| Showcase tabel template | Selesai Fase 3 | Route/component duplikat siswa telah dihapus dari production, navigasi, dan quick action. | - | - | - |
| `src/components/dashboard/admin-data-table.tsx:44-83`; `src/app/(dashboard)/admin/page.tsx:115-122`; `src/app/(dashboard)/admin/laporan/page.tsx:49-52` | Tabel 640-980px hanya mengandalkan horizontal scroll; tidak ada card/list mobile. | Mobile | Bertentangan langsung dengan prinsip PRD dan sulit dipakai pada 360px. | Gunakan `ResponsiveDataView`: tabel desktop dan kartu berlabel di bawah breakpoint. | P1 |
| `src/components/dashboard/admin-billing-workspace.tsx:58,96-145,178-190` | Workspace Tagihan memiliki mode kartu yang baik, tetapi selalu mulai dalam mode tabel 940px. | Mobile, UX | Pengguna HP selalu mendapat tampilan yang salah sampai mengganti mode manual. | Default ke kartu berdasarkan media query atau render mode responsif tanpa preference manual. | P1 |
| `src/components/dashboard/billing-forms.tsx:82-120` | Generate invoice langsung membuat data karena `dryRun` default tidak dicentang dan tidak ada konfirmasi; success/error juga memakai satu message abu-abu dan copy Inggris. | UX, Konsistensi | Bulk financial mutation dapat terjadi tanpa review checkpoint, walau PRD tidak menyebut generate invoice secara eksplisit sebagai aksi destructive. | Jadikan dry-run langkah awal/default, tampilkan review count, lalu dialog konfirmasi eksplisit sebelum generate nyata. | P1 |
| `src/app/(dashboard)/admin/tagihan/page.tsx:20-23`; `src/components/dashboard/admin-billing-workspace.tsx:125-134` | UI menawarkan filter `DRAFT`, tetapi page menolaknya sehingga pilihan diam-diam menjadi semua status. | UX, Konsistensi | Filter finansial memberi hasil salah tanpa error. | Sertakan `DRAFT` dalam validation/type filter dan tambahkan test query-state. | P1 |
| `src/components/dashboard/student-management-forms.tsx:49-75,112-134`; `student-account-form.tsx:61-75,97-101`; `calendar-view.tsx:89-107,188-190` | Perubahan status siswa, transfer kelas, aktivasi akun, dan delete agenda tidak konsisten memakai konfirmasi. | UX, Konsistensi | Aksi penting/destructive dapat dilakukan terlalu mudah. | Pakai satu `ConfirmDialog` teraksesibel dengan variant destructive/status change dan reason bila perlu. | P1 |
| `src/app/(dashboard)/admin/wali/page.tsx`; `src/app/(dashboard)/admin/guru/page.tsx` | Kedua halaman hanya create/search/list/account action; data telepon/alamat yang dikumpulkan tidak dapat dilihat/edit dan relasi kelas/anak hanya berupa count. | UX | Admin tetap membutuhkan kanal lain untuk operasi profil yang seharusnya inti. | Tambahkan detail/edit Wali dan Guru dengan relasi yang dapat ditindaklanjuti. | P1 |
| `src/app/(dashboard)/admin/siswa/page.tsx:25-45` | Filter hanya search/program/status, belum ada level, kelas, atau periode masuk. Pada mobile heading kolom hilang dan nilai Wali/Kelas tidak diberi label. | Mobile, UX | Dataset besar sulit disaring; kartu mobile ambigu. | Lengkapi filter PRD dan beri label field pada layout mobile. | P2 |
| `src/app/(dashboard)/admin/audit/page.tsx:15,53-60,63-70,92-102` | Copy menyebut 100 aktivitas, tetapi page size 25; metrik menghitung halaman aktif saja; filter actor/tanggal tidak ada; metadata ditampilkan sebagai JSON mentah. | UX, Konsistensi | Admin dapat salah menafsirkan statistik audit dan kesulitan investigasi. | Gunakan aggregate query, filter actor/date range, formatter metadata, dan copy sesuai pagination. | P2 |
| `src/components/dashboard/calendar-view.tsx:113,122-164,188-190` | Kalender memaksa 7 kolom, event 9px, target sentuh kecil, copy `Monthly view`, warna purple/orange/cyan, dan delete tanpa konfirmasi. | Mobile, Visual, UX | Kalender tidak usable di HP dan menyimpang dari palet LIMO. | Sediakan agenda list mobile, semantic event tokens, lokalisasi copy, dan konfirmasi delete. | P1 |
| `src/app/(dashboard)/admin/page.tsx` | Selesai Fase 3: quick action dan copy dashboard memakai istilah operasional LIMO; Berkas Materi dipertahankan sebagai fitur privat nyata. | Visual, UX | Prioritas navigasi tidak lagi mempromosikan showcase template. | Pantau kebutuhan workspace Jadwal/Sesi dan ledger pembayaran sebagai backlog IA. | P2 |
| `src/app/(dashboard)/admin/pendaftaran/page.tsx`; `src/components/dashboard/pendaftaran-actions.tsx:89-120` | Pendaftaran adalah salah satu implementasi terbaik: card-first, empty state, busy/error state, dan confirm approve/reject tersedia. Dialog belum memiliki focus trap/restoration dan status review antara belum ada. | Mobile, UX | Baseline pola yang baik sudah ada, tetapi aksesibilitas dialog dan workflow belum lengkap. | Jadikan pola ini referensi internal, gunakan dialog primitive, dan tambah aksi masuk review. | P2 |

### Guru

| File/Halaman | Temuan | Kategori (Visual/UX/Mobile/RTL/Konsistensi) | Dampak | Rekomendasi | Prioritas |
|---|---|---|---|---|---|
| `src/components/dashboard/attendance-progress-forms.tsx:16-21,156-180`; `tests/e2e/week3.spec.ts:47-55` | Form hanya menyediakan Hadir, Sakit, Izin, Alpa. `TERLAMBAT` tidak dapat dipilih dan test justru mengunci empat opsi; record lama Terlambat harus diganti agar form dapat disimpan. | UX, Mobile, Konsistensi | Guru tidak dapat merekam keterlambatan dan berisiko merusak data historis valid. | Tambahkan opsi Terlambat dengan indikator teks+warna, perbarui summary dan E2E. | **P0** |
| `src/components/dashboard/attendance-progress-forms.tsx:42,94-103,140-145,185-193` | Input progres memakai `defaultValue` dengan key siswa tetap. Saat kategori berubah, kontrol tidak remount sehingga nilai kategori lama dapat tersimpan sebagai kategori baru. | UX, Konsistensi | Potensi korupsi/cross-category data tanpa tanda visual. | Jadikan field controlled atau key-kan row dengan `studentId:category`; reset/load state atomik saat kategori berubah. | **P0** |
| `src/components/dashboard/attendance-progress-forms.tsx:124-139` | Copy menjanjikan seluruh draft dipulihkan, tetapi `internalNote-*` sengaja dikeluarkan dari localStorage. | UX, Konsistensi | Guru dapat kehilangan catatan internal karena mempercayai autosave. | Jika policy privasi tidak mengizinkan persistence, ubah copy dan beri warning eksplisit; jika diizinkan, gunakan mekanisme draft server yang terotorisasi, bukan localStorage ad hoc. | P1 |
| Tidak ada `/guru/penilaian-esai`; `src/app/(dashboard)/guru/ujian/[ujianId]/hasil/page.tsx:14-43` | Review esai hanya ditemukan setelah masuk ke hasil satu ujian; tidak ada queue `NEEDS_REVIEW`, count, filter, atau quick action lintas ujian. | UX, Konsistensi | Pekerjaan manual mudah terlewat dan halaman PRD belum terpenuhi. | Buat `/guru/penilaian-esai` sebagai inbox kerja dengan SLA/status dan deep link ke koreksi. | P1 |
| `src/app/(dashboard)/guru/kelas/[kelasId]/page.tsx:28-74`; `src/app/(dashboard)/guru/materi/page.tsx:19-34` | Sesi dan Materi bukan workspace fokus. Pada mobile urutannya form Sesi, form Materi, roster penuh, list Sesi, baru list Materi; `/guru/materi` hanya launcher kelas. | Mobile, UX | Alur harian Guru panjang dan informasi inti terkubur. | Pisahkan route Sesi dan Materi dengan filter kelas; class detail cukup menjadi overview/deep links. | P1 |
| `src/components/dashboard/lms-forms.tsx:58-85`; `src/app/(dashboard)/guru/kelas/[kelasId]/page.tsx:41-46`; `src/app/(dashboard)/guru/presensi/[sesiKelasId]/page.tsx:25-28` | Guru dapat membuat, menduplikasi, dan memfinalkan sesi, tetapi tidak ada edit atau cancel sehingga lifecycle belum lengkap. | UX, Konsistensi | Guru tidak dapat menangani koreksi jadwal atau pembatalan tanpa alur di luar UI. | Implementasikan edit/cancel sesuai ownership Admin/Guru dan simpan reason/audit untuk perubahan setelah dipakai. | P1 |
| `src/components/dashboard/gradebook-manager.tsx:135-147`; `activity-completion-matrix.tsx:33`; `remedial-manager.tsx:70`; `src/app/(dashboard)/guru/tugas/[assignmentId]/submissions/page.tsx:21` | Gradebook, submission, completion matrix, dan remedial hanya tabel horizontal; tombol edit 11px dan tidak ada card per siswa. | Mobile | Extension penting tidak usable untuk input cepat di HP. | Buat card/accordion per siswa di mobile dengan sticky action/footer dan target sentuh >=44px. | P1 |
| `src/app/(dashboard)/guru/presensi/[sesiKelasId]/page.tsx:26`; `src/components/dashboard/dashboard-widgets.tsx:8-18` | Aside `min-w-72` berada di dalam hero yang menyisakan sekitar 280px pada viewport 360px lalu dipotong `overflow-hidden`. | Mobile, Visual | Statistik terlihat terpotong meski test `scrollWidth` lolos. | Gunakan `w-full min-w-0`, grid responsif, dan test bounding box tepat 360px. | P1 |
| `src/components/dashboard/lms-forms.tsx:151-165,190-205`; `bank-soal-form.tsx:203-211,282-288`; `src/app/(dashboard)/guru/bank-soal/page.tsx:24` | Pilihan `Auto` sebenarnya dirender LTR, field entry tidak berubah arah saat RTL dipilih, dan seluruh kartu termasuk metadata Indonesia dimasukkan ke RTL. | RTL, UX | Guru sulit mengetik/mereview Arab; mixed bidi dapat terbalik atau membingungkan. | Deteksi `dir="auto"`, scope RTL hanya pada stimulus/question/content, pasang `lang="ar"`, dan preview dengan metadata terisolasi. | P1 |
| `src/app/(dashboard)/guru/ujian/page.tsx:28-46`; `src/components/dashboard/ujian-form.tsx:7-11` | Builder meratakan soal Arab menjadi label LTR tanpa metadata direction; ringkasan ujian memakai `pl-5` dan tidak memberi `dir/lang` per soal. | RTL, Konsistensi | Soal Arab dapat tampil salah saat dipilih dan direview. | Pertahankan language/direction pada option DTO dan render content island per soal dengan logical spacing. | P1 |
| `prisma/seed.ts:602-607,976-994`; `tests/e2e/week2.spec.ts:31-36,42-47` | Fixture Arab nyata tersedia, tetapi E2E materi hanya memakai teks Inggris dan tidak ada assertion RTL/font/mixed-content. | RTL, Konsistensi | Kepatuhan PRD "uji dengan teks nyata" belum terbukti. | Tambah skenario Guru Arab dan Wali Arab pada 360px, termasuk opsi campuran Arab-Indonesia. | P1 |
| `src/components/dashboard/material-status-actions.tsx:10-29`; `exam-status-actions.tsx:10-29`; `src/components/dashboard/lms-forms.tsx:162-172`; `ujian-form.tsx:101-143` | Archive dikonfirmasi, tetapi publish langsung saat create tidak dikonfirmasi; hasil ke Wali bahkan default aktif pada builder ujian. | UX, Konsistensi | Materi/ujian dapat terpublikasi sebelum Guru memahami konsekuensinya. | Pisahkan Save Draft dan Publish, lalu tampilkan review dialog berisi audience, tanggal, dan visibility hasil. | P1 |
| `src/components/dashboard/navigation.ts:30-42`; `src/server/features/feature-flags.ts:33-44`; `src/app/(dashboard)/guru/kelas/[kelasId]/page.tsx:33` | Navigation/CTA selalu menampilkan Kalender, To-do, Modul, dan Progres Aktivitas, sementara default production mematikan feature terkait. | UX, Konsistensi | Menu dapat berakhir di not-found/error dan mengalihkan fokus dari core workflow. | Bangun navigation dari feature flags yang sama dengan route guard. | P1 |
| `src/app/(dashboard)/guru/page.tsx:22,89-108`; `src/components/dashboard/dashboard-widgets.tsx:34-41` | "Kelas teraktif" hanya berarti siswa terbanyak; readiness adalah formula sesi*20 + materi*15 + ujian*10; semua metric disebut Live. | UX, Visual | Label memberi kesan insight analitik tanpa definisi bisnis. | Ganti dengan metrik yang actionable: sesi hari ini, presensi belum lengkap, esai perlu dinilai, dan materi draft. | P2 |
| `src/app/(dashboard)/guru/bank-soal/page.tsx:17-48`; `src/app/(dashboard)/guru/ujian/page.tsx:16-20`; `src/server/services/exam-service.ts:60-81` | Bank/Ujian tidak memiliki search/filter; builder soal dibatasi 100 item dan checkbox list tidak searchable. Empty state beberapa list juga kosong tanpa guidance. | UX, Konsistensi | Skala bank soal akan cepat tidak usable dan soal di luar 100 item tidak dapat dipilih. | Tambah server search/filter, combobox virtualized/paginated, dan empty state kontekstual. | P2 |

### Wali Murid

| File/Halaman | Temuan | Kategori (Visual/UX/Mobile/RTL/Konsistensi) | Dampak | Rekomendasi | Prioritas |
|---|---|---|---|---|---|
| `src/components/dashboard/dashboard-shell.tsx:220`; `wali-child-selector.tsx:8-23`; `src/app/(dashboard)/wali/progres/[siswaId]/page.tsx:10-14` | Selector global hanya mengubah cookie dan `router.refresh()`, sedangkan halaman detail tetap memakai `[siswaId]` dari URL. Header dapat menunjukkan anak B saat action/page masih memproses anak A. | UX, Konsistensi | Risiko salah konteks anak pada progres, modul, tugas, remedial, gradebook, dan ujian. | Jadikan child context bagian URL atau sinkronkan selector dengan route; pada detail, lock selector ke siswa route atau navigasikan atomik. | **P0** |
| Tidak ada `/wali/pembayaran`; `src/server/services/billing-service.ts:145-167`; `src/app/(dashboard)/wali/tagihan/page.tsx:31-44` | Backend membawa lima transaksi lengkap per invoice, tetapi serializer Wali membuang seluruh `paymentHistory`. | UX, Konsistensi | Wali tidak dapat melihat metode, provider reference, nominal transaksi, percobaan gagal, refund, atau rekonsiliasi. | Tambah ledger Pembayaran atau section histori per invoice dan pertahankan DTO payment history. | P1 |
| `src/server/dal/actor-dal.ts:93-96`; `src/app/(dashboard)/wali/page.tsx:18-33,78-100` | Dashboard menghitung rata-rata/count dari data yang dibatasi `take: 5/3/3` tanpa menyebutnya; tanpa presensi ditampilkan 0%, dan tanpa tagihan aktif diberi label "Lunas". | UX, Konsistensi | Angka dapat salah/menyesatkan dan membingungkan keadaan "belum ada data" dengan hasil buruk/baik. | Query aggregate yang benar dan modelkan `no data`, `not billed`, `paid`, serta `open` sebagai state berbeda. | P1 |
| `src/app/(dashboard)/wali/presensi/page.tsx:37-72`; `src/server/services/report-service.ts:60-68` | `TERLAMBAT` digabung ke Hadir dan tidak ditampilkan sebagai kategori tersendiri; tidak ada filter periode atau detail sesi. | UX, Konsistensi | Wali tidak dapat memantau kedisiplinan dan label Hadir menjadi tidak akurat. | Tampilkan lima status, filter bulan/periode, dan detail tanggal/sesi/note. | P1 |
| `src/app/(dashboard)/wali/tagihan/page.tsx:13-24`; `src/components/dashboard/wali-billing-workspace.tsx:38-41,103-112` | Total memasukkan DRAFT/CANCELLED/REFUNDED, sedangkan lunas/sisa hanya subset; payment rate dan tiga angka utama dapat tidak merekonsiliasi. | UX, Konsistensi | Ringkasan keuangan dapat memberi angka yang salah kepada orang tua. | Tetapkan definisi finansial per status dan tampilkan cancelled/refunded terpisah dari billed total. | P1 |
| `src/app/(dashboard)/wali/nilai/page.tsx:81-90` | Judul "Riwayat Nilai" hanya menampilkan tiga hasil per anak tanpa "lihat semua", pagination, kelas, atau filter periode. | UX | Orang tua mengira histori lengkap padahal data dipotong. | Tambah detail/pagination atau ubah copy menjadi "3 nilai terbaru" dengan CTA histori lengkap. | P2 |
| `src/app/(dashboard)/wali/progres/[siswaId]/page.tsx:58-83`; `src/server/services/report-service.ts:35-50` | UI membuang kategori dan tanggal progres yang sebenarnya tersedia, sementara service membatasi 12 progres dan 10 nilai. | UX, Konsistensi | Timeline sulit dipahami dan histori lama hilang tanpa disclosure. | Tampilkan kategori/tanggal, filter kelas/periode, dan pagination/load more. | P2 |
| `src/app/(dashboard)/wali/materi/page.tsx:18-30,38-55`; `wali-child-selector.tsx:17-22` | Default "Semua Anak" dapat menggabungkan materi, tetapi kartu tidak menyebut nama anak; seluruh kartu termasuk badge `Published`, metadata, URL, dan ukuran file ikut RTL. | RTL, UX | Wali multi-anak tidak tahu materi untuk siapa dan mixed-bidi mudah berantakan. | Tampilkan child chips/grouping dan scope `dir/lang` hanya pada title/content Arab. | P1 |
| `src/app/(dashboard)/wali/nilai/page.tsx:107-114`; `materi/page.tsx:22`; `tagihan/page.tsx:24`; `src/components/dashboard/dashboard-widgets.tsx:8-18` | Hero memakai `min-w-72` atau `min-w-80` di area dalam yang hanya sekitar 280px pada viewport 360px dan terpotong `overflow-hidden`. | Mobile, Visual | Statistik kanan terpotong tanpa memicu horizontal overflow, sehingga test sekarang tidak menangkapnya. | Stack aside penuh pada mobile dan hapus fixed min-width sebelum breakpoint. | P1 |
| `src/components/dashboard/gradebook-viewer.tsx:7-13`; `src/app/(dashboard)/wali/progres/[siswaId]/gradebook/page.tsx:22` | Jika `publishedScore` tidak ada, viewer menampilkan `calculatedScore` walau halaman menjanjikan draft tidak terlihat. | UX, Konsistensi | Nilai provisional dapat bocor ke Wali sebelum publikasi. | Untuk Wali, tampilkan score hanya jika final grade berstatus published; jangan fallback ke calculated score. | P1 |
| `src/app/(dashboard)/wali/page.tsx:107-110`; `src/app/(dashboard)/wali/profil/page.tsx:85-88` | Link Nilai/Tagihan dari kartu anak tidak membawa child context dan bergantung pada cookie global yang mungkin masih `Semua Anak`. | UX, Konsistensi | Wali mengklik dari anak tertentu tetapi melihat agregat semua anak. | Sertakan `?anak=` atau route child-aware pada seluruh deep link. | P1 |
| `src/app/(dashboard)/wali/tugas/page.tsx:18-23`; `PRD.md:725-730`; `rancangan_ujian.md:679-703`; `IMPLEMENTATION_PLAN.md:1071-1076` | Ujian online via akun Wali sudah memiliki rancangan dan implementasi, tetapi default PRD masih offline teacher-entry dan checklist keputusan formal belum dicentang. | UX, Konsistensi | Ada specification conflict serta scope keamanan/role yang belum mendapat sign-off eksplisit, bukan kekurangan dokumentasi desain. | Rekonsiliasi PRD dan catat change decision/sign-off; bila belum disetujui, feature-gate alur online. | P1 |
| `src/server/services/todo-service.ts:93-108`; `src/components/dashboard/todo-list.tsx:7-10` | To-do berasal dari Assignment tetapi CTA dapat mengarah ke `/wali/tugas`, yaitu alur ujian online yang berbeda. | UX, Konsistensi | Pengguna masuk ke fitur yang salah saat menindaklanjuti tugas anak. | Pisahkan label/route Assignment dan Ujian, lalu deep link ke item yang benar. | P1 |
| `src/app/(dashboard)/wali/profil/page.tsx:30-90` | Profil adalah implementasi yang cukup jelas: read-only dijelaskan, data kontak diberi fallback, dan relasi anak memakai kartu mobile. Query masih langsung ke Prisma. | UX, Konsistensi | Pengalaman cukup baik, tetapi pola data berbeda dari service/DAL halaman lain. | Pertahankan UI, pindahkan query ke DAL/service agar policy, test, dan selector behavior konsisten. | P2 |
| `src/app/(dashboard)/wali/progres/page.tsx:81-85`; `presensi/page.tsx:93-98`; `nilai/page.tsx:97-102`; `materi/page.tsx:25-31`; `wali-billing-workspace.tsx:97-99` | Empty state Wali relatif lengkap dan card-first. Loading tetap generik dan selector tidak memiliki pending/error feedback. | Mobile, UX | Fondasi mobile lebih baik daripada Admin/Guru, tetapi transisi selector dan loading masih terasa kasar. | Jadikan pola empty state Wali sebagai baseline dan tambah pending state selector serta skeleton per workspace. | P2 |

## Penilaian Mahal dan Profesional (Baseline)

| Dimensi | Nilai | Penilaian |
|---|---:|---|
| Branding | 3/10 | Logo dan nama LIMO hadir, tetapi dashboard memakai indigo TailAdmin; warna resmi lebih banyak hidup di landing/manifest daripada workspace produk. |
| Hierarki visual | 5/10 | Spacing dan tipografi cukup konsisten, tetapi terlalu banyak hero, metric card, rounded card, dan shadow yang sama sehingga semua halaman memiliki bobot visual setara. |
| Kekhususan domain | 7/10 | Data, ikon, copy, label enum, dan aksi utama sudah LMS-specific. Backlog terbesar tersisa pada flow mobile dan information architecture, bukan showcase template. |
| Mobile operasional | 5/10 | Presensi Guru dan mayoritas halaman Wali card-first, tetapi tabel Admin/extension Guru, calendar, hero clipping, dan test 360px masih gagal memenuhi target. |
| Bahasa Arab/RTL | 3/10 | Ada field direction dan seed Arab nyata, tetapi font, `lang`, auto direction, isolation mixed content, logical spacing, dan E2E RTL belum lengkap. |
| Aksesibilitas | 5/10 | Struktur semantik dan keyboard baseline sudah terlihat, tetapi belum ada audit kontras/axe menyeluruh dan target sentuh kecil masih ditemukan. |
| State dan safety | 5/10 | Empty/error/busy state tersedia di banyak tempat dan beberapa aksi telah dikonfirmasi, tetapi pola tidak konsisten dan ada correctness issue progres/selector/status. |

**Skor keseluruhan: 4/10.** Produk sudah terlihat seperti admin panel yang dikerjakan serius, tetapi belum memiliki brand system, hierarchy, dan hardening lintas-device yang cukup untuk memberi persepsi premium/orisinal.

## Daftar "Sisa TailAdmin Default" (Baseline)

TailAdmin memang sengaja dipakai sebagai template dasar. Agar tidak salah atribusi, daftar berikut memisahkan residu TailAdmin yang terbukti dari elemen template-like atau brand debt buatan implementasi LIMO sendiri.

### Residu TailAdmin yang Terbukti

- **Palet default:** `brand-500 #465fff` dan ramp indigo di `src/app/globals.css:19-28` masih menjadi primary system dashboard.
- **Nama utility template:** sembilan utility `tailadmin-*` di `src/app/globals.css:160-194` masih mengikat primitive ke nama vendor. Ini bukan masalah visual sendirian, tetapi memperkuat coupling dan duplikasi.
- **Showcase tabel template:** diselesaikan pada Fase 3 dengan penghapusan route/component, nav, dan CTA terkait.
- **Istilah navigasi template:** diselesaikan pada Fase 3; sidebar memakai Ringkasan, Berkas Materi, dan label workflow LIMO.

### Template-Like dan Brand Debt LIMO

Elemen berikut wajib dibersihkan untuk mencapai persepsi premium, tetapi tidak ada bukti bahwa semuanya berasal langsung dari TailAdmin:

- **Copy generik:** diselesaikan pada Fase 3 untuk role dashboard, billing, form utama, kalender, dan navigasi; audit berkelanjutan tetap diperlukan untuk fitur baru.
- **Copy e-commerce/finance template:** `Finance health`, `Collection rate`, `Transaction overview`, `Sales snapshot`, `Finance overview`, dan `Payment activity` di komponen billing.
- **Badge palsu:** diselesaikan pada Fase 3; snapshot tidak lagi diklaim sebagai real-time.
- **Raw enum/internal jargon:** diselesaikan pada Fase 3 melalui `src/lib/ui-labels.ts`; enum tetap dipakai sebagai nilai API/form saja.
- **Warna off-brand:** diselesaikan pada Fase 3; kalender memakai token LIMO sky/yellow/red/green/blue.
- **Hardcoded legacy brand:** diselesaikan pada Fase 3 menggunakan shared constants dan `check:colors`.
- **Motif generik:** blob blur, floating card, metric grid, radius besar, dan shadow ringan dipakai hampir merata tanpa hubungan dengan priority/action state.
- **Demo seed:** diselesaikan pada Fase 3 dengan flag eksplisit dan penolakan entrypoint pada jalur production/MariaDB.
- **Utility tidak valid:** `tailadmin-button-secondary` dan beberapa shade custom tidak didefinisikan, sehingga sebagian UI tampak seperti template yang belum selesai dipindahkan.

Hal yang **tidak** ditemukan dan tidak perlu dituduh sebagai residu:

- Tidak ditemukan `John Doe`, `Lorem Ipsum`, atau array customer/order/crypto dummy di page/component produksi.
- Tidak ditemukan ApexCharts/chart e-commerce bawaan; visual data utama berupa progress bar domain-specific.
- Ikon di `src/components/dashboard/dashboard-icon.tsx:3-54` adalah set custom yang relevan dengan siswa, guru, presensi, materi, ujian, tagihan, dan audit.
- Sebagian besar daftar utama mengambil data dari service/DAL, bukan hardcoded card palsu.

## Konsistensi Token dan Kode (Baseline)

| Area | Kondisi saat ini | Keputusan yang disarankan |
|---|---|---|
| Tailwind configuration | Tailwind 4 CSS-first, tidak membutuhkan `tailwind.config.*`. | Pertahankan CSS-first, tetapi jadikan `@theme` satu-satunya sumber token utility. |
| Warna resmi | Enam variable LIMO berada di `:root`, terpisah dari ramp `brand/success/error/warning`. | Bentuk semantic tonal ramp dengan contrast teruji; jangan hanya mengganti satu hex 500. |
| Hardcoded colors | Masih ada pada OG, PDF, auth surface, dan landing gradient. | Migrasikan ke shared TS/CSS brand constants sesuai medium, lalu larang hex legacy lewat lint/search check. |
| Typography | Hanya sebagian token ukuran didefinisikan; utility lain tetap dipakai. | Definisikan scale heading/body/caption yang lengkap, termasuk line-height Arab. |
| Card/Button/Input | Ada utility global `tailadmin-*`, tetapi banyak tombol/status/card tetap ditulis manual. | Buat primitive semantic dengan variant dan ukuran target sentuh konsisten. |
| Responsive data | Setiap tabel menyelesaikan mobile secara berbeda atau hanya memakai `overflow-x-auto`. | Standarkan `ResponsiveDataView` dengan table desktop dan card/list mobile. |
| Status labels | Mapping status tersebar dan raw enum sering bocor. | Centralize label, tone, icon, dan explanatory text per domain. |
| API request | `requestJson` dan error parsing diduplikasi. | Pakai typed fetch client dengan error schema dan consistent busy/success handling. |
| RTL | Direction disimpan, tetapi input/render/test tidak satu pipeline. | Buat `LocalizedContent`/`ArabicTextField` yang menangani `lang`, `dir`, font, bidi isolation, dan logical spacing. |
| Loading/error/empty | Shared generic boundary plus implementasi lokal tidak konsisten. | Buat state contract per workspace dan success feedback yang tidak bergantung pada refresh diam-diam. |

## Rekomendasi Quick Win

Setiap item berikut realistis dikerjakan kurang dari satu hari secara terpisah, termasuk test terarah:

| Aksi | Hasil yang diharapkan |
|---|---|
| Hapus showcase tabel dari navigation/quick action dan hapus copy template. | Selesai Fase 3. |
| Ganti `Admin Command Center`, `Teacher Workspace`, `Parent Portal`, `Live`, dan copy billing generik dengan bahasa operasional LIMO. | Produk terasa lebih lokal, jujur, dan domain-specific. |
| Tambahkan `TERLAMBAT` pada form Presensi Guru dan update test empat opsi menjadi lima. | Menutup correctness gap presensi yang kritis. |
| Perbaiki filter `DRAFT` Tagihan dan ganti `tailadmin-button-secondary` dengan utility valid. | Menghilangkan dua defect UI yang langsung terlihat. |
| Tambahkan konfirmasi untuk bulk generate invoice, publish langsung, dan delete agenda. | Memenuhi prinsip safety PRD untuk aksi penting. |
| Ubah hero aside `min-w-72/min-w-80` menjadi `w-full min-w-0` sebelum breakpoint dan test di 360px. | Menghilangkan clipping pada Guru/Wali. |
| Default Tagihan Admin ke card view pada mobile. | Workspace finansial langsung usable di HP. |
| Tambahkan empty state pada list Materi, Bank Soal, Ujian, Hasil, dan panel Sesi Guru. | Halaman tidak lagi terlihat rusak/kosong saat data belum ada. |
| Tampilkan label `3 nilai terbaru` atau tambah CTA `Lihat semua` pada Nilai Wali. | Copy sesuai dengan data yang benar-benar tampil. |
| Pertahankan `paymentHistory` pada DTO Wali dan tampilkan provider, reference, status, nominal, serta waktu. | Menutup gap informasi pembayaran tanpa menunggu redesign penuh. |
| Pasang `lang="ar"`, `dir="auto"`, dan logical margin pada content island Arab utama. | Memperbaiki baseline bidi sebelum refactor RTL penuh. |
| Sembunyikan menu/CTA yang feature flag-nya mati di production. | Menghindari navigation menuju not-found/error. |

## Rekomendasi Struktural

| Refactor | Ruang lingkup | Outcome |
|---|---|---|
| Design token LIMO | Ramp blue/sky/red/yellow/green/neutral, typography, focus, surface, radius, shadow, status, dark/contrast policy. | Satu brand system yang menggantikan TailAdmin indigo dan hardcoded hex. |
| Semantic component layer | `Button`, `Card`, `Hero`, `StatusBadge`, `ConfirmDialog`, `Metric`, `FormField`, `ResponsiveDataView`. | Variasi visual memiliki alasan hierarchy, bukan sekadar class per halaman. |
| Information architecture per role | Admin Jadwal/Sesi dan Pembayaran; Guru Sesi, Materi, Penilaian Esai; Wali Pembayaran. | Peta halaman PRD terpenuhi dan extension tidak menenggelamkan core workflow. |
| Mobile operational pattern | Card/list alternatif untuk seluruh tabel, sticky action, target 44px, filter sheet, 360px+WebKit tests. | Guru dan Wali dapat menyelesaikan tugas inti lewat HP tanpa horizontal table. |
| Child-context architecture | Child ID di URL/query, route-aware selector, deep link konsisten, state browser history. | Tidak ada mismatch antara anak di header, data halaman, dan action. |
| RTL/multilingual pipeline | Font Arab nyata, language metadata, `dir=auto`, bidi isolation, logical CSS, Arab field editor, mixed-content fixtures, screenshot tests. | Bahasa Arab menjadi capability teruji, bukan atribut `dir` ad hoc. |
| Role-specific state system | Loading skeleton per workspace, filtered-empty vs no-data, error recovery ke role dashboard, success toast/status. | State terasa disengaja dan pengguna tidak kehilangan konteks. |
| Billing domain view model | Satu definisi total/open/paid/refund/cancel, ledger pembayaran, shared formatter/status mapping. | Angka Admin dan Wali selalu merekonsiliasi dan dapat diaudit. |
| Assessment work queue | Queue essay/manual review lintas ujian, filter/status/count, deep link, completion feedback. | Penilaian manual menjadi workflow Guru yang terlihat dan terukur. |
| PWA hardening | Icon set, install/update flow, explicit offline policy, private-route safeguards, PWA E2E. | PWA layak dipasang pada perangkat bersama tanpa perilaku cache yang ambigu. |

## Urutan Eksekusi yang Disarankan

1. Tutup P0: bug kategori progres, opsi `TERLAMBAT`, dan mismatch selector anak.
2. Tutup gap informasi finansial dan safety mutation: ledger/payment history, definisi total, konfirmasi aksi penting.
3. Hilangkan residu TailAdmin user-facing dan migrasikan token warna LIMO.
4. Rapikan information architecture halaman inti PRD sebelum menambah extension baru.
5. Bangun responsive data primitive dan harden semua flow pada 360px + WebKit.
6. Selesaikan pipeline RTL dengan font dan fixture Arab nyata, lalu pasang visual regression.
7. Ekstrak component/API primitives dan lanjutkan PWA hardening.

## Kesimpulan Produksi (Baseline)

LIMO belum sebaiknya dipresentasikan sebagai UI final premium. Produk sudah memiliki domain model, data nyata, dan beberapa pola UX yang dapat dijadikan fondasi, tetapi release visual harus diblokir sampai P0 selesai, halaman inti tidak lagi tersamar sebagai extension, dan dashboard benar-benar menggunakan identitas LIMO. Redesign total tidak diperlukan; yang dibutuhkan adalah konsolidasi token, prioritas role yang lebih tegas, responsive behavior yang teruji, dan penghapusan elemen TailAdmin yang masih terlihat oleh pengguna.
