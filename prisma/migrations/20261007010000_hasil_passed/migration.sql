-- KKM pada hasil ujian (wali/siswa/guru): flag lulus disimpan saat nilai difinalisasi,
-- sejalan dengan flag `passed` pada respons kuis publik.

ALTER TABLE `HasilUjian` ADD COLUMN `passed` BOOLEAN;
