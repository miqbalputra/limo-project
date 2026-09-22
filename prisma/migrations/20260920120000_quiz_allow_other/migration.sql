-- Opsi "Lainnya" (Other) ala Google Forms untuk soal pilihan ganda/checkbox
ALTER TABLE `BankSoal`
  ADD COLUMN `allowOther` BOOLEAN NOT NULL DEFAULT false;
