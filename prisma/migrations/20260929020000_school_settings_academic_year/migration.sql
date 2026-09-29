-- Identitas sekolah (singleton) dan tahun ajaran aktif.
CREATE TABLE `SchoolSetting` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL DEFAULT 'LIMO - Little Moslems Academy',
  `tagline` VARCHAR(191) NULL,
  `address` TEXT NULL,
  `phone` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `website` VARCHAR(191) NULL,
  `logoFileId` VARCHAR(191) NULL,
  `updatedById` VARCHAR(191) NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AcademicYear` (
  `id` VARCHAR(191) NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `semester` ENUM('GANJIL', 'GENAP') NOT NULL DEFAULT 'GANJIL',
  `startDate` DATETIME(3) NOT NULL,
  `endDate` DATETIME(3) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `AcademicYear_label_key`(`label`),
  INDEX `AcademicYear_isActive_idx`(`isActive`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
