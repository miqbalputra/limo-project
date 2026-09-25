-- Ruang tanya jawab kelas: thread + balasan (Fase B).
CREATE TABLE `DiskusiThread` (
  `id` VARCHAR(191) NOT NULL,
  `kelasId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `content` TEXT NOT NULL,
  `createdById` VARCHAR(191) NULL,
  `status` ENUM('OPEN','LOCKED','HIDDEN') NOT NULL DEFAULT 'OPEN',
  `isPinned` BOOLEAN NOT NULL DEFAULT false,
  `replyCount` INTEGER NOT NULL DEFAULT 0,
  `lastReplyAt` DATETIME(3) NULL,
  `deletedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `DiskusiThread_kelasId_status_isPinned_lastReplyAt_idx`(`kelasId`,`status`,`isPinned`,`lastReplyAt`),
  INDEX `DiskusiThread_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DiskusiThread` ADD CONSTRAINT `DiskusiThread_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DiskusiThread` ADD CONSTRAINT `DiskusiThread_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `DiskusiBalasan` (
  `id` VARCHAR(191) NOT NULL,
  `threadId` VARCHAR(191) NOT NULL,
  `content` TEXT NOT NULL,
  `createdById` VARCHAR(191) NULL,
  `parentReplyId` VARCHAR(191) NULL,
  `isTeacherAnswer` BOOLEAN NOT NULL DEFAULT false,
  `status` ENUM('VISIBLE','HIDDEN') NOT NULL DEFAULT 'VISIBLE',
  `deletedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `DiskusiBalasan_threadId_createdAt_idx`(`threadId`,`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DiskusiBalasan` ADD CONSTRAINT `DiskusiBalasan_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `DiskusiThread`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DiskusiBalasan` ADD CONSTRAINT `DiskusiBalasan_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
