import { timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getEnv } from "@/server/env";
import { UnauthorizedError } from "@/server/errors/application-error";

export const runtime = "nodejs";

function assertBackupAuthorization(request: Request) {
  const expected = getEnv().BACKUP_WEBHOOK_SECRET;
  const authorization = request.headers.get("authorization") || "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (expected.length < 32 || !provided) throw new UnauthorizedError("Backup webhook tidak terkonfigurasi atau token tidak valid");

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    throw new UnauthorizedError("Backup webhook tidak terkonfigurasi atau token tidak valid");
  }
}

function resolveBackupRoot() {
  const configuredPath = getEnv().BACKUP_DIR;
  return path.isAbsolute(configuredPath)
    ? path.resolve(/*turbopackIgnore: true*/ configuredPath)
    : path.resolve(/*turbopackIgnore: true*/ process.cwd(), /*turbopackIgnore: true*/ configuredPath);
}

function resolveBackupArtifact(id: string, format: "sql" | "zip") {
  if (!/^\d{8}T\d{6}Z$/.test(id)) throw new UnauthorizedError("ID backup tidak valid");
  const root = resolveBackupRoot();
  const filename = format === "sql" ? "database.sql" : "backup.zip";
  const artifactPath = path.resolve(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ root, id, filename));
  if (!artifactPath.startsWith(`${root}${path.sep}`)) throw new UnauthorizedError("Path backup tidak valid");
  return artifactPath;
}

async function runBackupCommand() {
  return new Promise<{ id: string; createdAt: string; deletedBackupCount: number }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", "scripts/backup.ts"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Backup gagal (${code}): ${stderr.trim()}`));
        return;
      }
      try {
        const result = JSON.parse(stdout.trim()) as { id: string; createdAt: string; deletedBackupCount: number };
        resolve(result);
      } catch {
        reject(new Error("Output backup tidak valid"));
      }
    });
  });
}

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    assertBackupAuthorization(request);
    const result = await runBackupCommand();
    return apiOk({
      backupId: result.id,
      createdAt: result.createdAt,
      deletedBackupCount: result.deletedBackupCount,
      sqlDownloadPath: `/api/internal/backup/download?backupId=${encodeURIComponent(result.id)}&format=sql`,
      zipDownloadPath: `/api/internal/backup/download?backupId=${encodeURIComponent(result.id)}&format=zip`,
    }, { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    assertBackupAuthorization(request);
    const url = new URL(request.url);
    const backupId = url.searchParams.get("backupId") || "";
    const format = url.searchParams.get("format");
    if (format !== "sql" && format !== "zip") throw new UnauthorizedError("Format backup tidak valid");
    const artifactPath = resolveBackupArtifact(backupId, format);
    const details = await stat(/*turbopackIgnore: true*/ artifactPath);
    if (!details.isFile()) throw new UnauthorizedError("Artefak backup tidak tersedia");

    const filename = format === "sql" ? `limo-database-${backupId}.sql` : `limo-backup-${backupId}.zip`;
    return new Response(Readable.toWeb(createReadStream(/*turbopackIgnore: true*/ artifactPath)) as ReadableStream, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(details.size),
        "Content-Type": format === "sql" ? "application/sql; charset=utf-8" : "application/zip",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
