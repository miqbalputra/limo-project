-- Tema warna form kuis (ala Google Forms)
ALTER TABLE `Ujian`
  ADD COLUMN `themeColor` VARCHAR(16) NOT NULL DEFAULT 'blue';
