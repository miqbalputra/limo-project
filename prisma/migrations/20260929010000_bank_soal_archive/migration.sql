-- Arsip soal bank (kolom archivedAt) agar soal yang sudah dipakai ujian dapat disembunyikan tanpa hard delete.
ALTER TABLE `BankSoal` ADD COLUMN `archivedAt` DATETIME(3) NULL;
