import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const API_ROOT = join(process.cwd(), "src", "app", "api");

const EXEMPT_PREFIXES = ["/api/health", "/api/internal/", "/api/v1/auth/", "/api/v1/public/", "/api/v1/pendaftaran", "/api/v1/webhooks/"];
const ROLE_REQUIRED_PREFIXES = ["/api/v1/admin/", "/api/v1/guru/", "/api/v1/bank-soal"];
const GUARD_PATTERN = /requireActor\s*\(|requireRole\s*\(|requireAnyRole\s*\(|requireActorWithRole\s*\(|requirePermission\s*\(/;
const ROLE_PATTERN = /requireRole\s*\(|requireAnyRole\s*\(|requireActorWithRole\s*\(|requirePermission\s*\(/;

function toUrlPath(file) {
  const normalized = file.replace(/\\/g, "/");
  const marker = "/src/app";
  const index = normalized.indexOf(marker);
  const appPath = index >= 0 ? normalized.slice(index + marker.length) : normalized;
  return appPath.replace(/\/route\.tsx?$/, "");
}

function isExempt(urlPath) {
  return EXEMPT_PREFIXES.some((prefix) => urlPath === prefix.replace(/\/$/, "") || urlPath.startsWith(prefix));
}

async function collectRoutes(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectRoutes(full)));
    } else if (entry.name === "route.ts" || entry.name === "route.tsx") {
      files.push(full);
    }
  }

  return files;
}

const routes = await collectRoutes(API_ROOT);
const offenders = [];
const roleOffenders = [];
let checked = 0;

for (const file of routes) {
  const urlPath = toUrlPath(file);
  if (isExempt(urlPath)) continue;

  checked += 1;
  const content = await readFile(file, "utf8");
  if (!GUARD_PATTERN.test(content)) {
    offenders.push(relative(process.cwd(), file).replace(/\\/g, "/"));
    continue;
  }

  if (ROLE_REQUIRED_PREFIXES.some((prefix) => urlPath.startsWith(prefix)) && !ROLE_PATTERN.test(content)) {
    roleOffenders.push(relative(process.cwd(), file).replace(/\\/g, "/"));
  }
}

assert.equal(
  offenders.length,
  0,
  `Route API tanpa guard auth (requireActor/requireRole/requireAnyRole):\n${offenders.join("\n")}`,
);

assert.equal(
  roleOffenders.length,
  0,
  `Route admin/guru tanpa cek role eksplisit (requireRole/requireAnyRole):\n${roleOffenders.join("\n")}`,
);

console.log(`ok - ${checked} route API terproteksi memanggil guard auth`);
