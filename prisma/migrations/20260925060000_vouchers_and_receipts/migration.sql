-- Voucher/diskon: tabel Voucher + kolom diskon pada Tagihan (untuk kuitansi & diskon).
CREATE TABLE `Voucher` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(32) NOT NULL,
  `description` VARCHAR(191) NULL,
  `discountType` ENUM('PERCENT','FIXED') NOT NULL,
  `discountValue` DECIMAL(14, 2) NOT NULL,
  `minAmount` DECIMAL(14, 2) NULL,
  `maxUses` INTEGER NULL,
  `usedCount` INTEGER NOT NULL DEFAULT 0,
  `validFrom` DATETIME(3) NULL,
  `validUntil` DATETIME(3) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Voucher_code_key`(`code`),
  INDEX `Voucher_isActive_validUntil_idx`(`isActive`,`validUntil`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Tagihan` ADD COLUMN `subtotal` DECIMAL(14, 2) NULL;
ALTER TABLE `Tagihan` ADD COLUMN `discountAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0;
ALTER TABLE `Tagihan` ADD COLUMN `voucherId` VARCHAR(191) NULL;
CREATE INDEX `Tagihan_voucherId_idx` ON `Tagihan`(`voucherId`);
ALTER TABLE `Tagihan` ADD CONSTRAINT `Tagihan_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `Voucher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
