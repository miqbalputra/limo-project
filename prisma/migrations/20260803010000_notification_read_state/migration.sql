ALTER TABLE `Notifikasi`
    ADD COLUMN `dedupeKey` VARCHAR(191) NULL,
    ADD COLUMN `readAt` DATETIME(3) NULL;

CREATE UNIQUE INDEX `Notifikasi_dedupeKey_key` ON `Notifikasi`(`dedupeKey`);
