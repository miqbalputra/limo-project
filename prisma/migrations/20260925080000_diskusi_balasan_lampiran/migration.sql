-- Lampiran pada balasan diskusi (penyimpanan privat ber-scope kelas).
ALTER TABLE `FileAsset` ADD COLUMN `diskusiBalasanId` VARCHAR(191) NULL;
CREATE INDEX `FileAsset_diskusiBalasanId_idx` ON `FileAsset`(`diskusiBalasanId`);
ALTER TABLE `FileAsset` ADD CONSTRAINT `FileAsset_diskusiBalasanId_fkey` FOREIGN KEY (`diskusiBalasanId`) REFERENCES `DiskusiBalasan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
