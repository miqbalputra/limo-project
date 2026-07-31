ALTER TABLE `Ujian`
  ADD COLUMN `deliveryMode` VARCHAR(32) NOT NULL DEFAULT 'TEACHER_ENTRY',
  ADD COLUMN `availableFrom` DATETIME(3) NULL,
  ADD COLUMN `availableUntil` DATETIME(3) NULL,
  ADD COLUMN `maxAttempts` INT NOT NULL DEFAULT 1,
  ADD COLUMN `showResultToWali` BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE `UjianAttempt` (
  `id` VARCHAR(191) NOT NULL,
  `ujianId` VARCHAR(191) NOT NULL,
  `siswaId` VARCHAR(191) NOT NULL,
  `waliProfileId` VARCHAR(191) NOT NULL,
  `hasilUjianId` VARCHAR(191) NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS',
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `submittedAt` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `UjianAttempt_ujianId_siswaId_idx` ON `UjianAttempt`(`ujianId`, `siswaId`);
CREATE INDEX `UjianAttempt_waliProfileId_status_idx` ON `UjianAttempt`(`waliProfileId`, `status`);

ALTER TABLE `UjianAttempt` ADD CONSTRAINT `UjianAttempt_ujianId_fkey` FOREIGN KEY (`ujianId`) REFERENCES `Ujian`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `UjianAttempt` ADD CONSTRAINT `UjianAttempt_siswaId_fkey` FOREIGN KEY (`siswaId`) REFERENCES `Siswa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `UjianAttempt` ADD CONSTRAINT `UjianAttempt_waliProfileId_fkey` FOREIGN KEY (`waliProfileId`) REFERENCES `WaliProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
