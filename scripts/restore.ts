import "./load-env.ts";
import { restoreBackup } from "../src/server/backup/backup-service.ts";

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const archivePath = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  const confirmation = readArg("confirm");
  const databaseUrl = readArg("target-database-url");
  const storagePath = readArg("target-storage-path");

  if (!archivePath || confirmation !== "RESTORE_LIMO_BACKUP") {
    throw new Error("Restore memerlukan file .zip dan --confirm=RESTORE_LIMO_BACKUP");
  }
  if (!databaseUrl || !storagePath) {
    throw new Error("Restore wajib memakai --target-database-url dan --target-storage-path secara eksplisit");
  }

  const result = await restoreBackup({ archivePath, databaseUrl, storagePath });
  console.log(JSON.stringify({ ...result, message: "Restore database dan private storage berhasil" }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
