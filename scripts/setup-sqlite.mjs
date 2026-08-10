import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { prepareSqliteSchema } from "./prepare-sqlite-schema.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prismaCli = path.join(rootDir, "node_modules", "prisma", "build", "index.js");
const databaseUrl = process.env.LIMO_SQLITE_DATABASE_URL || "file:./dev.db";

if (!databaseUrl.startsWith("file:")) {
  throw new Error("LIMO_SQLITE_DATABASE_URL harus menunjuk ke database SQLite file:.");
}

const env = { ...process.env, DATABASE_URL: databaseUrl, LIMO_ALLOW_DEMO_SEED: "true" };

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

await prepareSqliteSchema();
run(process.execPath, [prismaCli, "validate", "--schema", "prisma/schema.sqlite.prisma"]);
run(process.execPath, [prismaCli, "db", "push", "--schema", "prisma/schema.sqlite.prisma", "--skip-generate", "--accept-data-loss"]);
run(process.execPath, [prismaCli, "generate", "--schema", "prisma/schema.sqlite.prisma"]);
run(process.execPath, ["--experimental-strip-types", "prisma/seed.ts"]);

console.log(`SQLite local database is ready at ${databaseUrl}`);
