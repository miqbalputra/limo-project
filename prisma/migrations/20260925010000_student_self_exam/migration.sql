-- Ujian mandiri untuk siswa: attempt dapat dimiliki akun Siswa, bukan hanya Wali.
-- waliProfileId dilonggarkan menjadi NULL agar attempt yang dimulai siswa tidak butuh wali.
ALTER TABLE `UjianAttempt` MODIFY `waliProfileId` VARCHAR(191) NULL;

ALTER TABLE `UjianAttempt`
  ADD COLUMN `siswaAccountId` VARCHAR(191) NULL,
  ADD COLUMN `startedByRole` VARCHAR(16) NOT NULL DEFAULT 'WALI';

CREATE INDEX `UjianAttempt_siswaAccountId_status_idx` ON `UjianAttempt`(`siswaAccountId`, `status`);

ALTER TABLE `UjianAttempt`
  ADD CONSTRAINT `UjianAttempt_siswaAccountId_fkey`
  FOREIGN KEY (`siswaAccountId`) REFERENCES `SiswaAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
