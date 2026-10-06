-- Formulir publik tanpa kelas (paritas Google Forms): Ujian.kelasId opsional,
-- kelas terhapus membebaskan referensi alih-alih memblokir.

ALTER TABLE `Ujian` DROP FOREIGN KEY `Ujian_kelasId_fkey`;

ALTER TABLE `Ujian` MODIFY COLUMN `kelasId` VARCHAR(191) NULL;

ALTER TABLE `Ujian` ADD CONSTRAINT `Ujian_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
