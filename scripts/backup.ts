import "./load-env.ts";
import { createBackupAndUpload, notifyBackupOutcome } from "../src/server/backup/backup-service.ts";
import { notifyAdmins } from "../src/server/services/notification-service.ts";

async function main() {
  const result = await createBackupAndUpload();
  console.log(JSON.stringify({
    ...result,
    message: "Backup database.sql dan backup.zip berhasil dibuat",
  }, null, 2));
  if (result.offsite.configured && !result.offsite.uploaded) {
    console.error(`Unggah off-site gagal: ${result.offsite.error}`);
  }
  // Peringatan in-app ke admin (off-site belum diset / unggahan gagal).
  // Best-effort: kegagalan alert tidak mengubah exit code backup.
  await notifyBackupOutcome(result).catch((error) => {
    console.error(`Gagal mengirim notifikasi backup: ${error instanceof Error ? error.message : String(error)}`);
  });
  if (result.offsite.configured && !result.offsite.uploaded) {
    process.exit(1);
  }
}

main().catch(async (error) => {
  console.error(error);
  // Best-effort alert bila database masih bisa dihubungi; jangan menutupi
  // error asli bila penyebab kegagalan memang database-nya sendiri.
  await notifyAdmins({
    template: "backup-failure",
    subject: "Backup harian GAGAL",
    body: `Proses backup gagal berjalan: ${error instanceof Error ? error.message : String(error)}`.slice(0, 480),
    metadata: { source: "backup" },
  }).catch(() => undefined);
  process.exit(1);
});
