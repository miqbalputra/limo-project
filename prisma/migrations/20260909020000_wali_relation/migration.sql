-- Pilihan relasi wali (Bapak/Ibu) pada formulir pendaftaran.
-- Baris lama default IBU agar tidak menggantung.
ALTER TABLE `Pendaftaran`
  ADD COLUMN `waliRelation` ENUM('BAPAK', 'IBU') NOT NULL DEFAULT 'IBU' AFTER `waliName`;
