-- Alur pendaftaran v2: data peserta, jawaban formulir program, dan persetujuan
ALTER TABLE `Pendaftaran`
  ADD COLUMN `participantType` VARCHAR(8) NOT NULL DEFAULT 'CHILD',
  ADD COLUMN `studentNickname` VARCHAR(120) NULL,
  ADD COLUMN `studentGender` VARCHAR(16) NULL,
  ADD COLUMN `address` TEXT NULL,
  ADD COLUMN `schoolName` VARCHAR(191) NULL,
  ADD COLUMN `gradeLevel` VARCHAR(64) NULL,
  ADD COLUMN `programAnswers` JSON NULL,
  ADD COLUMN `consentDataTruth` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `consentDataUse` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `consentContact` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `documentationConsent` VARCHAR(16) NULL,
  ADD COLUMN `consentAt` DATETIME(3) NULL;

ALTER TABLE `Pendaftaran`
  MODIFY `waliEmail` VARCHAR(191) NULL;

CREATE INDEX `Pendaftaran_waliPhone_idx` ON `Pendaftaran`(`waliPhone`);
