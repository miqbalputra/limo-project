-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'GURU', 'WALI') NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `userAgent` VARCHAR(255) NULL,
    `ipAddress` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokedById` VARCHAR(191) NULL,

    UNIQUE INDEX `Session_tokenHash_key`(`tokenHash`),
    INDEX `Session_userId_expiresAt_idx`(`userId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PasswordResetToken_tokenHash_key`(`tokenHash`),
    INDEX `PasswordResetToken_userId_expiresAt_idx`(`userId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuruProfile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GuruProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WaliProfile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WaliProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `metadata` JSON NULL,
    `ipAddress` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditLog_actorId_createdAt_idx`(`actorId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Program` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` ENUM('ENGLISH', 'ARABIC') NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Program_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Level` (
    `id` VARCHAR(191) NOT NULL,
    `programId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Level_programId_name_key`(`programId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pendaftaran` (
    `id` VARCHAR(191) NOT NULL,
    `kode` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `programId` VARCHAR(191) NOT NULL,
    `studentName` VARCHAR(191) NOT NULL,
    `studentBirthAt` DATETIME(3) NULL,
    `waliName` VARCHAR(191) NOT NULL,
    `waliEmail` VARCHAR(191) NOT NULL,
    `waliPhone` VARCHAR(191) NULL,
    `waliProfileId` VARCHAR(191) NULL,
    `submittedAt` DATETIME(3) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `rejectionReason` TEXT NULL,
    `approvedSiswaId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Pendaftaran_kode_key`(`kode`),
    UNIQUE INDEX `Pendaftaran_approvedSiswaId_key`(`approvedSiswaId`),
    INDEX `Pendaftaran_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `Pendaftaran_waliEmail_idx`(`waliEmail`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RiwayatStatusPendaftaran` (
    `id` VARCHAR(191) NOT NULL,
    `pendaftaranId` VARCHAR(191) NOT NULL,
    `fromStatus` ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED') NULL,
    `toStatus` ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RiwayatStatusPendaftaran_pendaftaranId_createdAt_idx`(`pendaftaranId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Siswa` (
    `id` VARCHAR(191) NOT NULL,
    `nomorInduk` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `birthAt` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'GRADUATED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `programId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Siswa_nomorInduk_key`(`nomorInduk`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WaliSiswa` (
    `id` VARCHAR(191) NOT NULL,
    `waliProfileId` VARCHAR(191) NOT NULL,
    `siswaId` VARCHAR(191) NOT NULL,
    `relationship` VARCHAR(191) NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,

    INDEX `WaliSiswa_siswaId_idx`(`siswaId`),
    UNIQUE INDEX `WaliSiswa_waliProfileId_siswaId_key`(`waliProfileId`, `siswaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Kelas` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `programId` VARCHAR(191) NOT NULL,
    `levelId` VARCHAR(191) NOT NULL,
    `guruProfileId` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `scheduleNote` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Kelas_guruProfileId_idx`(`guruProfileId`),
    UNIQUE INDEX `Kelas_programId_levelId_name_key`(`programId`, `levelId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KelasSiswa` (
    `id` VARCHAR(191) NOT NULL,
    `kelasId` VARCHAR(191) NOT NULL,
    `siswaId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'TRANSFERRED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KelasSiswa_siswaId_status_idx`(`siswaId`, `status`),
    INDEX `KelasSiswa_kelasId_status_idx`(`kelasId`, `status`),
    UNIQUE INDEX `KelasSiswa_kelasId_siswaId_startDate_key`(`kelasId`, `siswaId`, `startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SesiKelas` (
    `id` VARCHAR(191) NOT NULL,
    `kelasId` VARCHAR(191) NOT NULL,
    `meetingNumber` INTEGER NOT NULL,
    `topic` VARCHAR(191) NOT NULL,
    `sessionDate` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'FINAL', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SesiKelas_kelasId_sessionDate_idx`(`kelasId`, `sessionDate`),
    UNIQUE INDEX `SesiKelas_kelasId_meetingNumber_key`(`kelasId`, `meetingNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FileAsset` (
    `id` VARCHAR(191) NOT NULL,
    `ownerType` ENUM('PENDAFTARAN', 'MATERI', 'USER', 'SISWA') NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `pendaftaranId` VARCHAR(191) NULL,
    `materiId` VARCHAR(191) NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `storedName` VARCHAR(191) NOT NULL,
    `storagePath` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` BIGINT NOT NULL,
    `checksumSha256` VARCHAR(191) NULL,
    `visibility` ENUM('PRIVATE', 'INTERNAL') NOT NULL DEFAULT 'PRIVATE',
    `uploadedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `FileAsset_storedName_key`(`storedName`),
    INDEX `FileAsset_ownerType_ownerId_idx`(`ownerType`, `ownerId`),
    INDEX `FileAsset_pendaftaranId_idx`(`pendaftaranId`),
    INDEX `FileAsset_materiId_idx`(`materiId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Materi` (
    `id` VARCHAR(191) NOT NULL,
    `kelasId` VARCHAR(191) NOT NULL,
    `sesiKelasId` VARCHAR(191) NULL,
    `type` ENUM('TEXT', 'PDF', 'IMAGE', 'VIDEO_LINK') NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NULL,
    `videoUrl` VARCHAR(191) NULL,
    `language` VARCHAR(16) NULL,
    `direction` VARCHAR(8) NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Materi_kelasId_status_idx`(`kelasId`, `status`),
    INDEX `Materi_sesiKelasId_idx`(`sesiKelasId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Presensi` (
    `id` VARCHAR(191) NOT NULL,
    `sesiKelasId` VARCHAR(191) NOT NULL,
    `siswaId` VARCHAR(191) NOT NULL,
    `status` ENUM('HADIR', 'IZIN', 'SAKIT', 'ALPA', 'TERLAMBAT') NOT NULL,
    `note` TEXT NULL,
    `finalizedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Presensi_sesiKelasId_status_idx`(`sesiKelasId`, `status`),
    UNIQUE INDEX `Presensi_siswaId_sesiKelasId_key`(`siswaId`, `sesiKelasId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProgresBelajar` (
    `id` VARCHAR(191) NOT NULL,
    `sesiKelasId` VARCHAR(191) NOT NULL,
    `siswaId` VARCHAR(191) NOT NULL,
    `category` VARCHAR(64) NULL,
    `understandingScore` INTEGER NOT NULL,
    `publicNote` TEXT NULL,
    `internalNote` TEXT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProgresBelajar_sesiKelasId_idx`(`sesiKelasId`),
    UNIQUE INDEX `ProgresBelajar_siswaId_sesiKelasId_category_key`(`siswaId`, `sesiKelasId`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BankSoal` (
    `id` VARCHAR(191) NOT NULL,
    `kelasId` VARCHAR(191) NULL,
    `type` ENUM('PILIHAN_GANDA', 'ESAI') NOT NULL,
    `question` TEXT NOT NULL,
    `language` VARCHAR(16) NULL,
    `direction` VARCHAR(8) NULL,
    `explanation` TEXT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BankSoal_kelasId_type_idx`(`kelasId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OpsiSoal` (
    `id` VARCHAR(191) NOT NULL,
    `bankSoalId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(8) NOT NULL,
    `content` TEXT NOT NULL,
    `isCorrect` BOOLEAN NOT NULL DEFAULT false,
    `order` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `OpsiSoal_bankSoalId_label_key`(`bankSoalId`, `label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ujian` (
    `id` VARCHAR(191) NOT NULL,
    `kelasId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `examDate` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Ujian_kelasId_status_idx`(`kelasId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UjianSoal` (
    `id` VARCHAR(191) NOT NULL,
    `ujianId` VARCHAR(191) NOT NULL,
    `bankSoalId` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `weight` DECIMAL(10, 2) NOT NULL,

    INDEX `UjianSoal_bankSoalId_idx`(`bankSoalId`),
    UNIQUE INDEX `UjianSoal_ujianId_bankSoalId_key`(`ujianId`, `bankSoalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HasilUjian` (
    `id` VARCHAR(191) NOT NULL,
    `ujianId` VARCHAR(191) NOT NULL,
    `siswaId` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'NEEDS_REVIEW', 'FINAL', 'CORRECTED') NOT NULL DEFAULT 'DRAFT',
    `totalScore` DECIMAL(10, 2) NULL,
    `finalizedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HasilUjian_siswaId_status_idx`(`siswaId`, `status`),
    UNIQUE INDEX `HasilUjian_ujianId_siswaId_key`(`ujianId`, `siswaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JawabanUjian` (
    `id` VARCHAR(191) NOT NULL,
    `hasilUjianId` VARCHAR(191) NOT NULL,
    `ujianSoalId` VARCHAR(191) NOT NULL,
    `bankSoalId` VARCHAR(191) NOT NULL,
    `selectedOption` VARCHAR(8) NULL,
    `essayAnswer` TEXT NULL,
    `score` DECIMAL(10, 2) NULL,
    `needsReview` BOOLEAN NOT NULL DEFAULT false,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,

    INDEX `JawabanUjian_bankSoalId_idx`(`bankSoalId`),
    UNIQUE INDEX `JawabanUjian_hasilUjianId_ujianSoalId_key`(`hasilUjianId`, `ujianSoalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tarif` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `programId` VARCHAR(191) NULL,
    `kelasId` VARCHAR(191) NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Tarif_programId_effectiveFrom_idx`(`programId`, `effectiveFrom`),
    INDEX `Tarif_kelasId_effectiveFrom_idx`(`kelasId`, `effectiveFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tagihan` (
    `id` VARCHAR(191) NOT NULL,
    `siswaId` VARCHAR(191) NOT NULL,
    `tarifId` VARCHAR(191) NULL,
    `periode` DATETIME(3) NOT NULL,
    `jenis` VARCHAR(64) NOT NULL,
    `description` VARCHAR(191) NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `status` ENUM('DRAFT', 'UNPAID', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'DRAFT',
    `dueDate` DATETIME(3) NOT NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Tagihan_status_dueDate_idx`(`status`, `dueDate`),
    UNIQUE INDEX `Tagihan_siswaId_periode_jenis_key`(`siswaId`, `periode`, `jenis`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pembayaran` (
    `id` VARCHAR(191) NOT NULL,
    `tagihanId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerReference` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED') NOT NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `rawPayload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Pembayaran_providerReference_key`(`providerReference`),
    INDEX `Pembayaran_tagihanId_status_idx`(`tagihanId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookEvent` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerEventId` VARCHAR(191) NOT NULL,
    `payloadHash` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `processedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WebhookEvent_payloadHash_key`(`payloadHash`),
    INDEX `WebhookEvent_provider_createdAt_idx`(`provider`, `createdAt`),
    UNIQUE INDEX `WebhookEvent_provider_providerEventId_key`(`provider`, `providerEventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notifikasi` (
    `id` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `template` VARCHAR(191) NOT NULL,
    `recipient` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationDelivery` (
    `id` VARCHAR(191) NOT NULL,
    `notificationId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `attempt` INTEGER NOT NULL DEFAULT 0,
    `response` JSON NULL,
    `errorMessage` TEXT NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `NotificationDelivery_notificationId_status_idx`(`notificationId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JobRun` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'RUNNING',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `successCount` INTEGER NOT NULL DEFAULT 0,
    `skippedCount` INTEGER NOT NULL DEFAULT 0,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `metadata` JSON NULL,
    `errorMessage` TEXT NULL,

    INDEX `JobRun_name_startedAt_idx`(`name`, `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuruProfile` ADD CONSTRAINT `GuruProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WaliProfile` ADD CONSTRAINT `WaliProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Level` ADD CONSTRAINT `Level_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `Program`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pendaftaran` ADD CONSTRAINT `Pendaftaran_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `Program`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pendaftaran` ADD CONSTRAINT `Pendaftaran_waliProfileId_fkey` FOREIGN KEY (`waliProfileId`) REFERENCES `WaliProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pendaftaran` ADD CONSTRAINT `Pendaftaran_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pendaftaran` ADD CONSTRAINT `Pendaftaran_approvedSiswaId_fkey` FOREIGN KEY (`approvedSiswaId`) REFERENCES `Siswa`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RiwayatStatusPendaftaran` ADD CONSTRAINT `RiwayatStatusPendaftaran_pendaftaranId_fkey` FOREIGN KEY (`pendaftaranId`) REFERENCES `Pendaftaran`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Siswa` ADD CONSTRAINT `Siswa_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `Program`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WaliSiswa` ADD CONSTRAINT `WaliSiswa_waliProfileId_fkey` FOREIGN KEY (`waliProfileId`) REFERENCES `WaliProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WaliSiswa` ADD CONSTRAINT `WaliSiswa_siswaId_fkey` FOREIGN KEY (`siswaId`) REFERENCES `Siswa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Kelas` ADD CONSTRAINT `Kelas_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `Program`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Kelas` ADD CONSTRAINT `Kelas_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `Level`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Kelas` ADD CONSTRAINT `Kelas_guruProfileId_fkey` FOREIGN KEY (`guruProfileId`) REFERENCES `GuruProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KelasSiswa` ADD CONSTRAINT `KelasSiswa_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KelasSiswa` ADD CONSTRAINT `KelasSiswa_siswaId_fkey` FOREIGN KEY (`siswaId`) REFERENCES `Siswa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SesiKelas` ADD CONSTRAINT `SesiKelas_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileAsset` ADD CONSTRAINT `FileAsset_pendaftaranId_fkey` FOREIGN KEY (`pendaftaranId`) REFERENCES `Pendaftaran`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileAsset` ADD CONSTRAINT `FileAsset_materiId_fkey` FOREIGN KEY (`materiId`) REFERENCES `Materi`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Materi` ADD CONSTRAINT `Materi_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Materi` ADD CONSTRAINT `Materi_sesiKelasId_fkey` FOREIGN KEY (`sesiKelasId`) REFERENCES `SesiKelas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Presensi` ADD CONSTRAINT `Presensi_sesiKelasId_fkey` FOREIGN KEY (`sesiKelasId`) REFERENCES `SesiKelas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Presensi` ADD CONSTRAINT `Presensi_siswaId_fkey` FOREIGN KEY (`siswaId`) REFERENCES `Siswa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgresBelajar` ADD CONSTRAINT `ProgresBelajar_sesiKelasId_fkey` FOREIGN KEY (`sesiKelasId`) REFERENCES `SesiKelas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgresBelajar` ADD CONSTRAINT `ProgresBelajar_siswaId_fkey` FOREIGN KEY (`siswaId`) REFERENCES `Siswa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BankSoal` ADD CONSTRAINT `BankSoal_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OpsiSoal` ADD CONSTRAINT `OpsiSoal_bankSoalId_fkey` FOREIGN KEY (`bankSoalId`) REFERENCES `BankSoal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ujian` ADD CONSTRAINT `Ujian_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UjianSoal` ADD CONSTRAINT `UjianSoal_ujianId_fkey` FOREIGN KEY (`ujianId`) REFERENCES `Ujian`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UjianSoal` ADD CONSTRAINT `UjianSoal_bankSoalId_fkey` FOREIGN KEY (`bankSoalId`) REFERENCES `BankSoal`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HasilUjian` ADD CONSTRAINT `HasilUjian_ujianId_fkey` FOREIGN KEY (`ujianId`) REFERENCES `Ujian`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HasilUjian` ADD CONSTRAINT `HasilUjian_siswaId_fkey` FOREIGN KEY (`siswaId`) REFERENCES `Siswa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JawabanUjian` ADD CONSTRAINT `JawabanUjian_hasilUjianId_fkey` FOREIGN KEY (`hasilUjianId`) REFERENCES `HasilUjian`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JawabanUjian` ADD CONSTRAINT `JawabanUjian_ujianSoalId_fkey` FOREIGN KEY (`ujianSoalId`) REFERENCES `UjianSoal`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JawabanUjian` ADD CONSTRAINT `JawabanUjian_bankSoalId_fkey` FOREIGN KEY (`bankSoalId`) REFERENCES `BankSoal`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tarif` ADD CONSTRAINT `Tarif_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `Program`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tarif` ADD CONSTRAINT `Tarif_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tagihan` ADD CONSTRAINT `Tagihan_siswaId_fkey` FOREIGN KEY (`siswaId`) REFERENCES `Siswa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tagihan` ADD CONSTRAINT `Tagihan_tarifId_fkey` FOREIGN KEY (`tarifId`) REFERENCES `Tarif`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pembayaran` ADD CONSTRAINT `Pembayaran_tagihanId_fkey` FOREIGN KEY (`tagihanId`) REFERENCES `Tagihan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationDelivery` ADD CONSTRAINT `NotificationDelivery_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `Notifikasi`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

