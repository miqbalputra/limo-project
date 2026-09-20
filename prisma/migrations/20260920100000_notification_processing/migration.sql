-- Status PROCESSING untuk klaim atomik saat pengiriman instan/retry
ALTER TABLE `Notifikasi`
  MODIFY `status` ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';
