-- Kuis ala Google Forms: pengaturan kuis, share link, dan respons publik
ALTER TABLE `Ujian`
  ADD COLUMN `mode` VARCHAR(16) NOT NULL DEFAULT 'UJIAN',
  ADD COLUMN `shareToken` VARCHAR(64) NULL,
  ADD COLUMN `shuffleQuestions` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `shuffleOptions` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `passingScore` INTEGER NULL,
  ADD COLUMN `showScoreImmediately` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `showAnswersAfterSubmit` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `collectRespondentName` BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX `Ujian_shareToken_key` ON `Ujian`(`shareToken`);

CREATE TABLE `QuizResponse` (
    `id` VARCHAR(191) NOT NULL,
    `ujianId` VARCHAR(191) NOT NULL,
    `shareToken` VARCHAR(64) NOT NULL,
    `respondentName` VARCHAR(120) NOT NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'IN_PROGRESS',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `submittedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `draftAnswers` JSON NULL,
    `draftSavedAt` DATETIME(3) NULL,
    `finalAnswers` JSON NULL,
    `questionOrder` JSON NULL,
    `score` DECIMAL(8, 2) NULL,
    `maxScore` DECIMAL(8, 2) NULL,
    `passed` BOOLEAN NULL,
    `ipHash` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `QuizResponse_ujianId_status_idx`(`ujianId`, `status`),
    INDEX `QuizResponse_shareToken_createdAt_idx`(`shareToken`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `QuizResponse` ADD CONSTRAINT `QuizResponse_ujianId_fkey` FOREIGN KEY (`ujianId`) REFERENCES `Ujian`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
