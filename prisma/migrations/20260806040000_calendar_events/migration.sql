CREATE TABLE `CalendarEvent` (
    `id` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `eventType` ENUM('CLASS_SESSION', 'MODULE_RELEASE', 'ASSIGNMENT_DUE', 'QUIZ_DUE', 'EXAM', 'REMEDIAL_DUE', 'HOLIDAY', 'ANNOUNCEMENT') NOT NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NULL,
    `allDay` BOOLEAN NOT NULL DEFAULT false,
    `visibility` ENUM('ALL', 'GURU', 'SISWA', 'WALI') NOT NULL DEFAULT 'ALL',
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CalendarEvent_classId_startAt_eventType_idx`(`classId`, `startAt`, `eventType`),
    INDEX `CalendarEvent_visibility_startAt_idx`(`visibility`, `startAt`),
    INDEX `CalendarEvent_createdById_createdAt_idx`(`createdById`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `CalendarEvent_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `Kelas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `CalendarEvent_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
