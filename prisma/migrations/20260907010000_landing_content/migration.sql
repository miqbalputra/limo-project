ALTER TABLE `Program`
  ADD COLUMN `registrationAvailability` ENUM('OPEN', 'LIMITED_SLOTS', 'FULL', 'COMING_SOON') NOT NULL DEFAULT 'OPEN',
  ADD COLUMN `registrationNote` TEXT NULL;

ALTER TABLE `Program`
  MODIFY `kind` ENUM('ENGLISH', 'ARABIC', 'ARABIC_KIDS', 'NAHWU', 'MATH_ACADEMIC_SUPPORT') NOT NULL;

ALTER TABLE `Pendaftaran`
  ADD COLUMN `isWaitingList` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `Pendaftaran_programId_isWaitingList_createdAt_idx`
  ON `Pendaftaran`(`programId`, `isWaitingList`, `createdAt`);

CREATE TABLE `HeroSlide` (
  `id` VARCHAR(191) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `desktopImagePath` TEXT NOT NULL,
  `mobileImagePath` TEXT NOT NULL,
  `desktopImageMimeType` VARCHAR(100) NOT NULL,
  `mobileImageMimeType` VARCHAR(100) NOT NULL,
  `eyebrow` VARCHAR(160) NULL,
  `title` VARCHAR(240) NOT NULL,
  `description` TEXT NULL,
  `ctaLabel` VARCHAR(120) NULL,
  `ctaHref` VARCHAR(500) NULL,
  `altText` VARCHAR(255) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `HeroSlide_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
