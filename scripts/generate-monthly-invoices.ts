import "./load-env.ts";
import { generateMonthlyInvoices } from "../src/server/services/billing-service.ts";

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const now = new Date();
  const period = readArg("period") || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const dueDate = readArg("due-date") || `${period}-10`;
  const jenis = readArg("jenis") || "SPP";
  const dryRun = process.argv.includes("--dry-run");

  const result = await generateMonthlyInvoices(null, { period, dueDate, jenis, dryRun });
  console.log(JSON.stringify(result, null, 2));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
