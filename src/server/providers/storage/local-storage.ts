import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "@/server/env";
import { ValidationError } from "@/server/errors/application-error";
import { sanitizeOriginalFilename } from "@/server/security/filename";

const allowedTypes = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
]);

const allowedExtensions = new Map([
  ["application/pdf", new Set(["pdf"])],
  ["image/jpeg", new Set(["jpg", "jpeg"])],
  ["image/png", new Set(["png"])],
]);

export type StoredFile = {
  originalName: string;
  storedName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: bigint;
  checksumSha256: string;
};

function resolveStorageRoot() {
  const configuredPath = getEnv().PRIVATE_STORAGE_PATH;

  if (path.isAbsolute(configuredPath)) {
    return path.resolve(/*turbopackIgnore: true*/ configuredPath);
  }

  return path.resolve(path.join(/*turbopackIgnore: true*/ process.cwd(), configuredPath));
}

export function validatePrivateFile(input: { name: string; type: string; size: number; kind: "registration" | "material" }) {
  const env = getEnv();
  const maxMb = input.kind === "registration" ? env.MAX_REGISTRATION_FILE_MB : env.MAX_MATERIAL_FILE_MB;
  const maxBytes = maxMb * 1024 * 1024;

  if (input.size < 1) {
    throw new ValidationError("File dokumen kosong");
  }

  if (input.size > maxBytes) {
    throw new ValidationError(`Ukuran file maksimal ${maxMb} MB`);
  }

  if (!allowedTypes.has(input.type)) {
    throw new ValidationError("Tipe file dokumen harus PDF, JPG, atau PNG");
  }

  const extension = path.extname(input.name).slice(1).toLowerCase();
  if (!allowedExtensions.get(input.type)?.has(extension)) {
    throw new ValidationError("Ekstensi file tidak sesuai dengan tipe dokumen");
  }

  return allowedTypes.get(input.type) || "bin";
}

export function validateMagicBytes(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "application/pdf") {
    const header = Buffer.from(bytes.slice(0, 4)).toString("ascii");
    if (header !== "%PDF") {
      throw new ValidationError("Isi file PDF tidak valid");
    }
  }

  if (mimeType === "image/jpeg") {
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
      throw new ValidationError("Isi file JPG tidak valid");
    }
  }

  if (mimeType === "image/png") {
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (!pngSignature.every((value, index) => bytes[index] === value)) {
      throw new ValidationError("Isi file PNG tidak valid");
    }
  }
}

export async function storePrivateFile(file: File, folder: string): Promise<StoredFile> {
  const extension = validatePrivateFile({ name: file.name, type: file.type, size: file.size, kind: "registration" });
  const bytes = new Uint8Array(await file.arrayBuffer());
  validateMagicBytes(bytes, file.type);

  return writePrivateFile({ file, folder, extension, bytes });
}

export async function storeMaterialFile(file: File, folder: string): Promise<StoredFile> {
  const extension = validatePrivateFile({ name: file.name, type: file.type, size: file.size, kind: "material" });
  const bytes = new Uint8Array(await file.arrayBuffer());
  validateMagicBytes(bytes, file.type);

  return writePrivateFile({ file, folder, extension, bytes });
}

async function writePrivateFile(input: { file: File; folder: string; extension: string; bytes: Uint8Array }): Promise<StoredFile> {
  const safeFolder = input.folder.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageRoot = resolveStorageRoot();
  const storageDir = path.join(storageRoot, safeFolder);
  const storedName = `${randomUUID()}.${input.extension}`;
  const storagePath = path.join(storageDir, storedName);

  await mkdir(storageDir, { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ storagePath, input.bytes, { flag: "wx" });

  return {
    originalName: sanitizeOriginalFilename(input.file.name),
    storedName,
    storagePath,
    mimeType: input.file.type,
    sizeBytes: BigInt(input.file.size),
    checksumSha256: createHash("sha256").update(input.bytes).digest("hex"),
  };
}

export async function readPrivateFile(storagePath: string) {
  const storageRoot = resolveStorageRoot();
  const resolved = path.resolve(/*turbopackIgnore: true*/ storagePath);

  if (!resolved.startsWith(storageRoot)) {
    throw new ValidationError("Path file tidak valid");
  }

  return readFile(/*turbopackIgnore: true*/ resolved);
}

export async function checkPrivateStorage() {
  const storageRoot = resolveStorageRoot();
  const probePath = path.join(storageRoot, `.health-${randomUUID()}.tmp`);

  await mkdir(storageRoot, { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ probePath, "ok", { flag: "wx" });
  await unlink(/*turbopackIgnore: true*/ probePath);
}

export async function removePrivateFile(storagePath: string) {
  const storageRoot = resolveStorageRoot();
  const resolved = path.resolve(/*turbopackIgnore: true*/ storagePath);
  const relative = path.relative(storageRoot, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ValidationError("Path file tidak valid");
  }

  await unlink(/*turbopackIgnore: true*/ resolved).catch(() => undefined);
}
