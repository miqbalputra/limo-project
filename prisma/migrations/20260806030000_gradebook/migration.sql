CREATE TABLE `GradeCategory` (
    `id` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `weight` DECIMAL(6, 2) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `dropLowestCount` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GradeCategory_classId_status_order_idx`(`classId`, `status`, `order`),
    INDEX `GradeCategory_createdById_createdAt_idx`(`createdById`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `GradeCategory_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `Kelas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `GradeCategory_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GradeItem` (
    `id` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('ASSIGNMENT', 'QUIZ', 'EXAM', 'MANUAL', 'ATTENDANCE', 'PROGRESS') NOT NULL,
    `sourceId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `maxScore` DECIMAL(10, 2) NOT NULL,
    `weightOverride` DECIMAL(6, 2) NULL,
    `isExtraCredit` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('DRAFT', 'PUBLISHED', 'LOCKED') NOT NULL DEFAULT 'DRAFT',
    `dueAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GradeItem_classId_sourceType_sourceId_key`(`classId`, `sourceType`, `sourceId`),
    INDEX `GradeItem_classId_status_dueAt_idx`(`classId`, `status`, `dueAt`),
    INDEX `GradeItem_categoryId_order_idx`(`categoryId`, `order`),
    INDEX `GradeItem_sourceType_sourceId_idx`(`sourceType`, `sourceId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `GradeItem_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `Kelas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `GradeItem_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `GradeCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `GradeItem_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GradeEntry` (
    `id` VARCHAR(191) NOT NULL,
    `gradeItemId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `rawScore` DECIMAL(10, 2) NULL,
    `normalizedScore` DECIMAL(7, 2) NULL,
    `status` ENUM('MISSING', 'SUBMITTED', 'GRADED', 'EXEMPT', 'REMEDIAL', 'FINAL') NOT NULL DEFAULT 'MISSING',
    `isLate` BOOLEAN NOT NULL DEFAULT false,
    `feedbackSummary` TEXT NULL,
    `sourceVersion` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GradeEntry_gradeItemId_studentId_key`(`gradeItemId`, `studentId`),
    INDEX `GradeEntry_studentId_status_updatedAt_idx`(`studentId`, `status`, `updatedAt`),
    INDEX `GradeEntry_gradeItemId_status_idx`(`gradeItemId`, `status`),
    PRIMARY KEY (`id`),
    CONSTRAINT `GradeEntry_gradeItemId_fkey` FOREIGN KEY (`gradeItemId`) REFERENCES `GradeItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `GradeEntry_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Siswa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FinalGrade` (
    `id` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `calculatedScore` DECIMAL(7, 2) NULL,
    `publishedScore` DECIMAL(7, 2) NULL,
    `letterGrade` VARCHAR(8) NULL,
    `completionStatus` ENUM('INCOMPLETE', 'COMPLETE') NOT NULL DEFAULT 'INCOMPLETE',
    `status` ENUM('DRAFT', 'PUBLISHED', 'LOCKED', 'CORRECTED') NOT NULL DEFAULT 'DRAFT',
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FinalGrade_classId_studentId_key`(`classId`, `studentId`),
    INDEX `FinalGrade_classId_status_updatedAt_idx`(`classId`, `status`, `updatedAt`),
    INDEX `FinalGrade_studentId_status_updatedAt_idx`(`studentId`, `status`, `updatedAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `FinalGrade_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `Kelas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `FinalGrade_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Siswa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
