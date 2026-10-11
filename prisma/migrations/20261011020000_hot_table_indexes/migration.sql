-- Index untuk tabel yang tumbuh terus: job per-menit (notifikasi), halaman
-- audit, cleanup sesi, mark-overdue, dan reconcile gateway sebelumnya
-- melakukan full scan yang melambat linier dengan volume data.

-- CreateIndex
CREATE INDEX `Notifikasi_status_createdAt_idx` ON `Notifikasi`(`status`, `createdAt`);

-- CreateIndex
CREATE INDEX `AuditLog_createdAt_idx` ON `AuditLog`(`createdAt`);

-- CreateIndex
CREATE INDEX `Session_expiresAt_idx` ON `Session`(`expiresAt`);

-- CreateIndex
CREATE INDEX `Pembayaran_provider_status_idx` ON `Pembayaran`(`provider`, `status`);
