-- Rilis nilai per hasil ujian (per attempt/siswa), melampaui pengaturan global Ujian.
ALTER TABLE `HasilUjian` ADD COLUMN `releasedAt` DATETIME(3) NULL;
