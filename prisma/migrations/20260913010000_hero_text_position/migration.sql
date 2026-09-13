-- Posisi teks hero per slide (LEFT/RIGHT)
ALTER TABLE `HeroSlide`
  ADD COLUMN `textPosition` VARCHAR(8) NOT NULL DEFAULT 'LEFT';
