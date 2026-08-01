ALTER TABLE `UjianAttempt`
  ADD COLUMN `draftAnswers` JSON NULL,
  ADD COLUMN `draftSavedAt` DATETIME(3) NULL;
