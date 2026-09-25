-- Pengumuman kelas dengan audience, jadwal, dan status baca (Fase A).
CREATE TABLE `Pengumuman` (
  `id` VARCHAR(191) NOT NULL,
  `kelasId` VARCHAR(191) NULL,
  `title` VARCHAR(200) NOT NULL,
  `content` TEXT NOT NULL,
  `priority` ENUM('NORMAL','IMPORTANT','URGENT') NOT NULL DEFAULT 'NORMAL',
  `audience` ENUM('SISWA','WALI','SEMUA') NOT NULL DEFAULT 'SEMUA',
  `status` ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'PUBLISHED',
  `publishAt` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NULL,
  `notifiedAt` DATETIME(3) NULL,
  `createdById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `Pengumuman_kelasId_status_publishAt_idx`(`kelasId`,`status`,`publishAt`),
  INDEX `Pengumuman_status_expiresAt_idx`(`status`,`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Pengumuman` ADD CONSTRAINT `Pengumuman_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Pengumuman` ADD CONSTRAINT `Pengumuman_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `PengumumanRead` (
  `id` VARCHAR(191) NOT NULL,
  `pengumumanId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `readAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `PengumumanRead_pengumumanId_userId_key`(`pengumumanId`,`userId`),
  INDEX `PengumumanRead_userId_readAt_idx`(`userId`,`readAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PengumumanRead` ADD CONSTRAINT `PengumumanRead_pengumumanId_fkey` FOREIGN KEY (`pengumumanId`) REFERENCES `Pengumuman`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PengumumanRead` ADD CONSTRAINT `PengumumanRead_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
