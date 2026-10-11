import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
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

// `production-navigation.spec.ts` memverifikasi perilaku default production
// (semua feature flag mati). Runner ini menjalankan `next dev`, jadi flag harus
// dimatikan eksplisit agar server memakai rule navigasi yang sama.
const specEnvOverrides = {
  "production-navigation.spec.ts": {
    STUDENT_PORTAL_ENABLED: "false",
    LEARNING_MODULES_ENABLED: "false",
    ASSIGNMENTS_ENABLED: "false",
    GRADEBOOK_ENABLED: "false",
    CALENDAR_ENABLED: "false",
    ACTIVITY_COMPLETION_ENABLED: "false",
    REMEDIAL_ENABLED: "false",
    PERIODIC_REPORTS_ENABLED: "false",
    GUARDIAN_ASSISTED_SUBMISSION_ENABLED: "false",
    STUDENT_SELF_EXAM_ENABLED: "false",
    CLASS_DISCUSSION_ENABLED: "false",
  },
};

// mobile-layout menguji geometri piksel (overflow/clipping 360-390px) yang
// sensitif metrik font OS runner — baseline-nya dibuat di Windows (-win32),
// dan render linux berbeda — jadi tetap dikarantina di CI.
// guru-workspace TIDAK lagi dikarantina: akar flakenya adalah kompilasi
// dingin `next dev` per spec, dan sejak mode E2E_PRODUCTION suite berjalan
// di atas `next start` tanpa kompilasi runtime.
const isCI = process.env.CI === "true";
const ciQuarantine = new Set(["mobile-layout.spec.ts"]);

// Mode produksi: server `next start` alih-alih `next dev`. Flag fitur
// eksplisit meniru ci.yml karena default produksi menonaktifkannya; server
// mewarisi env ini melalui playwright.
const production = process.env.E2E_PRODUCTION === "true";
const productionFlagEnv = production
  ? {
      STUDENT_PORTAL_ENABLED: "true",
      LEARNING_MODULES_ENABLED: "true",
      ASSIGNMENTS_ENABLED: "true",
      GRADEBOOK_ENABLED: "true",
      CALENDAR_ENABLED: "true",
      ACTIVITY_COMPLETION_ENABLED: "true",
      REMEDIAL_ENABLED: "true",
      PERIODIC_REPORTS_ENABLED: "true",
      STUDENT_SELF_EXAM_ENABLED: "true",
      CLASS_DISCUSSION_ENABLED: "true",
      LIMO_ALLOW_DEMO_SEED: "true",
      DOKPLOY_SQLITE_DEMO: "true",
      NEXT_PUBLIC_LIMO_CONTACT_EMAIL: process.env.NEXT_PUBLIC_LIMO_CONTACT_EMAIL || "e2e@limo.invalid",
      SESSION_SECRET: process.env.SESSION_SECRET || "e2e-production-session-secret-0123456789abcdef",
      SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME || "limo_session_e2e",
    }
  : {};

const specFiles = (await readdir(e2eDirectory))
  .filter((fileName) => fileName.endsWith(".spec.ts")
    && fileName !== "pwa.spec.ts"
    && !(isCI && ciQuarantine.has(fileName))
    && (!requestedSpec || fileName === requestedSpec))
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

async function removeWithRetry(filePath, attempts = 10) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await rm(filePath, { force: true });
      return;
    } catch (error) {
      const retryable = error && (error.code === "EBUSY" || error.code === "EPERM");
      if (!retryable || attempt === attempts - 1) {
        if (retryable) console.warn(`Peringatan: gagal menghapus ${filePath} setelah ${attempts} percobaan (${error.code}).`);
        else throw error;
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

// Mode produksi butuh build — pakai yang sudah ada (di CI, step build
// terpisah sudah membuatnya); bangun sendiri bila belum ada. Perhatikan
// build lama bisa stale bila kode berubah setelah build terakhir.
if (production && !existsSync(path.join(rootDir, ".next", "BUILD_ID"))) {
  console.log("[e2e] mode produksi: .next/BUILD_ID tidak ada — menjalankan npm run build ...");
  run(npmCommand, ["run", "build"], { ...process.env, ...productionFlagEnv, NODE_ENV: "production" });
}

for (const [index, specFile] of specFiles.entries()) {
  const databaseFile = `e2e-${runId}-${String(index + 1).padStart(2, "0")}.db`;
  const databaseUrl = `file:./${databaseFile}`;
  const env = {
    ...process.env,
    ...productionFlagEnv,
    NODE_ENV: production ? "production" : "development",
    DATABASE_URL: databaseUrl,
    LIMO_SQLITE_DATABASE_URL: databaseUrl,
    PLAYWRIGHT_REUSE_EXISTING_SERVER: "false",
    ...(specEnvOverrides[specFile] ?? {}),
  };

  try {
    run(npmCommand, ["run", "sqlite:setup"], env);
    run(npxCommand, ["playwright", "test", `tests/e2e/${specFile}`, ...playwrightArgs], env);
  } finally {
    if (process.platform !== "win32") {
      // next dev mati perlahan (shutdown graceful) — webServer spec sebelumnya
      // bisa tersisa sebagai proses yatim dan menumpuk memori hingga spec
      // tengah kehabisan ruang. Bersihkan sisa sebelum spec berikutnya.
      spawnSync("pkill", ["-f", "next dev"], { stdio: "ignore" });
      spawnSync("pkill", ["-f", "start-server.js"], { stdio: "ignore" });
    }
    // DEBUG-SEMENTARA: DB tidak dihapus agar bisa diperiksa setelah gagal.
    if (process.env.E2E_KEEP_DB !== "true") {
      await Promise.all([
        databaseFile,
        `${databaseFile}-journal`,
        `${databaseFile}-shm`,
        `${databaseFile}-wal`,
      ].map((fileName) => removeWithRetry(path.join(prismaDirectory, fileName))));
    }
  }
}
