import "./load-env.ts";
import { createBackup } from "../src/server/backup/backup-service.ts";

async function main() {
  const result = await createBackup();
  console.log(JSON.stringify({
    ...result,
    message: "Backup database.sql dan backup.zip berhasil dibuat",
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
