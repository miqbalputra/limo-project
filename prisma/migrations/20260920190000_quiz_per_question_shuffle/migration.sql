-- Acak urutan opsi per soal
ALTER TABLE `BankSoal`
  ADD COLUMN `shuffleOptions` BOOLEAN NOT NULL DEFAULT false;
