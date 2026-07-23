import { markOverdueInvoices } from "../src/server/services/job-service.ts";

async function main() {
  const result = await markOverdueInvoices({ dryRun: process.argv.includes("--dry-run") });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
