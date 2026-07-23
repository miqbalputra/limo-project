import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { prepareSqliteSchema } from "./prepare-sqlite-schema.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prismaCli = path.join(rootDir, "node_modules", "prisma", "build", "index.js");
const env = { ...process.env, DATABASE_URL: "file:./dev.db" };

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
run(process.execPath, [prismaCli, "db", "push", "--schema", "prisma/schema.sqlite.prisma", "--skip-generate"]);
run(process.execPath, [prismaCli, "generate", "--schema", "prisma/schema.sqlite.prisma"]);
run(process.execPath, ["--experimental-strip-types", "prisma/seed.ts"]);

console.log("SQLite local database is ready at prisma/dev.db");
