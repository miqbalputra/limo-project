-- Sertifikat digital per siswa + kelas dengan kode verifikasi publik.
CREATE TABLE `Sertifikat` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(48) NOT NULL,
  `siswaId` VARCHAR(191) NOT NULL,
  `kelasId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `note` TEXT NULL,
  `issuedById` VARCHAR(191) NULL,
  `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `revokedAt` DATETIME(3) NULL,
  `revokedById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Sertifikat_code_key`(`code`),
  UNIQUE INDEX `Sertifikat_siswaId_kelasId_title_key`(`siswaId`, `kelasId`, `title`),
  INDEX `Sertifikat_siswaId_issuedAt_idx`(`siswaId`, `issuedAt`),
  INDEX `Sertifikat_kelasId_issuedAt_idx`(`kelasId`, `issuedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Sertifikat` ADD CONSTRAINT `Sertifikat_siswaId_fkey` FOREIGN KEY (`siswaId`) REFERENCES `Siswa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Sertifikat` ADD CONSTRAINT `Sertifikat_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Sertifikat` ADD CONSTRAINT `Sertifikat_issuedById_fkey` FOREIGN KEY (`issuedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
