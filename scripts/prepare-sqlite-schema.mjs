import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(rootDir, "prisma", "schema.prisma");
const targetPath = path.join(rootDir, "prisma", "schema.sqlite.prisma");

export async function prepareSqliteSchema() {
  const source = await readFile(sourcePath, "utf8");
  const providerMatches = source.match(/provider\s*=\s*"mysql"/g) ?? [];
  const nativeTypeMatches = source.match(/\s+@db\.(?:Text|VarChar\(\d+\)|Decimal\(\d+,\s*\d+\))/g) ?? [];

  if (providerMatches.length !== 1) {
    throw new Error(`Expected exactly one MySQL provider, found ${providerMatches.length}`);
  }

  if (nativeTypeMatches.length !== 36) {
    throw new Error(`Expected exactly 36 MySQL native type attributes, found ${nativeTypeMatches.length}`);
  }

  const sqliteSchema = source
    .replace('provider = "mysql"', 'provider = "sqlite"')
    .replace(/\s+@db\.(?:Text|VarChar\(\d+\)|Decimal\(\d+,\s*\d+\))/g, "");

  await writeFile(targetPath, sqliteSchema, "utf8");
  return targetPath;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepareSqliteSchema()
    .then((target) => console.log(`SQLite schema generated: ${path.relative(rootDir, target)}`))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
