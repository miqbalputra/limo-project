import "./load-env.ts";
import { cleanupExpiredSessions } from "../src/server/services/job-service.ts";

async function main() {
  const result = await cleanupExpiredSessions({ dryRun: process.argv.includes("--dry-run") });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
