import { spawnSync } from "node:child_process";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const e2eDirectory = path.join(rootDir, "tests", "e2e");
const prismaDirectory = path.join(rootDir, "prisma");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const runId = `${Date.now()}-${process.pid}`;
const requestedSpec = process.env.E2E_SPEC;
const playwrightArgs = process.env.E2E_UPDATE_SNAPSHOTS === "true" ? ["--update-snapshots"] : [];
const specFiles = (await readdir(e2eDirectory))
  .filter((fileName) => fileName.endsWith(".spec.ts") && fileName !== "pwa.spec.ts" && (!requestedSpec || fileName === requestedSpec))
  .sort();

if (specFiles.length === 0) {
  throw new Error(`Tidak ada spec E2E yang cocok${requestedSpec ? `: ${requestedSpec}` : ""}.`);
}

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} gagal dengan status ${result.status ?? "unknown"}.`);
  }
}

for (const [index, specFile] of specFiles.entries()) {
  const databaseFile = `e2e-${runId}-${String(index + 1).padStart(2, "0")}.db`;
  const databaseUrl = `file:./${databaseFile}`;
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    LIMO_SQLITE_DATABASE_URL: databaseUrl,
    PLAYWRIGHT_REUSE_EXISTING_SERVER: "false",
  };

  try {
    run(npmCommand, ["run", "sqlite:setup"], env);
    run(npxCommand, ["playwright", "test", `tests/e2e/${specFile}`, ...playwrightArgs], env);
  } finally {
    await Promise.all([
      databaseFile,
      `${databaseFile}-journal`,
      `${databaseFile}-shm`,
      `${databaseFile}-wal`,
    ].map((fileName) => rm(path.join(prismaDirectory, fileName), { force: true })));
  }
}
