import "./load-env.ts";
import { retryPendingNotifications } from "../src/server/services/notification-job-service.ts";

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const limit = Number(readArg("limit") || 50);
  const dryRun = process.argv.includes("--dry-run");
  const result = await retryPendingNotifications({ dryRun, limit });

  // Senyap saat tidak ada aktivitas agar log cron per menit tidak menumpuk.
  if (dryRun || result.sent > 0 || result.failed > 0) {
    console.log(JSON.stringify(result, null, 2));
  }

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
