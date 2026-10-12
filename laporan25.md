# Laporan 25 — Audit Soal Builder & Kuis (tampilan share ramah anak SD)

Tanggal: 2026-10-12 · Scope: builder soal (`/guru/kuis`), pemutar kuis publik (`/kuis/[token]`), penilaian & pembahasan, aksesibilitas, tampilan mobile 390px.

---

## 1. Ringkasan

Audit dilakukan tiga lapis: (1) baca kode builder & pemutar publik, (2) verifikasi backend (`typecheck`, `lint`, unit + 3 integration suite kuis), (3) audit visual di browser viewport 390x844 (Playwright) dengan kuis demo bertema SD lengkap dengan branching, menjodohkan, urutan, isian, dan rating.

**Hasil:** fitur inti sudah lengkap dan teruji (semua integration test hijau), tetapi tampilan halaman share masih bergaya "dasbor dewasa". Perbaikan P0 (bug) dan P1 (UX ramah anak) sudah dikerjakan dan diverifikasi.

**Skor per facet (sebelum → sesudah):**

| Facet | Sebelum | Sesudah |
|---|---|---|
| Builder soal (fitur & UX guru) | 92 | 92 |
| Pemutar kuis publik (fitur) | 90 | 92 |
| Tampilan share ramah anak SD | 60 | 90 |
| Hasil & pembahasan (pembelajaran) | 70 | 92 |
| Mobile / target sentuh | 80 | 90 |
| Aksesibilitas | 85 | 88 |
| Keamanan (kunci tidak bocor, isolasi) | 95 | 95 |
| **Keseluruhan** | **≈ 82** | **≈ 91** |

## 2. Yang sudah bekerja (terverifikasi, tidak diubah)

- **Builder ala Google Forms**: 21 tipe soal, section + branching, autosave draf + undo/redo, pustaka soal & impor antar formulir, duplikat formulir/soal, tema warna + gambar header, gambar per soal/per opsi, unggah berkas, preflight + verifikasi kunci sebelum publish, cetak PDF (± kunci).
- **Keamanan**: kunci jawaban tidak pernah dikirim ke halaman publik (`public-quiz-service` mengirim `matchingPairs`/`sequenceItems` tanpa kunci); rate limit login & upload; anti-respons ganda per email; `maxAttempts` ditegakkan.
- **Penilaian**: grader tunggal `gradeObjectiveAnswer` (poin parsial untuk multi-select/GRID/menjodohkan/urutan), KKM, rilis nilai, koreksi manual, ekspor CSV, analitik per soal.
- **Ketahanan**: autosave draf 800ms, antrean unggah offline, timer kedaluwarsa otomatis submit, resume attempt dari localStorage, submit grace 20 detik.

## 3. Temuan & perbaikan yang dikerjakan

### P0 — Bug

1. **Validasi klien memblokir submit saat soal wajib berada di bagian yang dilompati branching.** Server (`findMissingRequiredAnswers`) melewati bagian yang tidak terjangkau, tetapi validasi klien memeriksa semua soal → siswa terjebak "Soal wajib belum diisi" padahal server menerima.
   **Fix:** pemutar publik kini memakai `collectReachableQuestionIds` (helper murni `quiz-grading.ts`) untuk submit, progress, dan dialog tinjau.
2. **Pembahasan MENJODOHKAN/URUTAN/GRID menampilkan "Kunci: -".** `primaryAnswer` hanya dari `expectedAnswer`/opsi benar; pasangan & urutan tidak ikut.
   **Fix:** server kini membangun kunci terbaca (`Kucing → Mengeong · Sapi → Melenguh`, `1. Semut 2. Kucing 3. Gajah`, `Baris: Ya`) via `pairingAnswerKey`.

### P1 — Pembelajaran & tampilan ramah anak SD

3. **Jawaban siswa tidak tampil di pembahasan** (hanya kunci). **Fix:** server mengirim `yourAnswer` (didekode dari anchor jodoh/urutan/GRID → teks); hasil kini menampilkan ikon ✓/✕ per soal, "Jawabanmu", dan "Kunci" hanya saat salah.
4. **Hasil tanpa selebrasi & skor desimal** (69.73). **Fix:** skor dibulatkan, kartu skor besar berwarna tema + baris bintang 1–5, heading selebrasi ("🎉 Hebat, …" / "💪 Semangat, …"), pesan motivasi sesuai lulus/tidak.
5. **Intro & soal kurang ramah anak.** **Fix:** label "✨ Kuis", tile info beremoji (📝/⏱️/🎯) 3 kolom, tombol "🚀 Mulai!", chip "⭐ Wajib", teks soal lebih besar (`text-lg sm:text-xl`), teks progres "X dari Y soal terjawab" (bukan persen), timer "⏰ Sisa mm:ss", tombol "Lanjut ➜" / "✅ Kumpulkan Jawaban".
6. **Target sentuh kecil & warna tema tidak diterapkan ke input.** **Fix:** radio/checkbox `size-5` dengan `accentColor` mengikuti tema, kartu opsi `border-2 p-3.5` + badge ✓ saat dipilih, tombol rating/skala `size-12`, tombol ▲▼ urutan `size-8`, slot jodoh `min-h-12`.
7. **Hint menjodohkan menyesatkan di HP** ("Tarik kartu…"). **Fix:** "Ketuk kartu jodoh di samping, lalu ketuk kotak ini".
8. **A11y & perlindungan**: `aria-pressed` pada tombol rating/skala, dialog tinjau hanya menampilkan bagian terjangkau, peringatan `beforeunload` saat kuis berjalan, tombol "Bersihkan" tidak lagi merah mencolok.

## 4. Yang masih terbuka (roadmap)

- **P2 (UX)**: drag & drop menjodohkan/urutan belum bisa di perangkat sentuh (saat ini ketuk-untuk-pilih + ▲▼ sudah berfungsi); skor "benar/salah" kunci tampil huruf kecil (`benar`); pratinjau builder belum mengelompokkan per bagian.
- **P2 (fitur)**: Q&A per materi/modul; sumber remedial QUIZ/EXAM/COMPETENCY; e2e RTL Arab.
- **P1 (opsional)**: mode "ramah anak" penuh (maskot/ilustrasi) bila diinginkan sebagai tema terpisah per formulir.

## 5. Verifikasi (bukti hijau, setelah perubahan)

- `typecheck` ✓ (exit 0) · `lint` ✓ 0 error (file yang diubah) · `npm test` 14/14 ✓
- `test:quiz-builder` **25/25** ✓ · `test:quiz-share` **6/6** ✓ · `test:siswa-ujian` **14/14** ✓ (terhadap dev server `NODE_ENV=development`)
- Browser 390x844 (Playwright): 9 tahap intro→soal→menjodohkan→urutan→rating→tinjau→hasil terekam sebelum & sesudah; hasil API menunjukkan `yourAnswer`/`kunci` benar dan penilaian tepat (skor 69.73 → tampil 70, konsisten dengan poin parsial urutan 1/3).
- Data demo kuis dihapus dari `dev.db`; tidak ada perubahan skema/migrasi.

## 6. Catatan operasional

- **Gotcha local dev**: bila `NODE_ENV=production` ter-set di shell, `getEnv()` menolak `NOTIFICATION_PROVIDER=console` → semua API yang memanggil `getEnv()` (termasuk login) 500. Jalankan dev dengan `NODE_ENV=development` (log shell tool mengabaikan stdout Next.js; cek log via redirect file saat perlu).
- Tidak ada commit/push untuk perubahan ini — menunggu instruksi.
