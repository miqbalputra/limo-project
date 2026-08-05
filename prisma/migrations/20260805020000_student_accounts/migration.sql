ALTER TABLE `User`
    MODIFY `role` ENUM('ADMIN', 'GURU', 'WALI', 'SISWA') NOT NULL;

CREATE TABLE `SiswaAccount` (
    `id` VARCHAR(191) NOT NULL,
    `siswaId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `loginIdentifier` VARCHAR(191) NOT NULL,
    `contactEmail` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'PENDING',
    `activatedAt` DATETIME(3) NULL,
    `activatedById` VARCHAR(191) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SiswaAccount_siswaId_key`(`siswaId`),
    UNIQUE INDEX `SiswaAccount_userId_key`(`userId`),
    UNIQUE INDEX `SiswaAccount_loginIdentifier_key`(`loginIdentifier`),
    INDEX `SiswaAccount_status_idx`(`status`),
    PRIMARY KEY (`id`),
    CONSTRAINT `SiswaAccount_siswaId_fkey` FOREIGN KEY (`siswaId`) REFERENCES `Siswa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `SiswaAccount_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `SiswaAccount_activatedById_fkey` FOREIGN KEY (`activatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
