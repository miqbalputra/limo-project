-- Fase C: lapor konten diskusi + lampiran thread (penyimpanan privat).
ALTER TABLE `FileAsset` MODIFY `ownerType` ENUM('PENDAFTARAN','MATERI','USER','SISWA','RPP','DISKUSI');

ALTER TABLE `FileAsset` ADD COLUMN `diskusiThreadId` VARCHAR(191) NULL;
ALTER TABLE `FileAsset` ADD CONSTRAINT `FileAsset_diskusiThreadId_fkey` FOREIGN KEY (`diskusiThreadId`) REFERENCES `DiskusiThread`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX `FileAsset_diskusiThreadId_idx` ON `FileAsset`(`diskusiThreadId`);

CREATE TABLE `DiskusiLaporan` (
  `id` VARCHAR(191) NOT NULL,
  `threadId` VARCHAR(191) NOT NULL,
  `replyId` VARCHAR(191) NULL,
  `alasan` VARCHAR(500) NOT NULL,
  `reporterId` VARCHAR(191) NULL,
  `status` ENUM('OPEN','RESOLVED','DISMISSED') NOT NULL DEFAULT 'OPEN',
  `resolvedById` VARCHAR(191) NULL,
  `resolvedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `DiskusiLaporan_status_createdAt_idx`(`status`,`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DiskusiLaporan` ADD CONSTRAINT `DiskusiLaporan_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `DiskusiThread`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DiskusiLaporan` ADD CONSTRAINT `DiskusiLaporan_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DiskusiLaporan` ADD CONSTRAINT `DiskusiLaporan_resolvedById_fkey` FOREIGN KEY (`resolvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
