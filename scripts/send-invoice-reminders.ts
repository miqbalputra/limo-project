import "./load-env.ts";
import { sendInvoiceReminders } from "../src/server/services/reminder-service.ts";

async function main() {
  const nowArgument = process.argv.find((argument) => argument.startsWith("--now="))?.slice("--now=".length);
  const now = nowArgument ? new Date(nowArgument) : undefined;
  if (now && Number.isNaN(now.getTime())) throw new Error("--now harus berupa ISO datetime yang valid");
  const result = await sendInvoiceReminders({ now, dryRun: process.argv.includes("--dry-run") });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
