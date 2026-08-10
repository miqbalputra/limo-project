# Prompt: Evaluasi Verifikasi Perbaikan UI/UX LIMO (opencode)

Jalankan setelah 7 fase perbaikan selesai. Tujuannya bukan audit ulang dari nol, tapi **verifikasi klaim** — apakah yang dilaporkan "sudah dikerjakan" di tiap fase benar-benar ada di kode, tidak setengah jadi, tidak menimbulkan regresi baru, dan tidak sekadar menghilangkan gejala tanpa membereskan akar masalah.

---

## PROMPT

```
Kamu adalah auditor independen. Tugasmu memverifikasi apakah 7 fase perbaikan UI/UX LIMO benar-benar selesai dan optimal — bukan mempercayai ringkasan yang dilaporkan opencode di sesi sebelumnya, tapi membuktikannya langsung dari kode, test, dan hasil eksekusi.

Bahan yang kamu pakai sebagai baseline:
- `UI_UX_AUDIT.md` (audit awal, skor 4/10, daftar temuan asli dengan file/baris/prioritas)
- Riwayat commit dari 7 fase perbaikan (baca commit log/diff, jangan hanya baca pesan commit)
- Source code aktual saat ini

Sikap yang wajib kamu pakai: skeptis terhadap klaim "sudah selesai". Kalau sebuah temuan ditandai selesai tapi ternyata hanya gejalanya yang hilang (misalnya warna diganti di satu tempat tapi masih hardcoded di tempat lain), catat sebagai **belum selesai**, bukan selesai sebagian.

### Langkah Verifikasi

Untuk **setiap temuan** di `UI_UX_AUDIT.md` (Temuan Lintas Role, Temuan per Role Admin/Guru/Wali, dan item di "Daftar Sisa TailAdmin Default"), lakukan:

1. **Cari bukti langsung di kode saat ini** — buka file & baris yang direferensikan audit asli (atau lokasi barunya jika sudah dipindah/direfactor), bukan hanya percaya nama function/komponen baru terdengar benar.
2. **Klasifikasikan status**:
   - `Selesai — terverifikasi`: kode + test membuktikan temuan benar-benar tertutup.
   - `Selesai sebagian`: sebagian kasus tertangani tapi ada celah (jelaskan celahnya persis).
   - `Gejala dihilangkan, akar belum`: tampilan berubah tapi struktur/token/root cause yang sama masih ada di tempat lain.
   - `Belum dikerjakan`: tidak ada perubahan relevan.
   - `Regresi baru`: perbaikan di satu tempat menciptakan bug/inkonsistensi baru di tempat lain (misalnya token warna baru dipakai di dashboard tapi belum di landing/PDF/OG image, atau ResponsiveDataView baru dipakai sebagian tabel saja).
3. **Jalankan test yang relevan** (unit, integration, E2E, termasuk matriks 360px/390px + Chromium/WebKit dari Fase 5, dan visual regression RTL dari Fase 6) — laporkan hasil run yang sebenarnya, bukan asumsi bahwa test "pasti lulus" karena file test ada.
4. **Cek sisi optimalitas, bukan cuma "ada"** — untuk tiap item, nilai juga:
   - Apakah solusinya reusable (misal `ConfirmDialog`, `ResponsiveDataView`, `StatusBadge`, `LocalizedContent` benar-benar dipakai ulang di semua tempat yang seharusnya, atau hanya di lokasi contoh yang disebut prompt fase)?
   - Apakah masih ada duplikasi baru yang muncul selama proses perbaikan (misalnya dua versi ConfirmDialog karena satu tim/agent lupa yang lama sudah ada)?
   - Apakah token warna baru punya kontras yang teruji (WCAG AA) atau cuma "terlihat mirip brand"?

### Verifikasi Per Fase

**Fase 1 (P0 Correctness)**
- Presensi Guru: coba skenario input TERLAMBAT end-to-end, cek summary presensi ikut update, cek record lama Terlambat tidak lagi block save. Jalankan ulang test yang disebutkan berubah dari 4→5 opsi, pastikan benar 5 opsi bukan cuma nama variabel berubah.
- Progres Guru: reproduksi skenario "ganti kategori lalu simpan" secara manual/test, buktikan tidak ada cross-write ke kategori lain.
- Selector anak Wali: uji perpindahan anak via selector DAN via manipulasi URL langsung, pastikan tidak ada state stale di kedua arah.

**Fase 2 (Finansial & Safety)**
- Cek `paymentHistory` Wali benar-benar tampil dengan provider/reference/status/nominal/waktu, bukan hanya ada di DTO tapi tidak dirender.
- Uji filter DRAFT Tagihan Admin dengan query langsung, pastikan hasilnya benar-benar terfilter, bukan diam-diam all-status lagi.
- Untuk generate invoice bulk: pastikan dry-run adalah default nyata (bukan checkbox yang defaultnya masih unchecked di kode), dan review count muncul sebelum eksekusi nyata.
- Cek `ConfirmDialog` dipakai konsisten di SEMUA aksi destructive yang disebut audit (status siswa, transfer kelas, aktivasi akun, delete agenda) — bukan hanya sebagian, dan cek focus trap + focus restoration benar-benar berfungsi (uji keyboard).

**Fase 3 (Token & Residu TailAdmin)**
- Grep seluruh codebase untuk `#465fff`, `465FFF`, `#3b5bdb`, dan hex lain yang disebut di audit asli — pastikan nol hasil di luar file token/legacy yang sengaja dipertahankan.
- Grep untuk `brand-500`, ramp indigo lama, dan seluruh utility `tailadmin-*` — pastikan sudah tidak dipakai atau sudah didefinisikan+diganti nama sesuai brand LIMO.
- Cek `/admin/data-tables` benar-benar dihapus (route, komponen, entri navigasi) — akses langsung ke path tersebut harus 404 atau redirect, bukan diam-diam masih hidup tapi disembunyikan dari nav.
- Cek copy generik yang di-list di audit (`Command Center`, `Finance health`, `Live` badge, dll) — grep string tersebut di seluruh dashboard, pastikan benar-benar nol atau jelaskan sisa yang legitimate.
- Cek mapping enum→label terpusat benar-benar dipakai di semua tempat yang tadinya bocor raw enum (ACTIVE, PUBLISHED, MISSING, EXEMPT, MANUAL, dll), bukan hanya di komponen yang dicontohkan.
- Verifikasi kontras token warna baru (hitung rasio kontras teks-di-atas-warna untuk kombinasi yang dipakai actionable text/button, laporkan angka rasio, bukan penilaian visual subjektif).
- Cek seed demo (`prisma/seed.ts`) punya guard eksplisit agar tidak jalan di production — baca kode guard-nya, jangan percaya komentar saja.

**Fase 4 (Information Architecture)**
- Untuk tiap halaman baru (Jadwal/Sesi Admin, Pembayaran Admin, detail/edit Wali & Guru, `/guru/sesi`, workspace Materi terpisah, queue Penilaian Esai, `/wali/pembayaran`): buka route-nya langsung, pastikan bukan halaman kosong/placeholder, dan data yang tampil berasal dari service/DAL nyata (bukan mock).
- Jalankan test role-scoping yang seharusnya ditambahkan (guru hanya lihat kelasnya sendiri, wali hanya lihat anaknya) — coba akses data role lain secara langsung via URL/API untuk memastikan otorisasi benar, bukan hanya UI yang menyembunyikan menu.

**Fase 5 (Mobile & Responsive)**
- Jalankan test di breakpoint 360px dan 390px, Chromium DAN WebKit, untuk semua halaman yang disebut audit bermasalah (tabel Admin, Tagihan, kalender, hero Guru/Wali). Screenshot atau assertion bounding-box harus membuktikan tidak ada clipping/horizontal scroll di luar yang disengaja.
- Cek `ResponsiveDataView` dipakai di SEMUA tabel yang disebut audit (bukan cuma 1-2 contoh), dan default view di mobile untuk Tagihan sudah kartu, bukan tabel sebagai default lalu user harus ganti manual.
- Ukur target sentuh (bounding box) elemen interaktif kritis (event kalender, selector anak, tombol aksi tabel mobile) — pastikan ≥44px, laporkan yang masih di bawah itu.

**Fase 6 (RTL/Arab)**
- Buka halaman materi/soal Arab dengan fixture Arab nyata, verifikasi font Arab benar-benar termuat (bukan fallback sistem — cek network/font-face di build), `lang="ar"` terpasang pada content island yang benar, dan logical CSS (margin-inline-*) dipakai bukan physical (margin-left/right) di komponen tersebut.
- Cek `LocalizedContent`/`ArabicTextField` benar dipakai ulang di form soal Guru DAN tampilan materi Wali, bukan dua implementasi terpisah yang mirip tapi tidak sama.
- Jalankan visual regression test RTL, laporkan hasil aktual (pass/fail), termasuk untuk kasus konten campuran Arab-Latin (bidi isolation).

**Fase 7 (Ekstraksi & PWA)**
- Cek keenam komponen yang disebut (`assignment-builder.tsx`, dst) benar-benar memakai satu typed fetch client yang sama, bukan sebagian pindah sebagian belum.
- Cek `StatusBadge`/`Money`/metric surface dipakai konsisten di seluruh dashboard, grep untuk pola formatting nominal/status manual yang seharusnya sudah digantikan.
- Cek loading/error state per role sudah benar-benar berbeda (bukan generic yang di-styling ulang saja) dan CTA error mengarah ke dashboard role yang login, uji dengan skenario error nyata di tiap role.
- Cek PWA: install manifest, icon PNG/maskable valid (buka dan render icon-nya, bukan cuma cek file ada), uji offline behavior benar-benar sesuai strategi eksplisit yang didefinisikan (bukan masih fallback default lama), dan PWA E2E test berjalan.
- Jalankan axe/contrast audit otomatis, laporkan pelanggaran yang tersisa (jika ada) dengan detail elemen dan halaman.

### Output yang Diharapkan

1. **Scorecard perbandingan** — tabel dengan kolom: Dimensi (sama seperti audit asli: Branding, Hierarki visual, Kekhususan domain, Mobile operasional, Bahasa Arab/RTL, Aksesibilitas, State & safety), Skor Awal (dari audit), Skor Sekarang, Bukti/Justifikasi perubahan skor.

2. **Tabel status per temuan** — setiap baris temuan dari audit asli, dengan kolom: ID/Referensi temuan, Status (5 kategori di atas), Bukti verifikasi (file/baris/hasil test), Catatan jika ada regresi/celah.

3. **Daftar "Klaim vs Realita"** — khusus untuk temuan yang di laporan fase sebelumnya diklaim "selesai" tapi hasil verifikasimu menunjukkan sebaliknya (selesai sebagian/gejala saja/regresi). Ini bagian paling penting — jangan disembunyikan atau dihaluskan.

4. **Regresi baru** — daftar masalah yang muncul akibat proses perbaikan itu sendiri (misal: token baru dipakai di dashboard tapi belum di landing, atau komponen baru menambah bundle size signifikan, atau test lama yang justru jadi flaky).

5. **Rekomendasi lanjutan** — jika masih ada gap, urutkan ulang berdasarkan prioritas P0-P3 seperti format audit asli, supaya bisa langsung dipakai untuk fase perbaikan tambahan jika diperlukan.

6. **Kesimpulan produksi** — apakah produk SEKARANG sudah layak disebut siap dipresentasikan sebagai UI premium/production-ready, dengan syarat eksplisit apa yang masih menahannya jika belum.

### Aturan Ketat
- Jangan menilai dari commit message atau ringkasan yang dibuat sesi sebelumnya sebagai bukti — commit message bisa salah/optimis. Bukti harus dari kode, hasil test run, atau pengukuran nyata (kontras, bounding box, dsb).
- Jika suatu test tidak bisa dijalankan (butuh browser/device yang tidak tersedia di environment ini), nyatakan eksplisit "tidak dapat diverifikasi otomatis di sini" — jangan mengasumsikan lulus.
- Jangan memberi skor lebih tinggi dari bukti yang kamu punya. Lebih baik under-claim dengan bukti jelas daripada over-claim.
```

---

## Cara Pakai

1. Jalankan setelah seluruh 7 fase (dan commit-nya) selesai.
2. Beri opencode akses ke `UI_UX_AUDIT.md` asli dan riwayat commit 7 fase (`git log`), supaya ia bisa membandingkan klaim vs kode aktual.
3. Fokus baca bagian **"Klaim vs Realita"** di hasilnya dulu — itu bagian yang paling sering disembunyikan kalau audit dikerjakan terburu-buru.
4. Jika hasilnya menunjukkan ada temuan berstatus "Belum dikerjakan" atau "Gejala dihilangkan, akar belum", jangan lanjut ke fase baru — minta opencode kembali ke fase terkait dengan prompt fase yang sama, sambil menyertakan hasil verifikasi ini sebagai konteks tambahan.
