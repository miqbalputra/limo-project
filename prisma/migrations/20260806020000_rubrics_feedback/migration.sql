CREATE TABLE `RubricTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `ownerUserId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `scope` ENUM('PRIVATE', 'CLASS', 'INSTITUTION') NOT NULL DEFAULT 'PRIVATE',
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RubricTemplate_ownerUserId_status_createdAt_idx`(`ownerUserId`, `status`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `RubricTemplate_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RubricCriterion` (
    `id` VARCHAR(191) NOT NULL,
    `rubricId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `maxScore` INTEGER NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RubricCriterion_rubricId_order_idx`(`rubricId`, `order`),
    PRIMARY KEY (`id`),
    CONSTRAINT `RubricCriterion_rubricId_fkey` FOREIGN KEY (`rubricId`) REFERENCES `RubricTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RubricLevel` (
    `id` VARCHAR(191) NOT NULL,
    `criterionId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `score` INTEGER NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,

    INDEX `RubricLevel_criterionId_order_idx`(`criterionId`, `order`),
    PRIMARY KEY (`id`),
    CONSTRAINT `RubricLevel_criterionId_fkey` FOREIGN KEY (`criterionId`) REFERENCES `RubricCriterion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Assignment`
    ADD COLUMN `rubricTemplateId` VARCHAR(191) NULL,
    ADD COLUMN `rubricSnapshot` JSON NULL;

CREATE INDEX `Assignment_rubricTemplateId_idx` ON `Assignment`(`rubricTemplateId`);
ALTER TABLE `Assignment` ADD CONSTRAINT `Assignment_rubricTemplateId_fkey` FOREIGN KEY (`rubricTemplateId`) REFERENCES `RubricTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `SubmissionGrade` (
    `id` VARCHAR(191) NOT NULL,
    `submissionId` VARCHAR(191) NOT NULL,
    `graderUserId` VARCHAR(191) NOT NULL,
    `rawScore` INTEGER NULL,
    `score` INTEGER NULL,
    `feedbackText` TEXT NULL,
    `feedbackAudioStorageKey` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'REVISED') NOT NULL DEFAULT 'DRAFT',
    `correctionReason` TEXT NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SubmissionGrade_submissionId_status_createdAt_idx`(`submissionId`, `status`, `createdAt`),
    INDEX `SubmissionGrade_graderUserId_createdAt_idx`(`graderUserId`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `SubmissionGrade_submissionId_fkey` FOREIGN KEY (`submissionId`) REFERENCES `AssignmentSubmission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `SubmissionGrade_graderUserId_fkey` FOREIGN KEY (`graderUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CriterionGrade` (
    `id` VARCHAR(191) NOT NULL,
    `submissionGradeId` VARCHAR(191) NOT NULL,
    `criterionId` VARCHAR(191) NOT NULL,
    `rubricLevelId` VARCHAR(191) NULL,
    `score` INTEGER NOT NULL,
    `comment` TEXT NULL,

    UNIQUE INDEX `CriterionGrade_submissionGradeId_criterionId_key`(`submissionGradeId`, `criterionId`),
    INDEX `CriterionGrade_criterionId_idx`(`criterionId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `CriterionGrade_submissionGradeId_fkey` FOREIGN KEY (`submissionGradeId`) REFERENCES `SubmissionGrade`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `CriterionGrade_criterionId_fkey` FOREIGN KEY (`criterionId`) REFERENCES `RubricCriterion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `CriterionGrade_rubricLevelId_fkey` FOREIGN KEY (`rubricLevelId`) REFERENCES `RubricLevel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
