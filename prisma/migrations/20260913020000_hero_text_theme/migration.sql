-- Tema warna teks hero per slide (LIGHT = teks putih, DARK = teks navy)
ALTER TABLE `HeroSlide`
  ADD COLUMN `textTheme` VARCHAR(8) NOT NULL DEFAULT 'DARK';
