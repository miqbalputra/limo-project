CREATE TABLE `LearningModule` (
    `id` VARCHAR(191) NOT NULL,
    `kelasId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `releaseAt` DATETIME(3) NULL,
    `dueAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LearningModule_kelasId_status_order_idx`(`kelasId`, `status`, `order`),
    INDEX `LearningModule_createdById_createdAt_idx`(`createdById`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `LearningModule_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `LearningModule_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ModuleItem` (
    `id` VARCHAR(191) NOT NULL,
    `moduleId` VARCHAR(191) NOT NULL,
    `itemType` ENUM('MATERIAL', 'ASSIGNMENT', 'QUIZ', 'EXAM', 'DISCUSSION', 'CLASS_SESSION') NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `titleOverride` VARCHAR(191) NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `availableFrom` DATETIME(3) NULL,
    `availableUntil` DATETIME(3) NULL,
    `prerequisiteItemId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ModuleItem_moduleId_itemType_entityId_key`(`moduleId`, `itemType`, `entityId`),
    INDEX `ModuleItem_moduleId_order_idx`(`moduleId`, `order`),
    INDEX `ModuleItem_prerequisiteItemId_idx`(`prerequisiteItemId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `ModuleItem_moduleId_fkey` FOREIGN KEY (`moduleId`) REFERENCES `LearningModule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `ModuleItem_prerequisiteItemId_fkey` FOREIGN KEY (`prerequisiteItemId`) REFERENCES `ModuleItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
