-- Paritas ujian online dengan Google Forms: email responden, rilis nilai tertunda,
-- setelan presentasi, kunci alternatif, feedback kustom, dan konfigurasi unggah berkas.

ALTER TABLE `BankSoal`
  ADD COLUMN `acceptedAnswers` JSON NULL,
  ADD COLUMN `feedbackCorrect` TEXT NULL,
  ADD COLUMN `feedbackIncorrect` TEXT NULL,
  ADD COLUMN `fileUploadConfig` JSON NULL;

ALTER TABLE `Ujian`
  ADD COLUMN `collectRespondentEmail` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `sendCopyToRespondent` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `oneResponsePerEmail` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `notifyGuruOnResponse` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `presentationMode` VARCHAR(16) NOT NULL DEFAULT 'ALL',
  ADD COLUMN `releaseMode` VARCHAR(24) NOT NULL DEFAULT 'IMMEDIATE';

ALTER TABLE `QuizResponse`
  ADD COLUMN `respondentEmail` VARCHAR(255) NULL,
  ADD COLUMN `scoreReleasedAt` DATETIME(3) NULL;

CREATE INDEX `QuizResponse_ujianId_respondentEmail_idx` ON `QuizResponse`(`ujianId`, `respondentEmail`);
