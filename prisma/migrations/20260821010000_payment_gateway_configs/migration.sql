CREATE TABLE `PaymentGatewayConfig` (
    `id` VARCHAR(191) NOT NULL,
    `provider` ENUM('MAYAR', 'PAKASIR') NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `environment` VARCHAR(32) NOT NULL DEFAULT 'sandbox',
    `publicConfig` JSON NULL,
    `encryptedCredentials` TEXT NULL,
    `lastTestedAt` DATETIME(3) NULL,
    `lastTestStatus` VARCHAR(32) NULL,
    `lastTestMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PaymentGatewayConfig_provider_key`(`provider`),
    INDEX `PaymentGatewayConfig_enabled_isPrimary_idx`(`enabled`, `isPrimary`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
