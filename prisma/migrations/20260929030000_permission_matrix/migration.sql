-- Override matriks hak akses per-role dan per-user.
CREATE TABLE `RolePermissionOverride` (
  `id` VARCHAR(191) NOT NULL,
  `role` ENUM('ADMIN', 'GURU', 'WALI', 'SISWA') NOT NULL,
  `permission` VARCHAR(191) NOT NULL,
  `effect` ENUM('GRANT', 'DENY') NOT NULL,
  `createdById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `RolePermissionOverride_role_permission_key`(`role`, `permission`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `UserPermissionOverride` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `permission` VARCHAR(191) NOT NULL,
  `effect` ENUM('GRANT', 'DENY') NOT NULL,
  `createdById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `UserPermissionOverride_userId_permission_key`(`userId`, `permission`),
  INDEX `UserPermissionOverride_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `UserPermissionOverride` ADD CONSTRAINT `UserPermissionOverride_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
