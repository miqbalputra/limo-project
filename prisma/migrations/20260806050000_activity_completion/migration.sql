ALTER TABLE `ModuleItem`
    ADD COLUMN `archivedAt` DATETIME(3) NULL,
    ADD COLUMN `archivedById` VARCHAR(191) NULL;

CREATE INDEX `ModuleItem_archivedAt_idx` ON `ModuleItem`(`archivedAt`);

ALTER TABLE `ModuleItem`
    ADD CONSTRAINT `ModuleItem_archivedById_fkey` FOREIGN KEY (`archivedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `CompletionRule` (
    `id` VARCHAR(191) NOT NULL,
    `moduleItemId` VARCHAR(191) NOT NULL,
    `ruleType` ENUM('VIEWED', 'SUBMITTED', 'GRADED', 'PASSED', 'MANUAL') NOT NULL,
    `minimumScore` DECIMAL(5, 2) NULL,
    `requiredDurationSeconds` INTEGER NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CompletionRule_moduleItemId_ruleType_key`(`moduleItemId`, `ruleType`),
    INDEX `CompletionRule_ruleType_isRequired_idx`(`ruleType`, `isRequired`),
    PRIMARY KEY (`id`),
    CONSTRAINT `CompletionRule_moduleItemId_fkey` FOREIGN KEY (`moduleItemId`) REFERENCES `ModuleItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StudentActivityCompletion` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `moduleItemId` VARCHAR(191) NOT NULL,
    `status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'NOT_STARTED',
    `completedAt` DATETIME(3) NULL,
    `completionSource` VARCHAR(64) NULL,
    `completedByUserId` VARCHAR(191) NULL,
    `evidenceEntityId` VARCHAR(191) NULL,
    `lastEvaluatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StudentActivityCompletion_studentId_moduleItemId_key`(`studentId`, `moduleItemId`),
    INDEX `StudentActivityCompletion_studentId_status_updatedAt_idx`(`studentId`, `status`, `updatedAt`),
    INDEX `StudentActivityCompletion_moduleItemId_status_idx`(`moduleItemId`, `status`),
    PRIMARY KEY (`id`),
    CONSTRAINT `StudentActivityCompletion_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Siswa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `StudentActivityCompletion_moduleItemId_fkey` FOREIGN KEY (`moduleItemId`) REFERENCES `ModuleItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `StudentActivityCompletion_completedByUserId_fkey` FOREIGN KEY (`completedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StudentModuleProgress` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `moduleId` VARCHAR(191) NOT NULL,
    `requiredItemCount` INTEGER NOT NULL DEFAULT 0,
    `completedRequiredItemCount` INTEGER NOT NULL DEFAULT 0,
    `progressPercentage` DECIMAL(5, 2) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `calculatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StudentModuleProgress_studentId_moduleId_key`(`studentId`, `moduleId`),
    INDEX `StudentModuleProgress_studentId_progressPercentage_idx`(`studentId`, `progressPercentage`),
    INDEX `StudentModuleProgress_moduleId_progressPercentage_idx`(`moduleId`, `progressPercentage`),
    PRIMARY KEY (`id`),
    CONSTRAINT `StudentModuleProgress_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Siswa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `StudentModuleProgress_moduleId_fkey` FOREIGN KEY (`moduleId`) REFERENCES `LearningModule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
