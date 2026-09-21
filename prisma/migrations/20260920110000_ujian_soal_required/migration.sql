-- Toggle "wajib diisi" per soal pada form builder
ALTER TABLE `UjianSoal`
  ADD COLUMN `required` BOOLEAN NOT NULL DEFAULT true;
