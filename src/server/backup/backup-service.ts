import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { chmod, cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getEnv } from "@/server/env";

const execFileAsync = promisify(execFile);
const BACKUP_ID_PATTERN = /^\d{8}T\d{6}Z$/;

export type BackupManifest = {
  format: "limo-backup";
  version: 1;
  createdAt: string;
  database: {
    engine: "mysql";
    name: string;
    dumpFile: "database.sql";
  };
  storage: {
    directory: "storage";
    fileCount: number;
  };
  files: Array<{
    path: string;
    sizeBytes: number;
    sha256: string;
  }>;
};

export type BackupResult = {
  id: string;
  createdAt: string;
  sqlPath: string;
  zipPath: string;
  manifestPath: string;
  deletedBackupCount: number;
};

function resolveConfiguredPath(configuredPath: string) {
  return path.isAbsolute(configuredPath) ? path.resolve(configuredPath) : path.resolve(process.cwd(), configuredPath);
}

export function resolveBackupRoot() {
  return resolveConfiguredPath(getEnv().BACKUP_DIR);
}

export function resolvePrivateStorageRoot() {
  return resolveConfiguredPath(getEnv().PRIVATE_STORAGE_PATH);
}

export function isSafeBackupId(id: string) {
  return BACKUP_ID_PATTERN.test(id);
}

function backupIdFor(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function decodeUrlPart(value: string) {
  return decodeURIComponent(value);
}

function parseDatabaseUrl(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== "mysql:" && parsed.protocol !== "mariadb:") {
    throw new Error("Backup database hanya mendukung DATABASE_URL mysql atau mariadb");
  }

  const databaseName = decodeUrlPart(parsed.pathname.replace(/^\//, ""));
  if (!parsed.hostname || !databaseName) {
    throw new Error("DATABASE_URL backup harus memiliki host dan nama database");
  }
  const user = decodeUrlPart(parsed.username);
  const password = decodeUrlPart(parsed.password);
  if ([parsed.hostname, user, password, databaseName].some((value) => /[\r\n]/.test(value))) {
    throw new Error("DATABASE_URL backup mengandung karakter baris baru yang tidak valid");
  }

  return {
    host: parsed.hostname,
    port: parsed.port || "3306",
    user,
    password,
    databaseName,
  };
}

async function findCommand(commands: string[]) {
  for (const command of commands) {
    try {
      await execFileAsync(command, ["--version"], { maxBuffer: 1024 * 1024 });
      return command;
    } catch {
      // Try the next platform package name.
    }
  }

  throw new Error(`Command backup tidak tersedia: ${commands.join(" atau ")}`);
}

async function writeClientConfig(directory: string, databaseUrl: string) {
  const database = parseDatabaseUrl(databaseUrl);
  const configPath = path.join(directory, `.db-client-${randomUUID()}.cnf`);
  const config = [
    "[client]",
    `host=${database.host}`,
    `port=${database.port}`,
    `user=${database.user}`,
    `password=${database.password}`,
    "",
  ].join("\n");
  await writeFile(configPath, config, { encoding: "utf8", mode: 0o600, flag: "wx" });
  return { configPath, database };
}

async function hashFile(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function listFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Symlink tidak boleh masuk backup: ${absolutePath}`);
    }
    if (entry.isDirectory()) {
      files.push(...await listFiles(root, absolutePath));
    } else if (entry.isFile()) {
      files.push(path.relative(root, absolutePath).split(path.sep).join("/"));
    }
  }

  return files;
}

async function copyDirectoryContents(source: string, destination: string) {
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      throw new Error(`Symlink tidak boleh masuk backup: ${path.join(source, entry.name)}`);
    }
    await cp(path.join(source, entry.name), path.join(destination, entry.name), { recursive: true, force: true, errorOnExist: false });
  }
}

async function dumpDatabase(sqlPath: string, configDirectory: string, databaseUrl: string) {
  const { configPath, database } = await writeClientConfig(configDirectory, databaseUrl);
  try {
    const dumpCommand = await findCommand(["mariadb-dump", "mysqldump"]);
    await execFileAsync(dumpCommand, [
      `--defaults-extra-file=${configPath}`,
      "--single-transaction",
      "--routines",
      "--triggers",
      "--hex-blob",
      "--skip-lock-tables",
      database.databaseName,
      "--result-file",
      sqlPath,
    ], { maxBuffer: 1024 * 1024 * 8 });
    await chmod(sqlPath, 0o600);
    return database.databaseName;
  } finally {
    await rm(configPath, { force: true });
  }
}

async function zipBackup(runDirectory: string) {
  const zipCommand = await findCommand(["zip"]);
  await execFileAsync(zipCommand, ["-q", "-r", "backup.zip", "database.sql", "storage", "manifest.json"], {
    cwd: runDirectory,
    maxBuffer: 1024 * 1024 * 8,
  });
}

async function cleanupOldBackups(root: string, retentionDays: number) {
  const cutoff = Date.now() - Math.max(1, retentionDays) * 24 * 60 * 60 * 1000;
  const entries = await readdir(root, { withFileTypes: true });
  let deleted = 0;

  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeBackupId(entry.name)) continue;
    const directory = path.join(root, entry.name);
    const details = await stat(directory);
    if (details.mtimeMs < cutoff) {
      await rm(directory, { recursive: true, force: true });
      deleted += 1;
    }
  }

  return deleted;
}

export async function createBackup(): Promise<BackupResult> {
  const env = getEnv();
  const root = resolveBackupRoot();
  const createdAtDate = new Date();
  const createdAt = createdAtDate.toISOString();
  const id = backupIdFor(createdAtDate);
  const runDirectory = path.join(root, id);
  const lockPath = path.join(root, ".backup.lock");
  const privateRoot = resolvePrivateStorageRoot();
  if (root === privateRoot || root.startsWith(`${privateRoot}${path.sep}`) || privateRoot.startsWith(`${root}${path.sep}`)) {
    throw new Error("BACKUP_DIR dan PRIVATE_STORAGE_PATH tidak boleh saling berada di dalam satu sama lain");
  }

  await mkdir(root, { recursive: true, mode: 0o700 });
  try {
    await writeFile(lockPath, `${process.pid}\n${createdAt}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  } catch {
    throw new Error("Backup lain sedang berjalan atau lock backup perlu dibersihkan manual");
  }

  try {
    await mkdir(runDirectory, { recursive: true, mode: 0o700 });
    const storageDirectory = path.join(runDirectory, "storage");
    await copyDirectoryContents(resolvePrivateStorageRoot(), storageDirectory);

    const sqlPath = path.join(runDirectory, "database.sql");
    const databaseName = await dumpDatabase(sqlPath, runDirectory, env.DATABASE_URL);
    const files = await listFiles(runDirectory);
    const manifestFiles = [];
    for (const relativePath of files) {
      if (relativePath === "manifest.json" || relativePath === "backup.zip") continue;
      const filePath = path.join(runDirectory, relativePath);
      const details = await stat(filePath);
      manifestFiles.push({ path: relativePath, sizeBytes: details.size, sha256: await hashFile(filePath) });
    }

    const manifest: BackupManifest = {
      format: "limo-backup",
      version: 1,
      createdAt,
      database: { engine: "mysql", name: databaseName, dumpFile: "database.sql" },
      storage: { directory: "storage", fileCount: manifestFiles.filter((file) => file.path.startsWith("storage/")).length },
      files: manifestFiles,
    };
    const manifestPath = path.join(runDirectory, "manifest.json");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await zipBackup(runDirectory);
    await chmod(path.join(runDirectory, "backup.zip"), 0o600);
    const deletedBackupCount = await cleanupOldBackups(root, env.BACKUP_RETENTION_DAYS);

    return {
      id,
      createdAt,
      sqlPath,
      zipPath: path.join(runDirectory, "backup.zip"),
      manifestPath,
      deletedBackupCount,
    };
  } catch (error) {
    await rm(runDirectory, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(lockPath, { force: true });
  }
}

export async function readBackupManifest(id: string) {
  if (!isSafeBackupId(id)) throw new Error("ID backup tidak valid");
  const manifestPath = path.join(resolveBackupRoot(), id, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as BackupManifest;
  if (manifest.format !== "limo-backup" || manifest.version !== 1) {
    throw new Error("Format manifest backup tidak didukung");
  }
  return manifest;
}

export function resolveBackupArtifact(id: string, format: "sql" | "zip") {
  if (!isSafeBackupId(id)) throw new Error("ID backup tidak valid");
  const filename = format === "sql" ? "database.sql" : "backup.zip";
  const root = resolveBackupRoot();
  const artifactPath = path.resolve(root, id, filename);
  if (!artifactPath.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error("Path backup tidak valid");
  return artifactPath;
}

async function findDatabaseClient() {
  return findCommand(["mariadb", "mysql"]);
}

async function importDatabase(sqlPath: string, configDirectory: string, databaseUrl: string) {
  const { configPath, database } = await writeClientConfig(configDirectory, databaseUrl);
  try {
    const client = await findDatabaseClient();
    await new Promise<void>((resolve, reject) => {
      const child = spawn(client, [`--defaults-extra-file=${configPath}`, database.databaseName], { stdio: ["pipe", "ignore", "pipe"] });
      let stderr = "";
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Import database gagal (${code}): ${stderr.trim()}`));
      });
      createReadStream(sqlPath).on("error", reject).pipe(child.stdin);
    });
  } finally {
    await rm(configPath, { force: true });
  }
}

export async function restoreBackup(input: { archivePath: string; databaseUrl: string; storagePath: string }) {
  const archivePath = path.resolve(input.archivePath);
  const archiveDetails = await stat(archivePath);
  if (!archiveDetails.isFile() || !archivePath.toLowerCase().endsWith(".zip")) throw new Error("File restore harus berupa backup .zip");

  const extractionDirectory = path.join(resolveBackupRoot(), `.restore-${randomUUID()}`);
  await mkdir(extractionDirectory, { recursive: true, mode: 0o700 });
  try {
    const unzip = await findCommand(["unzip"]);
    const listing = await execFileAsync(unzip, ["-Z1", archivePath], { maxBuffer: 1024 * 1024 * 8 });
    for (const entry of listing.stdout.split(/\r?\n/).filter(Boolean)) {
      if (path.isAbsolute(entry) || entry.split(/[\\/]/).includes("..") || entry.includes("\0")) {
        throw new Error(`Entry ZIP tidak aman: ${entry}`);
      }
    }
    await execFileAsync(unzip, ["-q", archivePath, "-d", extractionDirectory], { maxBuffer: 1024 * 1024 * 8 });

    const manifest = JSON.parse(await readFile(path.join(extractionDirectory, "manifest.json"), "utf8")) as BackupManifest;
    if (manifest.format !== "limo-backup" || manifest.version !== 1) throw new Error("Format manifest backup tidak didukung");
    for (const file of manifest.files) {
      const filePath = path.resolve(extractionDirectory, file.path);
      if (!filePath.startsWith(`${extractionDirectory}${path.sep}`)) throw new Error(`Manifest path tidak aman: ${file.path}`);
      const details = await stat(filePath);
      if (details.size !== file.sizeBytes || await hashFile(filePath) !== file.sha256) throw new Error(`Checksum backup tidak cocok: ${file.path}`);
    }

    const storagePath = resolveConfiguredPath(input.storagePath);
    const storageRoot = path.parse(storagePath).root;
    if (storagePath === storageRoot || storagePath === path.resolve(process.cwd())) {
      throw new Error("Target private storage restore terlalu berisiko; gunakan subdirectory khusus staging");
    }
    await importDatabase(path.join(extractionDirectory, manifest.database.dumpFile), extractionDirectory, input.databaseUrl);
    await rm(storagePath, { recursive: true, force: true });
    await copyDirectoryContents(path.join(extractionDirectory, manifest.storage.directory), storagePath);
    return { createdAt: manifest.createdAt, database: manifest.database.name, restoredFiles: manifest.storage.fileCount };
  } finally {
    await rm(extractionDirectory, { recursive: true, force: true });
  }
}
