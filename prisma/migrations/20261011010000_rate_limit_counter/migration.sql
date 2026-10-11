-- Tabel counter rate limit terpusat: throttle login/reset/pendaftaran tetap
-- efektif meski aplikasi berjalan lebih dari satu instance (sebelumnya in-memory).

-- CreateTable
CREATE TABLE `RateLimitCounter` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `windowStart` DATETIME(3) NOT NULL,
    `count` INTEGER NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RateLimitCounter_key_windowStart_key`(`key`, `windowStart`),
    INDEX `RateLimitCounter_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
