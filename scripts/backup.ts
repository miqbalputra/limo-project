import "./load-env.ts";
import { createBackupAndUpload } from "../src/server/backup/backup-service.ts";

async function main() {
  const result = await createBackupAndUpload();
  console.log(JSON.stringify({
    ...result,
    message: "Backup database.sql dan backup.zip berhasil dibuat",
  }, null, 2));
  if (result.offsite.configured && !result.offsite.uploaded) {
    console.error(`Unggah off-site gagal: ${result.offsite.error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
