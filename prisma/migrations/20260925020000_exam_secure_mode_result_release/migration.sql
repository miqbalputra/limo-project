-- Mode aman ujian + kontrol rilis nilai ke siswa.
-- Ujian.secureMode: guru mengaktifkan deteksi perpindahan tab saat pengerjaan.
-- Ujian.showResultToSiswa: nilai hanya tampil ke siswa setelah diizinkan guru.
ALTER TABLE `Ujian`
  ADD COLUMN `secureMode` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `showResultToSiswa` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `UjianAttempt`
  ADD COLUMN `violationCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `lastViolationAt` DATETIME(3) NULL;
