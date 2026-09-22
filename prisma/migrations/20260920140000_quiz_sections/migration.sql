-- Section (blok halaman) + branching per soal untuk Form Builder kuis
CREATE TABLE `UjianSection` (
    `id` VARCHAR(191) NOT NULL,
    `ujianId` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UjianSection_ujianId_order_idx`(`ujianId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `UjianSection` ADD CONSTRAINT `UjianSection_ujianId_fkey` FOREIGN KEY (`ujianId`) REFERENCES `Ujian`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `UjianSoal`
  ADD COLUMN `sectionId` VARCHAR(191) NULL,
  ADD COLUMN `branchRules` JSON NULL;

CREATE INDEX `UjianSoal_sectionId_idx` ON `UjianSoal`(`sectionId`);

ALTER TABLE `UjianSoal` ADD CONSTRAINT `UjianSoal_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `UjianSection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
