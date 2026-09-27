-- Tarif khusus per siswa (prioritas di atas tarif kelas dan program).
ALTER TABLE `Tarif` ADD COLUMN `siswaId` VARCHAR(191) NULL;
CREATE INDEX `Tarif_siswaId_effectiveFrom_idx` ON `Tarif`(`siswaId`, `effectiveFrom`);
ALTER TABLE `Tarif` ADD CONSTRAINT `Tarif_siswaId_fkey` FOREIGN KEY (`siswaId`) REFERENCES `Siswa`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
