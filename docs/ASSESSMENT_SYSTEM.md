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
