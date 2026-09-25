-- Penilaian manual respons kuis publik (skor per soal untuk esai/berkas/"Lainnya").
ALTER TABLE `QuizResponse`
  ADD COLUMN `manualScores` JSON NULL;
