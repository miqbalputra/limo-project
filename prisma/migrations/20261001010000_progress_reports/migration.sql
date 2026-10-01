-- Laporan perkembangan berkala per siswa per kelas (rencana.md Fase 10).
CREATE TABLE `ProgressReport` (
  `id` VARCHAR(191) NOT NULL,
  `studentId` VARCHAR(191) NOT NULL,
  `kelasId` VARCHAR(191) NOT NULL,
  `reportType` ENUM('WEEKLY','MONTHLY','LEVEL_COMPLETION') NOT NULL DEFAULT 'MONTHLY',
  `status` ENUM('DRAFT','PUBLISHED','REVISED') NOT NULL DEFAULT 'DRAFT',
  `periodStart` DATETIME(3) NOT NULL,
  `periodEnd` DATETIME(3) NOT NULL,
  `summary` TEXT NOT NULL,
  `strengths` TEXT NOT NULL,
  `improvementAreas` TEXT NOT NULL,
  `teacherRecommendation` TEXT NOT NULL,
  `snapshotData` JSON NULL,
  `createdById` VARCHAR(191) NULL,
  `publishedAt` DATETIME(3) NULL,
  `revisedAt` DATETIME(3) NULL,
  `revisionReason` TEXT NULL,
  `notifiedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `ProgressReport_studentId_periodStart_idx`(`studentId`,`periodStart`),
  INDEX `ProgressReport_kelasId_status_idx`(`kelasId`,`status`),
  INDEX `ProgressReport_status_publishedAt_idx`(`status`,`publishedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProgressReport` ADD CONSTRAINT `ProgressReport_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Siswa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ProgressReport` ADD CONSTRAINT `ProgressReport_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ProgressReport` ADD CONSTRAINT `ProgressReport_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `ProgressReportRead` (
  `id` VARCHAR(191) NOT NULL,
  `reportId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `readAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ProgressReportRead_reportId_userId_key`(`reportId`,`userId`),
  INDEX `ProgressReportRead_userId_readAt_idx`(`userId`,`readAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProgressReportRead` ADD CONSTRAINT `ProgressReportRead_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `ProgressReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ProgressReportRead` ADD CONSTRAINT `ProgressReportRead_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
