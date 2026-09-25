import "./load-env.ts";
import { finalizeExpiredQuizResponses } from "@/server/services/quiz-finalize-service";

const dryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.find((value) => value.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

const result = await finalizeExpiredQuizResponses({ dryRun, limit: Number.isFinite(limit) ? limit : undefined });

console.log(`${dryRun ? "[dry-run] " : ""}scanned=${result.scanned} finalized=${result.finalized}`);
process.exit(0);
