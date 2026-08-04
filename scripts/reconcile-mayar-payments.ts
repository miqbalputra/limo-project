import "./load-env.ts";
import { reconcilePendingMayarPayments } from "../src/server/services/job-service.ts";

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const limit = Number(readArg("limit") || 50);
  const result = await reconcilePendingMayarPayments({ dryRun: process.argv.includes("--dry-run"), limit });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
