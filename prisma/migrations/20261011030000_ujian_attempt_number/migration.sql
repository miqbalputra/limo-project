-- Penegakan maxAttempts secara atomik: nomor attempt unik per (ujian, siswa)
-- membuat double-click/request paralel tidak lagi bisa membuat dua attempt
-- dengan hitungan yang sama (sebelumnya check-then-create bisa diloloskan).

ALTER TABLE `UjianAttempt` ADD COLUMN `attemptNumber` INTEGER NOT NULL DEFAULT 1;

-- Backfill: nomorkan attempt lama per (ujianId, siswaId) urut createdAt.
UPDATE `UjianAttempt` u
JOIN (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY ujianId, siswaId ORDER BY createdAt, id) AS rn
  FROM `UjianAttempt`
) t ON t.id = u.id
SET u.attemptNumber = t.rn;

ALTER TABLE `UjianAttempt` ADD UNIQUE INDEX `UjianAttempt_ujianId_siswaId_attemptNumber_key`(`ujianId`, `siswaId`, `attemptNumber`);
