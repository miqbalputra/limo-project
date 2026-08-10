CREATE TABLE `RemedialAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('ASSIGNMENT', 'QUIZ', 'EXAM', 'COMPETENCY') NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `kelasId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `instructions` TEXT NOT NULL,
    `availableFrom` DATETIME(3) NULL,
    `dueAt` DATETIME(3) NOT NULL,
    `scorePolicy` ENUM('LATEST', 'HIGHEST', 'AVERAGE', 'CAPPED') NOT NULL DEFAULT 'LATEST',
    `scoreCap` DECIMAL(7, 2) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `idempotencyKey` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RemedialAssignment_kelasId_status_dueAt_idx`(`kelasId`, `status`, `dueAt`),
    INDEX `RemedialAssignment_sourceType_sourceId_status_idx`(`sourceType`, `sourceId`, `status`),
    INDEX `RemedialAssignment_createdById_createdAt_idx`(`createdById`, `createdAt`),
    UNIQUE INDEX `RemedialAssignment_idempotencyKey_key`(`idempotencyKey`),
    PRIMARY KEY (`id`),
    CONSTRAINT `RemedialAssignment_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `RemedialAssignment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RemedialParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `remedialId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'ASSIGNED',
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `originalSubmissionId` VARCHAR(191) NULL,
    `originalScore` DECIMAL(10, 2) NULL,
    `remedialScore` DECIMAL(10, 2) NULL,
    `effectiveScore` DECIMAL(10, 2) NULL,
    `resultPublishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RemedialParticipant_remedialId_studentId_key`(`remedialId`, `studentId`),
    INDEX `RemedialParticipant_studentId_status_updatedAt_idx`(`studentId`, `status`, `updatedAt`),
    INDEX `RemedialParticipant_remedialId_status_idx`(`remedialId`, `status`),
    INDEX `RemedialParticipant_originalSubmissionId_idx`(`originalSubmissionId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `RemedialParticipant_remedialId_fkey` FOREIGN KEY (`remedialId`) REFERENCES `RemedialAssignment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `RemedialParticipant_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Siswa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AssignmentRevisionRequest` (
    `id` VARCHAR(191) NOT NULL,
    `assignmentId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `sourceSubmissionId` VARCHAR(191) NOT NULL,
    `requestedById` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL,
    `instructions` TEXT NULL,
    `dueAt` DATETIME(3) NULL,
    `status` ENUM('OPEN', 'SUBMITTED', 'COMPLETED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'OPEN',
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `submittedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AssignmentRevisionRequest_assignmentId_studentId_status_idx`(`assignmentId`, `studentId`, `status`),
    INDEX `AssignmentRevisionRequest_sourceSubmissionId_status_idx`(`sourceSubmissionId`, `status`),
    INDEX `AssignmentRevisionRequest_requestedById_createdAt_idx`(`requestedById`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `AssignmentRevisionRequest_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `Assignment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `AssignmentRevisionRequest_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Siswa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `AssignmentRevisionRequest_sourceSubmissionId_fkey` FOREIGN KEY (`sourceSubmissionId`) REFERENCES `AssignmentSubmission`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `AssignmentRevisionRequest_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AssignmentSubmission`
    ADD COLUMN `remedialParticipantId` VARCHAR(191) NULL,
    ADD COLUMN `revisionRequestId` VARCHAR(191) NULL,
    ADD COLUMN `openRevisionKey` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `AssignmentSubmission_revisionRequestId_key` ON `AssignmentSubmission`(`revisionRequestId`);
CREATE UNIQUE INDEX `AssignmentSubmission_openRevisionKey_key` ON `AssignmentSubmission`(`openRevisionKey`);
CREATE INDEX `AssignmentSubmission_remedialParticipantId_idx` ON `AssignmentSubmission`(`remedialParticipantId`);
CREATE INDEX `AssignmentSubmission_revisionRequestId_idx` ON `AssignmentSubmission`(`revisionRequestId`);

ALTER TABLE `AssignmentSubmission`
    ADD CONSTRAINT `AssignmentSubmission_remedialParticipantId_fkey` FOREIGN KEY (`remedialParticipantId`) REFERENCES `RemedialParticipant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `AssignmentSubmission_revisionRequestId_fkey` FOREIGN KEY (`revisionRequestId`) REFERENCES `AssignmentRevisionRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `RemedialParticipant`
    ADD CONSTRAINT `RemedialParticipant_originalSubmissionId_fkey` FOREIGN KEY (`originalSubmissionId`) REFERENCES `AssignmentSubmission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
