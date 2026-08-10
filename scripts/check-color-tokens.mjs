import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(rootDir, "src");
const allowedFiles = new Set([
  "src/app/globals.css",
  "src/lib/limo-brand.ts",
]);
const sourceExtensions = new Set([".css", ".ts", ".tsx"]);
const hexColor = /#[0-9a-fA-F]{3,8}\b/g;

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(entryPath));
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

const violations = [];
for (const filePath of await collectFiles(sourceDir)) {
  const relativePath = path.relative(rootDir, filePath).replaceAll("\\", "/");
  if (allowedFiles.has(relativePath)) continue;

  const content = await readFile(filePath, "utf8");
  for (const match of content.matchAll(hexColor)) {
    const line = content.slice(0, match.index).split("\n").length;
    violations.push(`${relativePath}:${line} ${match[0]}`);
  }
}

if (violations.length > 0) {
  console.error("Hex color di luar token LIMO tidak diizinkan:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log("Pemeriksaan token warna lulus.");
}
