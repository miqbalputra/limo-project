import "./load-env.ts";
import { currentAutopilotPeriod, generateMonthlyReportDrafts } from "../src/server/services/report-autopilot-service.ts";

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const period = readArg("period") || currentAutopilotPeriod();
  const dryRun = process.argv.includes("--dry-run");

  const result = await generateMonthlyReportDrafts(null, { period, dryRun });
  console.log(JSON.stringify(result, null, 2));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
