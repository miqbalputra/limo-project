import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Menjalankan seluruh runner integrasi (tests/run-*.mjs) terhadap SATU server
// dan SATU database SQLite segar, sehingga suite bisa jalan di CI.
// - Runner berbasis HTTP memakai TEST_BASE_URL yang diarahkan ke server ini.
// - Runner berbasis service/Prisma langsung cukup memakai DATABASE_URL yang sama.
// - Server selalu `next dev`: runner integrasi dirancang untuk perilaku
//   development (feature flag default aktif, link reset dikembalikan, notifikasi
//   instan). Build produksi diverifikasi terpisah oleh step `npm run build`
//   dan suite e2e PWA yang berjalan di atas `next start`.

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const port = process.env.INTEGRATION_PORT || "3100";
const baseUrl = `http://127.0.0.1:${port}`;
const requested = process.env.INTEGRATION_SPEC;

const serverRunners = [
  "tests/run-week1-integration.mjs",
  "tests/run-week2-integration.mjs",
  "tests/run-week3-integration.mjs",
  "tests/run-week4-integration.mjs",
  "tests/run-week5-integration.mjs",
  "tests/run-week6-integration.mjs",
  "tests/run-week7-integration.mjs",
  "tests/run-week8-integration.mjs",
  "tests/run-week9-integration.mjs",
  "tests/run-week10-integration.mjs",
  "tests/run-pendaftaran-v2-integration.mjs",
  "tests/run-billing-voucher-integration.mjs",
  "tests/run-quiz-builder-integration.mjs",
  "tests/run-quiz-share-integration.mjs",
  "tests/run-student-exam-integration.mjs",
  "tests/run-account-management-integration.mjs",
  "tests/run-user-management-integration.mjs",
  "tests/run-certificate-integration.mjs",
  "tests/run-progress-report-integration.mjs",
  "tests/run-notification-log-integration.mjs",
  "tests/run-class-forum-integration.mjs",
];

const directRunners = [
  "tests/run-payment-gateway.mjs",
  "tests/run-w5-reconciliation.mjs",
  "tests/run-c8-client.mjs",
  "tests/run-reminder-integration.mjs",
];

const allRunners = [...directRunners, ...serverRunners]
  .filter((file) => !requested || file.includes(requested));

if (allRunners.length === 0) {
  throw new Error(`Tidak ada runner integrasi yang cocok dengan filter: ${requested}`);
}

// Profil env mirror CI (.github/workflows/ci.yml): runner men-spawn script
// child (reminders, billing) yang memvalidasi env secara ketat.
// CATATAN: kredensial provider Mayar (API key/merchant/env) dari operator atau
// CI (mis. placeholder di ci.yml) SENGAJA disaring — cabang pembuatan invoice
// Mayar pada runner memang harus skip bila kredensial nyata tidak tersedia
// (MAYAR_BASE_URL CI adalah blackhole). Tanpa penyaringan ini, placeholder
// dianggap "terkonfigurasi" dan runner mengharapkan panggilan provider nyata.
// Yang tetap diteruskan hanya MAYAR_WEBHOOK_SECRET, karena test webhook
// mengirim secret via header.
const sanitizedProcessEnv = { ...process.env };
delete sanitizedProcessEnv.MAYAR_API_KEY;
delete sanitizedProcessEnv.MAYAR_MERCHANT_ID;
delete sanitizedProcessEnv.MAYAR_ENV;
const suiteEnv = {
  APP_URL: baseUrl,
  SESSION_SECRET: process.env.SESSION_SECRET || "integration-suite-session-secret-0123456789abcdef",
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME || "limo_session_suite",
  PRIVATE_STORAGE_PATH: process.env.PRIVATE_STORAGE_PATH || "./.suite/private-storage",
  BACKUP_DIR: process.env.BACKUP_DIR || "./.suite/backups",
  BACKUP_WEBHOOK_SECRET: process.env.BACKUP_WEBHOOK_SECRET || "suite-only-backup-webhook-secret",
  MAYAR_WEBHOOK_SECRET: process.env.MAYAR_WEBHOOK_SECRET || "suite-placeholder-mayar-webhook-secret",
  PAYMENT_CONFIG_ENCRYPTION_KEY: process.env.PAYMENT_CONFIG_ENCRYPTION_KEY || randomBytes(32).toString("base64"),
  NOTIFICATION_PROVIDER: "console",
  LIMO_ALLOW_DEMO_SEED: "true",
  DOKPLOY_SQLITE_DEMO: "true",
  NEXT_PUBLIC_LIMO_CONTACT_EMAIL: process.env.NEXT_PUBLIC_LIMO_CONTACT_EMAIL || "suite@limo.invalid",
};

function runRunner(runnerFile, runnerIndex) {
  const result = spawnSync(process.execPath, [
    "--import", "./scripts/register-node-module-hooks.mjs",
    "--experimental-strip-types",
    runnerFile,
  ], {
    cwd: rootDir,
    env: {
      ...sanitizedProcessEnv,
      ...suiteEnv,
      NODE_ENV: "test",
      // NODE_ENV=test membuat @next/env mengabaikan .env.local — DATABASE_URL
      // wajib diset eksplisit, jangan mengandalkan file env.
      DATABASE_URL: process.env.DATABASE_URL || "file:./dev.db",
      TEST_BASE_URL: baseUrl,
      // IP klien unik per runner agar bucket rate limit per-IP di server
      // (quiz-start 30/jam, dsb.) tidak saling menular antar-runner.
      TEST_CLIENT_IP: `10.77.${runnerIndex + 1}.7`,
    },
    stdio: "inherit",
    shell: false,
  });

  if (result.error) throw result.error;
  return result.status ?? 1;
}

function waitUntilHealthy(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const response = await fetch(`${url}/api/health`);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // server belum siap
      }
      if (Date.now() > deadline) {
        reject(new Error(`Server tidak menjadi sehat dalam ${timeoutMs} ms: ${url}/api/health`));
        return;
      }
      setTimeout(attempt, 1_000);
    };
    attempt();
  });
}

function startServer() {
  const child = spawn(npmCommand, ["run", "--silent", "dev", "--", "--port", port, "--hostname", "127.0.0.1"], {
    cwd: rootDir,
    env: {
      ...sanitizedProcessEnv,
      ...suiteEnv,
      NODE_ENV: "development",
    },
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  const stop = () => {
    if (child.killed || child.exitCode !== null) return;
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", shell: true });
    } else {
      child.kill("SIGTERM");
    }
  };

  return { child, stop };
}

let server;
const failures = [];
const startedAt = Date.now();

try {
  if (!requested) {
    // DB segar + seed demo agar runner berbasis HTTP punya pengguna dasar.
    const setup = spawnSync(npmCommand, ["run", "--silent", "sqlite:setup"], { cwd: rootDir, stdio: "inherit", shell: process.platform === "win32" });
    if (setup.status !== 0) throw new Error("sqlite:setup gagal — suite integrasi butuh database SQLite segar.");
  }

  server = startServer();
  console.log(`[integration-suite] server: next dev di ${baseUrl}`);
  await waitUntilHealthy(baseUrl);

  for (const [index, runner] of allRunners.entries()) {
    const label = path.basename(runner);
    console.log(`\n[integration-suite] ▶ ${label}`);
    const status = runRunner(runner, index);
    if (status === 0) {
      console.log(`[integration-suite] ✔ ${label}`);
    } else {
      console.error(`[integration-suite] ✖ ${label} (status ${status})`);
      failures.push(label);
    }
  }
} finally {
  server?.stop();
}

const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`\n[integration-suite] selesai dalam ${elapsed}s — ${allRunners.length - failures.length}/${allRunners.length} lulus`);

if (failures.length > 0) {
  console.error(`[integration-suite] GAGAL: ${failures.join(", ")}`);
  process.exit(1);
}
