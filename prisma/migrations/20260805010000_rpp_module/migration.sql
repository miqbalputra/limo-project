CREATE TABLE `Rpp` (
    `id` VARCHAR(191) NOT NULL,
    `kelasId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `mode` ENUM('FORM', 'FILE') NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `title` VARCHAR(191) NOT NULL,
    `planDate` DATETIME(3) NOT NULL,
    `meetingNumber` INTEGER NULL,
    `topic` VARCHAR(191) NOT NULL,
    `learningObjectives` TEXT NOT NULL,
    `materials` TEXT NOT NULL,
    `difficulty` VARCHAR(32) NOT NULL,
    `activities` TEXT NOT NULL,
    `assessment` TEXT NOT NULL,
    `durationMinutes` INTEGER NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`),
    INDEX `Rpp_kelasId_status_planDate_idx`(`kelasId`, `status`, `planDate`),
    INDEX `Rpp_createdById_createdAt_idx`(`createdById`, `createdAt`),
    CONSTRAINT `Rpp_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `Rpp_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `FileAsset`
    MODIFY `ownerType` ENUM('PENDAFTARAN', 'MATERI', 'USER', 'SISWA', 'RPP') NOT NULL,
    ADD COLUMN `rppId` VARCHAR(191) NULL,
    ADD INDEX `FileAsset_rppId_idx`(`rppId`),
    ADD CONSTRAINT `FileAsset_rppId_fkey` FOREIGN KEY (`rppId`) REFERENCES `Rpp`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
