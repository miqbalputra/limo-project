-- Cakupan voucher per program/kelas (opsional).
ALTER TABLE `Voucher` ADD COLUMN `programId` VARCHAR(191) NULL;
ALTER TABLE `Voucher` ADD COLUMN `kelasId` VARCHAR(191) NULL;
CREATE INDEX `Voucher_programId_idx` ON `Voucher`(`programId`);
CREATE INDEX `Voucher_kelasId_idx` ON `Voucher`(`kelasId`);
ALTER TABLE `Voucher` ADD CONSTRAINT `Voucher_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `Program`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Voucher` ADD CONSTRAINT `Voucher_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
