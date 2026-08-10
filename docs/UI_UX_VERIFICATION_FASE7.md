# Laporan Verifikasi UI/UX LIMO

Tanggal verifikasi: 9 Agustus 2026  
Baseline: `docs/UI_UX_AUDIT.md`  
Klaim yang diverifikasi: `docs/UI_UX_REAUDIT_FASE7.md`  
Instruksi: `prompt-evaluasi-verifikasi-limo.md`

## Kesimpulan Eksekutif

Status keseluruhan: **Selesai sebagian**.

Fase 1-7 meninggalkan bukti implementasi nyata: opsi `TERLAMBAT`, konteks anak Wali berbasis URL, ledger pembayaran, token LIMO, route workspace baru, `ResponsiveDataView`, pipeline konten Arab, typed client untuk workspace utama, dan PWA public-route safeguards. Namun klaim re-audit **8/10** terlalu tinggi untuk bukti yang tersedia.

Produk belum layak disebut **UI premium/production-ready** karena masih ada risiko P0/P1 yang berdampak pada correctness, privacy, feature navigation, dan reproducibility test. Temuan paling serius adalah fallback `calculatedScore` pada gradebook Wali/Siswa sebelum nilai final dipublikasikan dan fallback kategori default pada form progres Guru.

## Metode Dan Batasan

- Source, route, service/DAL, test, `git log`, dan file yang dirujuk audit dibaca langsung; commit message tidak dipakai sebagai bukti tunggal.
- HEAD saat verifikasi: `8ff4116 Add calendar todo and reminders`.
- Worktree sudah dirty sebelum verifikasi dengan banyak perubahan fase; tidak ada source aplikasi yang diubah oleh auditor.
- Integration test memakai SQLite. MariaDB production, device lab, dan usability study tidak tersedia di environment ini.
- Test E2E feature-gated dijalankan dengan flag eksplisit saat route membutuhkan fitur.
- Snapshot visual Playwright bukan bukti bahwa semua dashboard bebas clipping; cakupan route dan fixture tetap terbatas.

## Scorecard

| Dimensi | Skor awal | Skor sekarang | Bukti dan alasan perubahan |
|---|---:|---:|---|
| Branding | 3/10 | 7/10 | Ramp LIMO dan semantic aliases ada di `src/app/globals.css:24-130`; hex legacy di `src/` lulus `check:colors`. Coupling `tailadmin-*`, motif hero template, dan warna offline masih tersisa. |
| Hierarki visual | 5/10 | 6/10 | `MetricCard`, `StatusBadge`, `Money`, dan `DashboardHero` tersedia, tetapi blob hero, card/shadow pattern, override global, serta metric manual masih dominan. |
| Kekhususan domain | 7/10 | 8/10 | Workspace Jadwal/Sesi, Pembayaran, profil orang, antrean esai, remedial, gradebook, dan completion memakai service nyata. Mutation E2E belum lengkap dan beberapa IA/core flow masih bermasalah. |
| Mobile operasional | 5/10 | 6/10 | `ResponsiveDataView`, agenda mobile, hero fix, dan isolated 360/390 Chromium/WebKit test ada. Full run tidak menghasilkan satu baseline hijau yang reproducible dan coverage belum semua route. |
| Bahasa Arab/RTL | 3/10 | 7/10 | `LocalizedContent`, `ArabicTextField`, fixture Arab, font build-time, dan flow Guru/Wali lulus. Root tetap `lang="id"`, physical CSS masih ada, dan seluruh surface Arab belum diregresikan. |
| Aksesibilitas | 5/10 | 5/10 | Axe representative 3/3 dan target touch tertentu lulus, tetapi scan tidak penuh, focus trap dialog belum diuji keyboard secara nyata, dan beberapa kombinasi warna/teks gagal WCAG AA. |
| State dan safety | 5/10 | 5/10 | Role error boundary, typed error contract, busy state, dan PWA private-route guard ada. Gradebook privacy gap, raw `fetch`, native `window.confirm`, dan test isolation failure tetap menahan skor. |
| **Keseluruhan konservatif** | **4/10** | **6/10** | Kenaikan nyata, tetapi belum cukup untuk klaim 8/10 atau production-ready. |

## Status Per Temuan

Status yang dipakai persis sesuai prompt: `Selesai — terverifikasi`, `Selesai sebagian`, `Gejala dihilangkan, akar belum`, `Belum dikerjakan`, dan `Regresi baru`.

### Temuan Lintas Role

| ID / referensi baseline | Status | Bukti verifikasi | Celah atau regresi |
|---|---|---|---|
| C1. `globals.css:19-65`, palet `brand-500/#465fff` | Selesai — terverifikasi | Ramp LIMO blue/sky/red/yellow/green/neutral dan semantic aliases ada di `src/app/globals.css:24-130`; `npm.cmd run check:colors` lulus; grep legacy palette tidak menemukan penggunaan runtime. | Utility vendor masih ada, tetapi isu itu dicatat terpisah pada T2. |
| C2. `globals.css:11-18,41-49,198-208`, token tidak lengkap/utility invalid | Selesai — terverifikasi | `@theme` sekarang mendefinisikan ukuran yang dipakai, seluruh shade semantic, dan `tailadmin-button-secondary` didefinisikan di `globals.css:260-298`; typecheck/build lulus. | Nama utility vendor tetap menjadi coupling, lihat T2/T13. |
| C3. `dashboard-widgets.tsx:6-42`, motif hero/card berulang | Gejala dihilangkan, akar belum | `DashboardHero` masih selalu merender dua blob blur di `src/components/dashboard/dashboard-widgets.tsx:9-23`; override radius/hover global masih ada di `globals.css:338-367`. | Token diganti, tetapi struktur visual template dan satu primitive hero belum dipecah berdasarkan fungsi. |
| C4. `MetricCard`, badge `Live` | Selesai — terverifikasi | Badge `Live` tidak lagi dirender oleh `src/components/dashboard/metric-card.tsx`; grep runtime `src/` tidak menemukan badge tersebut. | Tidak ada. |
| C5. `loading.tsx`, `error.tsx`, CTA error role | Selesai sebagian | `src/app/(dashboard)/error.tsx:7-25` memakai `DashboardRoleProvider` dan link `/admin`, `/guru`, `/wali`, atau `/siswa` sesuai role. | `src/app/error.tsx:5-18` masih generic, tidak punya link dashboard nyata; loading masih shared pada beberapa boundary. |
| C6. Matrix mobile 360/390 dan WebKit | Selesai sebagian | `playwright.config.ts:38-87` memiliki empat project; `mobile-layout.spec.ts` menguji kalender, billing, empty state, hero, dan dua flow RTL. Run terisolasi yang tercatat lulus: 16/16. | Full suite sebelumnya mengalami EPERM/404 feature flag/snapshot WebKit atau timeout; semua halaman baseline belum tercakup. |
| C7. `layout.tsx:38`, `globals.css:1,91-96`, font/lang/RTL | Selesai sebagian | `src/app/fonts.ts:1-10` memakai `next/font/google` untuk Noto Naskh Arabic; build menghasilkan font-face/asset lokal; content island memberi `lang` dan `dir`. | Root tetap `lang="id"`; Outfit masih di-import dari Google CSS; grep menemukan physical `left/right/pl/pr/ml/mr` di shell dan komponen dashboard. |
| C8. Enam komponen menduplikasi `requestJson` | Selesai sebagian | Enam workspace utama memakai `requestJson` dari `src/lib/api-json-client.ts:53-104`, dan `use-async-action.ts` menyatukan lifecycle. | Masih ada banyak raw `fetch()` di dashboard serta native `window.confirm`; ekstraksi belum menyeluruh. |
| C9. PWA manifest, SW, install/offline | Selesai — terverifikasi | `src/app/manifest.ts:4-33` mendefinisikan PNG any/maskable; `public/sw.js:1-144` mengecualikan API/auth/private route; install/update flow ada di `service-worker-register.tsx`; `npm.cmd run test:e2e:pwa` lulus 1/1. | Konsistensi warna `offline.html` dicatat sebagai regresi baru R3. |
| C10. Aksesibilitas, contrast, touch target | Selesai sebagian | `tests/e2e/accessibility.spec.ts` memeriksa WCAG 2 A/AA, color-contrast, keyboard skip link, dan Wali calendar target; run aktual accessibility 3/3 lulus. | Axe hanya scope representative. Manual contrast menunjukkan `gray-400` di atas putih sekitar `2.68:1`; dialog focus trap belum punya assertion keyboard khusus dan event touch tidak seluruhnya diukur width+height. |

### Temuan Admin

| ID / referensi baseline | Status | Bukti verifikasi | Celah atau regresi |
|---|---|---|---|
| A1. Tidak ada workspace Admin Jadwal/Sesi | Selesai — terverifikasi | Route nyata `src/app/(dashboard)/admin/jadwal/page.tsx:12-22`, API `src/app/api/v1/admin/sesi/`, service `listSessionWorkspace`, role guard, dan ownership copy tersedia. Week 11 E2E lulus. | Mutation route belum diuji penuh melalui UI E2E. |
| A2. Tidak ada ledger Pembayaran Admin | Selesai — terverifikasi | `src/app/(dashboard)/admin/pembayaran/page.tsx:11-23` memakai `listPaymentLedger`; `payment-ledger.tsx:25-60` merender provider, reference, metode, nominal, status, dan waktu. Week 11 lulus. | Tidak ada. |
| A3. Showcase tabel template | Selesai — terverifikasi | Tidak ada route/component `/admin/data-tables` atau entri navigation; grep source tidak menemukan path tersebut. | Direct route test khusus 404 tidak dibuat, tetapi route map dan source tidak memiliki route. |
| A4. Tabel Admin horizontal-only | Selesai — terverifikasi | Tabel Admin dashboard/report/file manager/payment memakai `ResponsiveDataView`; named baseline pages tidak lagi memakai `admin-data-table.tsx`. | `admin/siswa` memiliki grid custom sendiri; isu label mobile dicatat A10. |
| A5. Tagihan Admin default tabel 940px | Selesai — terverifikasi | `admin-billing-workspace.tsx:294-334` memakai `ResponsiveDataView` dengan breakpoint `2xl`; mobile test memastikan cards terlihat dan table tersembunyi. |
| A6. Generate invoice tanpa dry-run/confirm | Selesai — terverifikasi | `billing-forms.tsx` melakukan preview dahulu dan membuka `ConfirmDialog`; integration Week 3 memverifikasi preview tidak menulis invoice dan run berikutnya baru menulis. |
| A7. Filter `DRAFT` di Tagihan | Selesai — terverifikasi | `admin-billing-workspace.tsx:260-267` menampilkan DRAFT; schema/service/page mempertahankan query status; Week 3 memverifikasi hasil hanya DRAFT. |
| A8. Konfirmasi mutasi penting dan aksesibilitas dialog | Selesai sebagian | Status siswa, transfer, aktivasi akun, dan delete agenda memakai `ConfirmDialog`; primitive di `confirm-dialog.tsx:48-105` memiliki Escape, focus trap, scroll lock, dan restoration. | `pendaftaran-actions.tsx:100-120` masih dialog custom tanpa trap/restoration; banyak aksi lain masih `window.confirm`; belum ada E2E Tab-cycle khusus. |
| A9. Detail/edit Guru dan Wali | Selesai sebagian | Route `admin/guru/[id]` dan `admin/wali/[id]` memakai `getGuru/getWali` serta `PersonProfileForm`; Week 11 membuka detail dan membuktikan data nyata. | E2E hanya memeriksa render; submit PATCH dan audit perubahan belum dibuktikan melalui browser test. |
| A10. Filter Siswa kurang lengkap/mobile ambiguous | Belum dikerjakan | `src/app/(dashboard)/admin/siswa/page.tsx:26-30` hanya memiliki `search`, `programId`, dan `status`; daftar mobile memakai grid tanpa label field Wali/Kelas. | Level, kelas, dan periode masuk belum tersedia. |
| A11. Audit log mengklaim 100, metrik page-only, JSON mentah | Selesai sebagian | Pagination dan filter search/action/entityType nyata di `admin/audit/page.tsx:15-47`; enum actor/entity memakai `formatUiLabel`. | Copy masih “100 aktivitas” meski `pageSize=25`, metrik hanya `items` halaman aktif, filter actor/tanggal tidak ada, metadata masih `JSON.stringify`, dan `formatUiLabel(item.action, item.action)` dapat membocorkan raw action. |
| A12. Kalender desktop/mobile, warna, target, delete | Selesai sebagian | Agenda mobile di `calendar-view.tsx:134-160`, event button `min-h-11`, semantic LIMO colors, dan delete memakai `ConfirmDialog`; mobile Admin test lulus pada isolated run. | Desktop tetap 7 kolom, beberapa teks 9/10px, detail event dialog tidak memakai `ConfirmDialog`/focus trap, dan Kalender Guru/Wali belum mendapat coverage selengkap klaim. |
| A13. Quick action Admin mempromosikan template | Selesai — terverifikasi | `admin/page.tsx` memakai workflow operasional dan route showcase tidak ada; tidak ditemukan copy template runtime. | Feature flag/navigation gap tetap berlaku pada extension lain. |
| A14. Pendaftaran card-first/confirm/review | Selesai sebagian | Filter `UNDER_REVIEW` dan metrik “Perlu ditindaklanjuti” ada di `admin/pendaftaran/page.tsx`; approve/reject memiliki reason validation dan confirmation. | Dialog custom belum focus-trapped/restored dan tidak ada bukti action eksplisit untuk transisi masuk `UNDER_REVIEW`. |

### Temuan Guru

| ID / referensi baseline | Status | Bukti verifikasi | Celah atau regresi |
|---|---|---|---|
| G1. Input `TERLAMBAT` | Selesai — terverifikasi | `attendance-progress-forms.tsx:17-23,159-180` memiliki lima opsi; Week 3 integration memverifikasi persistence `TERLAMBAT`; Week 3 E2E memeriksa lima opsi. | Ringkasan Wali masih menggabungkannya, lihat W4. |
| G2. Cross-write kategori progres | Gejala dihilangkan, akar belum | Row diremount dengan key `${student.id}:${normalizedCategory}` di `attendance-progress-forms.tsx:146-152`, dan payload dinormalisasi. | Line 148 masih fallback ke `student.progresBelajar?.[0]` saat kategori `umum` tidak ditemukan; nilai kategori lain dapat tampil lalu disimpan sebagai `umum`. Tidak ada test yang mereproduksi fallback ini. |
| G3. Draft internal note tidak dipulihkan | Belum dikerjakan | `attendance-progress-forms.tsx:130-135` sengaja mem-filter `internalNote-*` dari localStorage. | Copy line 142 masih menyatakan draf dipulihkan secara umum; policy harus dijelaskan atau mekanisme draft server dibuat. |
| G4. Queue Penilaian Esai | Selesai — terverifikasi | Route `guru/penilaian-esai/page.tsx:15-34,74-150`, service query `NEEDS_REVIEW`, pagination, dan deep link koreksi nyata; Week 11 lulus dan scope kelas dibuktikan. | Deskripsi metric masih memuat string internal `Status NEEDS_REVIEW` di line 48. |
| G5. Workspace Sesi dan Materi terpisah | Selesai sebagian | `/guru/sesi` memakai `SessionWorkspace`; `/guru/materi` memakai service/DAL materi dan filter kelas; class detail menyediakan deep link terpisah. | Class detail dan beberapa form lama masih menjadi titik masuk gabungan; belum seluruh alur menjadi workspace terpisah tanpa duplikasi. |
| G6. Lifecycle sesi edit/cancel | Selesai sebagian | `session-workspace.tsx:50-132` memiliki create/PATCH/DELETE, alasan override Admin, ownership service, dan `ConfirmDialog` cancel. | Week 11 hanya menguji scope dan render, bukan create/edit/cancel end-to-end. |
| G7. Gradebook/submission/completion/remedial mobile | Selesai — terverifikasi | `ResponsiveDataView` dipakai pada `gradebook-manager.tsx`, `activity-completion-matrix.tsx`, `remedial-manager.tsx`, dan `guru/tugas/[assignmentId]/submissions/page.tsx`; named tables tidak lagi hanya overflow. | Coverage touch target untuk semua action di kartu belum lengkap. |
| G8. Hero Guru terpotong pada 360px | Selesai — terverifikasi | `DashboardHero` memakai `w-full min-w-0` pada aside (`dashboard-widgets.tsx:21`); mobile layout test memeriksa Guru/Wali bounding box dan overflow. | Full suite visual tetap tidak clean secara reproducible. |
| G9. Field Arab/RTL pada materi dan soal | Selesai sebagian | `ArabicTextField` dipakai ulang oleh `lms-forms.tsx` dan `bank-soal-form.tsx`; `LocalizedContent` mengisolasi text/bidi. | Physical CSS masih ada di shell/dashboard dan seluruh mixed-content component belum diuji visual. |
| G10. Builder Ujian mempertahankan direction/language | Selesai sebagian | DTO dan preview `ujian-form.tsx:10,139,183` membawa language/direction; spacing baru memakai `ps`/`ms` di beberapa lokasi. | E2E RTL aktual fokus pada bank soal dan materi, bukan builder/hasil ujian lengkap. |
| G11. Fixture Arab nyata dan RTL regression | Selesai — terverifikasi | Seed memiliki materi/soal Arab; `mobile-layout.spec.ts:115-173` menguji content island Arab Guru/Wali pada 360/390 Chromium/WebKit; isolated run 16/16 lulus. | Tidak mencakup seluruh gradebook, ujian, dan materi panjang. |
| G12. Publish langsung tanpa konfirmasi | Belum dikerjakan | Archive action masih memakai `window.confirm` pada `material-status-actions.tsx`/`exam-status-actions.tsx`; form create/publish tidak membuktikan review audience/visibility. | Root safety issue tetap ada untuk publish, bukan sekadar styling. |
| G13. Navigation menampilkan fitur yang production-default off | Belum dikerjakan | `navigation.ts:11-70` statis; `feature-flags.ts:33-44` mematikan calendar/modules/assignments/gradebook/activity/remedial di production; layout memakai navigation tanpa filtering. | Route guard dapat menghasilkan not-found dari menu yang terlihat; E2E membutuhkan flag eksplisit. |
| G14. Metric “kelas teraktif/readiness/Live” | Selesai sebagian | Badge Live sudah hilang dan sebagian metric memakai `MetricCard`. | Formula “kelas teraktif”/readiness masih tidak didefinisikan sebagai business insight; metric page tetap snapshot. |

### Temuan Wali Murid

| ID / referensi baseline | Status | Bukti verifikasi | Celah atau regresi |
|---|---|---|---|
| W1. Selector anak mismatch cookie/URL | Selesai — terverifikasi | `wali-selector.ts:4-52`, `wali-child-selector.tsx:14-49`, dan DAL server `wali-selector-dal.ts:20-44` memakai URL/query serta validasi relasi Wali. Week 3 dan mobile RTL E2E menguji switch, detail, URL, dan history. | Tidak ada untuk scope yang diuji. |
| W2. `paymentHistory` Wali tidak ditampilkan | Selesai — terverifikasi | `billing-service.ts:132-185` menghapus `rawPayload` tetapi mempertahankan provider/reference/status/metode/nominal/waktu; `wali-billing-workspace.tsx:402-430` merender histori; `/wali/pembayaran` memakai ledger. Week 3 lulus. | Tidak ada. |
| W3. Dashboard agregat memakai subset tanpa disclosure | Selesai sebagian | `getActorDashboardContext` memakai aggregate-presensi dan role-scoped children; no-data ditampilkan sebagai `-` pada sebagian metric. | Progres `take:5`, nilai `take:3`, tagihan `take:3` di `actor-dal.ts:91-94`; dashboard tetap dapat memberi agregat parsial dan label “Lunas” ketika tidak ada tagihan aktif. |
| W4. `TERLAMBAT` Wali digabung ke Hadir | Belum dikerjakan | `wali/presensi/page.tsx:18-24,40-68` dan `report-service.ts:59-65` menghitung `HADIR + TERLAMBAT`; kartu hanya merender Hadir/Izin/Sakit/Alpa/Total. | Status terlambat tidak terlihat sebagai kategori sendiri dan tidak ada filter periode/detail sesi. |
| W5. Total Tagihan tidak merekonsiliasi status | Belum dikerjakan | `wali/tagihan/page.tsx:16-20,62-64` menjumlahkan seluruh `serializedItems`, sementara paid/open hanya subset status. | DRAFT/CANCELLED/REFUNDED dapat masuk total tetapi tidak masuk paid/open; rate dan tiga angka utama dapat berbeda definisi. |
| W6. Riwayat Nilai hanya tiga hasil | Belum dikerjakan | `wali/nilai/page.tsx:84-93` tetap memakai `slice(0, 3)` tanpa pagination atau CTA “lihat semua”. | Copy “Riwayat Nilai” berpotensi menyiratkan histori lengkap. |
| W7. Progres membuang kategori/tanggal dan membatasi histori | Belum dikerjakan | `report-service.ts:34-50` membatasi 12 progres/10 hasil; `wali/progres/[siswaId]/page.tsx:68-82` tidak merender category/date secara eksplisit. | Tidak ada filter kelas/periode, pagination, atau disclosure batas histori. |
| W8. Materi Semua Anak dan mixed RTL | Selesai sebagian | `wali/materi/page.tsx:44-59` menampilkan anak pada kartu dan memakai `LocalizedContent` untuk title/content/file; E2E Wali Arab memeriksa child context dan bidi. | Metadata kelas, badge Published, ukuran file, dan chrome kartu tidak menjadi content island; semua halaman materi belum diverifikasi. |
| W9. Hero Wali min-width clipping | Selesai — terverifikasi | Hero aside pada materi/tagihan/progres/nilai memakai `w-full min-w-0` sebelum breakpoint; mobile test mengukur Wali hero dan no overflow. |
| W10. Gradebook menampilkan provisional score | Belum dikerjakan | `gradebook-viewer.tsx:10-13` menghitung `finalScore`, tetapi merender `finalScore ?? row.calculatedScore`; halaman Wali menyatakan draft tidak terlihat. `getWaliGradebook` memakai `includeDrafts=false`, tetapi tetap menghitung `calculatedScore` dari published item. | Ini privacy/correctness gap P0/P1: calculated score dapat tampil tanpa final grade published. Tidak ada test yang memastikan draft/provisional hidden. |
| W11. Deep link Nilai/Tagihan kehilangan konteks anak | Selesai — terverifikasi | `wali/page.tsx:20,114-116` memakai `withWaliChildContext`; profil juga memakai helper; detail progres/tugas memakai child ID di path. | Beberapa link langsung path child dan beberapa query, tetapi server resolver tetap memvalidasi scope. |
| W12. Konflik specification ujian online Wali | Belum dikerjakan | `/wali/tugas` dan `/wali/tugas/[siswaId]` nyata serta online; PRD/audit masih menyatakan keputusan offline teacher-entry belum diberi sign-off formal. | Perlu keputusan produk/feature gate tertulis, bukan hanya implementasi route. |
| W13. To-do Assignment mengarah ke alur Ujian Wali | Belum dikerjakan | `todo-service.ts:108,117` memakai `/wali/tugas/{siswaId}` untuk Assignment dan Ujian; route tersebut menampilkan daftar ujian online dari `online-exam-service`. | Assignment biasa dan ujian online masih satu CTA/alur, sehingga item to-do dapat membawa pengguna ke fitur yang salah. |
| W14. Profil Wali dan query langsung Prisma | Selesai sebagian | `wali/profil/page.tsx:14-29` memiliki read-only explanation, fallback, relasi anak, dan deep link child-aware. | Query masih langsung ke Prisma, tidak melalui DAL/service policy yang konsisten dengan halaman lain. |

### Daftar Sisa TailAdmin Default

| ID / referensi baseline | Status | Bukti verifikasi | Celah atau regresi |
|---|---|---|---|
| T1. `brand-500/#465fff` dan ramp indigo | Selesai — terverifikasi | Tidak ditemukan di runtime `src`; `check:colors` lulus. |
| T2. Nama utility `tailadmin-*` | Gejala dihilangkan, akar belum | Utility di `globals.css:260-298` sekarang memakai warna LIMO dan didefinisikan valid. | Nama vendor masih dipakai luas di source; coupling dan persepsi template belum dihapus. |
| T3. Showcase tabel template | Selesai — terverifikasi | Route/component/navigation `/admin/data-tables` tidak ada. |
| T4. Istilah navigasi template | Selesai — terverifikasi | Navigation memakai Ringkasan, Pendaftaran, Berkas Materi, Pembelajaran, Evaluasi, dan workflow LIMO. |
| T5. Copy generik dashboard (`Command Center`, `Teacher Workspace`, `Parent Portal`, `Live`) | Selesai — terverifikasi | String tersebut tidak ditemukan di runtime `src`; match yang tersisa berada di audit/PRD/inventory documentation. |
| T6. Copy e-commerce/finance (`Finance health`, `Collection rate`, dll.) | Selesai — terverifikasi | Grep runtime tidak menemukan string baseline tersebut; billing memakai istilah Tagihan, Pembayaran, Lunas, dan Perlu dibayar. |
| T7. Badge palsu `Live` | Selesai — terverifikasi | Tidak dirender oleh `MetricCard` atau runtime dashboard. |
| T8. Raw enum/internal jargon | Selesai sebagian | `ui-labels.ts:3-129` memusatkan banyak label dan `StatusBadge` memakainya di banyak surface. | Fallback raw masih memungkinkan, contoh `admin/audit/page.tsx:93,102`; `guru/penilaian-esai/page.tsx:48` masih menyebut `Status NEEDS_REVIEW` mentah. |
| T9. Warna off-brand kalender | Selesai — terverifikasi | `calendar-view.tsx:17-36` memakai semantic LIMO blue/sky/yellow/red/green/neutral; test mobile dan `check:colors` lulus. |
| T10. Hardcoded legacy brand | Selesai — terverifikasi | OG, manifest, landing, auth, export, dan media memakai constants/token; legacy hex check di `src` lulus. |
| T11. Motif blob/floating card/metric grid | Gejala dihilangkan, akar belum | `DashboardHero` dan surface card tetap seragam; global override menyamarkan perbedaan komponen. |
| T12. Demo seed production guard | Selesai — terverifikasi | `prisma/seed.ts` menolak tanpa `LIMO_ALLOW_DEMO_SEED=true`; production ditolak kecuali jalur DOKPLOY demo; entrypoint MariaDB juga guard. Direct guard checks lulus. |
| T13. `tailadmin-button-secondary`/shade invalid | Selesai — terverifikasi | Utility secondary dan shade semantic sekarang didefinisikan; build/typecheck lulus. | Nama vendor tetap merupakan debt T2. |

## Klaim Vs Realita

| Klaim laporan fase | Hasil verifikasi | Status |
|---|---|---|
| `UI_UX_REAUDIT_FASE7.md:12-22`: keseluruhan 4/10 -> 8/10 | Implementasi memang jauh lebih lengkap, tetapi privacy gap gradebook, cross-write fallback, raw mutation patterns, feature flag navigation, contrast, dan coverage test menahan skor konservatif di 6/10. | Selesai sebagian |
| `UI_UX_REAUDIT_FASE7.md:14`: Branding 8/10 dan token konsisten | Palette LIMO lulus static check, tetapi `tailadmin-*` tetap menjadi nama primitive, hero masih template-like, Outfit remote import masih ada, dan offline surface memakai hex sendiri. | Selesai sebagian |
| `UI_UX_REAUDIT_FASE7.md:17`: Mobile 8/10 dengan visual regression Chromium/WebKit | Matrix project dan isolated mobile tests memang ada; run isolated mobile tercatat 16/16. Full run tidak clean secara reproducible dan tidak mencakup semua halaman baseline/touch target. | Selesai sebagian |
| `UI_UX_REAUDIT_FASE7.md:18`: RTL 8/10 untuk flow Guru dan Wali | Dua flow utama Arab benar-benar memakai fixture, font/content island, dan lulus screenshot/attribute checks. Klaim tidak boleh digeneralisasi ke semua exam/gradebook/mixed-content surface. | Selesai sebagian |
| `UI_UX_REAUDIT_FASE7.md:19`: Accessibility 8/10 dan axe/contrast di CI | Axe 3/3 dan keyboard/target tests lulus pada scope representative, bukan full dashboard. `gray-400` pada putih sekitar `2.68:1`; focus trap belum diuji dengan Tab cycle E2E. | Selesai sebagian |
| `UI_UX_REAUDIT_FASE7.md:20,26`: typed client dan lifecycle bersama menghapus parsing lokal | Enam workspace utama memakai `requestJson`, tetapi raw `fetch()` dan `window.confirm` tetap ada di billing, calendar, attendance, people, exam, module, gradebook, submission, dan lainnya. | Selesai sebagian |
| `UI_UX_REAUDIT_FASE7.md:36`: 49 browser test lulus | Targeted runs tersedia: accessibility 3/3, mobile/RTL isolated 16/16, Week 11 3/3, dan PWA 1/1. Full `npm.cmd run test:e2e` sebelumnya terhambat EPERM/feature flags serta snapshot WebKit/timeout; tidak ada satu full run yang dapat dipakai sebagai bukti hijau. | Selesai sebagian |
| `UI_UX_REAUDIT_FASE7.md:37`: seluruh integration suite lulus | Pada `dev.db`, Weeks 1-8 dan run Weeks 9-10 yang tersedia lulus. Pada fresh isolated DB, Weeks 1-7, 9, dan 10 lulus, tetapi Week 8 gagal karena reminder subprocess hardcode `dev.db`; klaim isolation runner belum benar. | Selesai sebagian |
| Gradebook Wali/Siswa hanya menampilkan nilai published | Source `gradebook-viewer.tsx:13` masih fallback ke `calculatedScore` jika `publishedScore` null. | Belum dikerjakan |
| Navigation dan route guard feature baru konsisten | Route guard memakai production defaults false, tetapi `navigation.ts` selalu merender link fitur. | Belum dikerjakan |

## Regresi Baru

| ID | Regresi | Bukti | Dampak |
|---|---|---|---|
| R1 | Test isolation Week 8 tidak benar-benar isolated | `tests/run-week8-integration.mjs:100,105` menjalankan reminder job dengan `DATABASE_URL: "file:./dev.db"`, meskipun suite memakai database URL fresh. Fresh isolated run gagal “Student reminder should be created”. | Klaim runner unik per spec tidak dapat dipercaya untuk flow reminder; CI bisa false negative/false positive tergantung state `dev.db`. |
| R2 | Navigation menampilkan route yang dimatikan production | `navigation.ts:21-58` statis, sedangkan `feature-flags.ts:33-44` default production false dan page/API memanggil `notFound`/guard. | Pengguna dapat melihat menu yang berakhir 404; E2E membutuhkan env flags manual. |
| R3 | PWA offline surface keluar dari token policy | `public/offline.html:8,10,12` memakai `#f3f3f3`, `#162033`, `#475569`; checker hanya memindai `src/`. | Brand/offline contrast policy tidak konsisten walau bukan legacy TailAdmin color. |
| R4 | Build dipengaruhi artefak dev `.next` | Build awal gagal di `.next/dev/types/validator.ts:305:1` dengan `Type 'RegExp' has no call signatures`; clean `.next` lalu build lulus. `tsconfig.json:37-38` memasukkan `.next/dev/types/**/*.ts`. | Build tidak reproducible bila artefak dev stale/corrupt tertinggal. |
| R5 | Gradebook implementation dapat mengekspos calculated score provisional | `gradebook-service.ts:320-334` menghitung calculated score pada `includeDrafts=false`; `gradebook-viewer.tsx:10-13` merender fallback itu. | Risiko privacy/correctness pada Wali/Siswa; belum ada regression test draft-hidden. |

Tidak ada bukti terukur bahwa bundle size naik signifikan. Tidak ada klaim bundle regression yang dapat dibuat tanpa measurement baseline.

## Test Dan Gate Aktual

| Command/scope | Hasil aktual |
|---|---|
| `npm.cmd test` | Lulus; 27 unit test. |
| `npm.cmd run typecheck` | Lulus. |
| `npm.cmd run lint` | Lulus pada run dengan timeout memadai. |
| `npm.cmd run check:colors` | Lulus. |
| `npx.cmd next typegen` | Lulus. |
| `npm.cmd run sqlite:setup` | Lulus; seed dev selesai. |
| `npm.cmd run build` | Lulus setelah `.next` dibersihkan; 114/114 static pages. Run pertama gagal karena stale `.next/dev` type artefact. |
| `npm.cmd run test:week1` sampai `test:week8` pada `dev.db` | Run tersedia lulus, termasuk `TERLAMBAT`, billing, calendar, dan reminder. |
| Fresh DB: `test:week1` sampai `test:week7`, `test:week9`, `test:week10` | Lulus. |
| Fresh DB: `test:week8` | Gagal pada reminder assertion karena child process line 100/105 hardcode `dev.db`; seluruh langkah sebelum reminder lulus. |
| `E2E_SPEC=week11.spec.ts npm.cmd run test:e2e` dengan feature flags | 3/3 lulus pada latest run: Admin workspace/scoping, Guru workspace scoping, Wali ledger child scope. |
| `E2E_SPEC=accessibility.spec.ts npm.cmd run test:e2e` | 3/3 lulus pada recorded run; axe scope representative. |
| `E2E_SPEC=mobile-layout.spec.ts npm.cmd run test:e2e` | 16/16 lulus pada isolated run; empat project 360/390 Chromium/WebKit. |
| `npm.cmd run test:e2e:pwa` | 1/1 lulus. |
| Full `npm.cmd run test:e2e` tanpa setup flags/proses bersih | Tidak dapat dianggap hijau; pernah gagal karena Prisma engine `EPERM`, route feature 404 tanpa flags, dan run penuh berikutnya tidak selesai clean. |
| `git diff --check` | Tidak ada whitespace error yang ditemukan; hanya peringatan normalisasi CRLF pada worktree lama. |

## Rekomendasi Lanjutan

### P0

- Hapus fallback `row.calculatedScore` dari viewer Wali/Siswa; tampilkan nilai hanya jika final grade berstatus published/allowed. Tambahkan integration/E2E fixture final grade draft-hidden.
- Hapus fallback `student.progresBelajar[0]` untuk kategori `umum`; load default category hanya dari row dengan category yang sama. Tambahkan test ganti kategori A -> B -> `umum`, edit, save, dan verifikasi tiga record.

### P1

- Jadikan `navigation.ts` dibangun dari feature flags yang sama dengan route guard; tambah E2E production-like dengan flags default false.
- Perbaiki `run-week8-integration.mjs` agar child reminder job meneruskan `process.env.DATABASE_URL`, bukan `file:./dev.db`.
- Pisahkan `TERLAMBAT` dari `HADIR` pada semua ringkasan Wali dan tambahkan filter periode/detail sesi.
- Tetapkan satu definisi total/open/paid/refunded/cancelled untuk billing Wali dan tambahkan reconciliation assertion.
- Ganti semua `window.confirm` pada mutasi penting dengan `ConfirmDialog`; tambahkan E2E focus trap, Escape, Tab wrap, dan focus restoration.
- Selesaikan typed client adoption pada raw dashboard `fetch()` dan standardisasi status/nominal formatting.
- Jalankan full E2E dengan fresh DB, flags eksplisit, Chromium/WebKit, dan snapshot baseline yang stabil sebelum menyatakan suite lulus.
- Perluas RTL test ke builder/hasil ujian/gradebook dan ubah physical spacing yang memengaruhi content island menjadi logical properties.

### P2

- Rename/migrasikan primitive `tailadmin-*` ke nama semantic LIMO setelah semua consumer pindah.
- Pecah `DashboardHero`/surface variants agar hierarchy tidak selalu berupa blob, rounded card, metric grid, dan shadow yang sama.
- Perbaiki filter Siswa, audit aggregate/filter/metadata, histori nilai Wali, progres pagination, dan To-do route assignment-vs-exam.
- Ganti teks kecil `gray-400` pada kombinasi yang membutuhkan WCAG AA dan audit seluruh actionable color pair dengan angka contrast ratio.
- Tambahkan axe scan per workspace dan bounding-box width+height untuk seluruh action mobile kritis.

### P3

- Pindahkan hardcoded offline colors ke sumber brand yang dapat diuji.
- Tambahkan timestamp/source disclosure untuk snapshot metric dan polish empty/loading state per workspace.
- Tambahkan keputusan produk formal untuk scope ujian online Wali pada PRD dan feature gate.

## Keputusan Produksi

**Belum production-ready sebagai UI premium.**

Core domain dan banyak gate teknis sudah berfungsi, tetapi release/presentasi premium sebaiknya ditahan sampai P0 gradebook privacy dan progress category benar-benar ditutup, navigation feature flags diperbaiki, dan integration/E2E runner dapat menghasilkan run fresh yang hijau tanpa state leakage. Tidak diperlukan redesign total; yang diperlukan adalah hardening correctness, konsolidasi primitive, dan bukti regresi yang lebih jujur.

## Perubahan Auditor

- File baru yang dibuat: `docs/UI_UX_VERIFICATION_FASE7.md`.
- Tidak ada source aplikasi, test existing, schema, atau konfigurasi existing yang diubah oleh auditor.
