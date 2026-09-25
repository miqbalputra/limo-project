# LIMO SD Assessment System

LIMO mendukung bank assessment untuk English/Arabic usia SD dengan metadata pedagogis dan mode input hasil offline oleh guru.

## Tipe Soal

- `PILIHAN_GANDA`: satu opsi benar, auto-score.
- `MULTI_SELECT`: beberapa opsi benar, auto-score jika set jawaban tepat.
- `BENAR_SALAH`: auto-score dari kunci `benar`/`salah`.
- `ISIAN_SINGKAT`: auto-score jika `expectedAnswer` diisi.
- `CLOZE`: fill in the blank, auto-score jika `expectedAnswer` diisi.
- `MENJODOHKAN`: guru mengisi pasangan soal dan jawaban benar melalui form biasa.
- `URUTAN`: guru mengisi item sesuai urutan benar melalui form biasa.
- `GAMBAR`: picture-based prompt, dapat dinilai manual atau memakai kunci singkat.
- `LISTENING`: prompt audio/listening, dapat dinilai manual atau memakai kunci singkat.
- `READING`: stimulus bacaan, dapat dinilai manual atau memakai kunci singkat.
- `SPEAKING`: speaking prompt, manual review/rubric.
- `WRITING`: simple writing task, manual review/rubric.
- `ROLEPLAY`: performance task, manual review/rubric.
- `ESAI`: jawaban panjang, manual review/rubric.

## Metadata

Setiap soal dapat diberi metadata:

- `cognitiveLevel`: `LOTS`, `MOTS`, `HOTS`.
- `skill`: listening, reading, speaking, writing, vocabulary, grammar, pronunciation, numeracy, literacy.
- `difficulty`: `EASY`, `MEDIUM`, `HARD`.
- `standard`: contoh `CEFR Pre-A1`, `CEFR A1`, `AKM Literasi`, `Internal Arabic`.
- `assessmentType`: `FORMATIVE`, `SUMMATIVE`, `PLACEMENT`, `DIAGNOSTIC`.

## Field Fleksibel

- `stimulusText`: bacaan, dialog, instruksi listening, atau konteks roleplay.
- `mediaUrl`: referensi gambar/audio/media.
- `expectedAnswer`: kunci jawaban sederhana.
- Data pasangan/urutan disimpan terstruktur oleh sistem dari field yang diisi guru.
- Rubrik disimpan terstruktur oleh sistem dari kriteria dan skor maksimal yang diisi guru.

## Scoring

- Soal objektif dihitung otomatis bila kunci tersedia.
- Soal performa/esai masuk `NEEDS_REVIEW` jika guru belum mengisi skor manual.
- Guru dapat mengisi transkrip/catatan performa pada input hasil offline.

## Paritas Ujian Online dengan Google Forms

- **Penegakan di server**: jawaban wajib divalidasi di server untuk submit publik maupun pengerjaan via wali (bukan hanya di klien). Soal pada bagian yang dilewati karena branching tidak diwajibkan.
- **Grace window & auto-submit**: submit masih diterima dalam 20 detik setelah waktu habis; pemutar publik dan pemutar wali mengirim jawaban otomatis saat waktu habis. Job `npm run quiz:finalize` menilai draf yang ditinggalkan di luar grace agar jawaban tidak hilang.
- **Kunci alternatif**: soal isian singkat/tanggal/waktu dapat menerima beberapa jawaban benar (`acceptedAnswers`).
- **Validasi jawaban**: angka (rentang), panjang teks/paragraf, pola regex, dan jumlah pilihan untuk kotak centang (`CHECKBOX`), ditegakkan di server.
- **Branching** tersedia untuk semua tipe pilihan (pilihan ganda, kotak centang, dropdown).
- **Umpan balik kustom** benar/salah per soal, tampil di halaman hasil bersama pembahasan.
- **Batas unggah per soal**: tipe MIME diizinkan dan ukuran maksimum (MB) untuk soal unggah berkas.
- **Email responden** opsional per kuis: wajib diisi bila diaktifkan, dipakai untuk salinan jawaban dan pembatasan 1 respons per email.
- **Notifikasi guru** saat ada respons baru dan **salinan jawaban** ke email responden (bila diaktifkan).
- **Rilis nilai tertunda**: `releaseMode=AFTER_REVIEW` menahan skor/kunci sampai guru merilis lewat halaman Respons.
- **Mode presentasi**: semua soal per halaman atau satu soal per halaman.
- **Impor soal** dari formulir kuis lain (menyalin soal, opsi, kunci, dan pengaturannya).
- **Penilaian manual respons publik**: guru memberi skor per soal untuk esai/unggah berkas/opsi "Lainnya" lewat halaman detail respons; total skor, status, dan kelulusan dihitung ulang otomatis.
- **Pemutar wali** memiliki mode satu soal per halaman dan auto-submit yang sama dengan tautan publik.
- **Aksesibilitas navigasi**: fokus berpindah ke soal berikutnya saat menekan Berikutnya, jawaban wajib divalidasi per soal sebelum lanjut.

