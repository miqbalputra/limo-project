CREATE TABLE `Assignment` (
    `id` VARCHAR(191) NOT NULL,
    `kelasId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `instructions` TEXT NOT NULL,
    `submissionType` ENUM('ONLINE_TEXT', 'FILE', 'IMAGE', 'AUDIO', 'VIDEO', 'EXTERNAL_LINK', 'OFFLINE_ACTIVITY') NOT NULL,
    `maxScore` INTEGER NOT NULL DEFAULT 100,
    `availableFrom` DATETIME(3) NULL,
    `dueAt` DATETIME(3) NULL,
    `cutoffAt` DATETIME(3) NULL,
    `maxAttempts` INTEGER NOT NULL DEFAULT 1,
    `allowLateSubmission` BOOLEAN NOT NULL DEFAULT false,
    `allowResubmission` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `createdById` VARCHAR(191) NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Assignment_kelasId_status_availableFrom_idx`(`kelasId`, `status`, `availableFrom`),
    INDEX `Assignment_createdById_createdAt_idx`(`createdById`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `Assignment_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `Assignment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AssignmentSubmission` (
    `id` VARCHAR(191) NOT NULL,
    `assignmentId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `attemptNumber` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'LATE', 'NEEDS_REVISION', 'GRADED') NOT NULL DEFAULT 'DRAFT',
    `onlineText` TEXT NULL,
    `externalLink` TEXT NULL,
    `submittedAt` DATETIME(3) NULL,
    `isLate` BOOLEAN NOT NULL DEFAULT false,
    `actorUserId` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `draftSavedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AssignmentSubmission_assignmentId_studentId_attemptNumber_key`(`assignmentId`, `studentId`, `attemptNumber`),
    INDEX `AssignmentSubmission_assignmentId_status_idx`(`assignmentId`, `status`),
    INDEX `AssignmentSubmission_studentId_assignmentId_createdAt_idx`(`studentId`, `assignmentId`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `AssignmentSubmission_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `Assignment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `AssignmentSubmission_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Siswa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `AssignmentSubmission_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AssignmentSubmissionFile` (
    `id` VARCHAR(191) NOT NULL,
    `submissionId` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `storagePath` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` BIGINT NOT NULL,
    `checksum` VARCHAR(191) NULL,
    `mediaDuration` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AssignmentSubmissionFile_storageKey_key`(`storageKey`),
    INDEX `AssignmentSubmissionFile_submissionId_createdAt_idx`(`submissionId`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `AssignmentSubmissionFile_submissionId_fkey` FOREIGN KEY (`submissionId`) REFERENCES `AssignmentSubmission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
