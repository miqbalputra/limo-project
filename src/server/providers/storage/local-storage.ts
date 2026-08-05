import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AssignmentSubmissionType } from "@prisma/client";
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

const allowedRppTypes = new Map([
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
]);

const allowedRppExtensions = new Map([
  ["application/pdf", new Set(["pdf"])],
  ["application/msword", new Set(["doc"])],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", new Set(["docx"])],
]);

const allowedAssignmentTypes = new Map<AssignmentSubmissionType, Map<string, Set<string>>>([
  ["FILE", new Map([
    ["application/pdf", new Set(["pdf"])],
    ["application/msword", new Set(["doc"])],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", new Set(["docx"])],
    ["text/plain", new Set(["txt"])],
  ])],
  ["IMAGE", new Map([
    ["image/jpeg", new Set(["jpg", "jpeg"])],
    ["image/png", new Set(["png"])],
    ["image/webp", new Set(["webp"])],
  ])],
  ["AUDIO", new Map([
    ["audio/mpeg", new Set(["mp3"])],
    ["audio/wav", new Set(["wav"])],
    ["audio/ogg", new Set(["ogg"])],
    ["audio/webm", new Set(["webm"])],
  ])],
  ["VIDEO", new Map([
    ["video/mp4", new Set(["mp4"])],
    ["video/webm", new Set(["webm"])],
    ["video/quicktime", new Set(["mov"])],
  ])],
]);

function baseMimeType(value: string) {
  return value.split(";", 1)[0].trim().toLowerCase();
}

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

  return path.resolve(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ process.cwd(), configuredPath));
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

function validateRppMagicBytes(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "application/pdf") {
    validateMagicBytes(bytes, mimeType);
    return;
  }

  const header = Array.from(bytes.slice(0, 4));
  const isLegacyWord = header.join(",") === "208,207,17,224";
  const isDocx = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  if (!isLegacyWord && !isDocx) {
    throw new ValidationError("Isi file Word RPP tidak valid");
  }
}

function validateAssignmentMagicBytes(bytes: Uint8Array, mimeType: string) {
  mimeType = baseMimeType(mimeType);
  if (mimeType === "text/plain") return;
  if (mimeType === "application/pdf" || mimeType === "image/jpeg" || mimeType === "image/png") {
    validateMagicBytes(bytes, mimeType);
    return;
  }

  if (mimeType === "image/webp") {
    const header = Buffer.from(bytes.slice(0, 12)).toString("ascii");
    if (!header.startsWith("RIFF") || header.slice(8, 12) !== "WEBP") throw new ValidationError("Isi file WebP tidak valid");
    return;
  }

  if (mimeType === "application/msword") {
    if (bytes[0] !== 0xd0 || bytes[1] !== 0xcf || bytes[2] !== 0x11 || bytes[3] !== 0xe0) throw new ValidationError("Isi file DOC tidak valid");
    return;
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) throw new ValidationError("Isi file DOCX tidak valid");
    return;
  }

  if (mimeType === "audio/mpeg") {
    const header = Buffer.from(bytes.slice(0, 3)).toString("ascii");
    if (header !== "ID3" && !(bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) throw new ValidationError("Isi file MP3 tidak valid");
    return;
  }

  if (mimeType === "audio/wav") {
    const header = Buffer.from(bytes.slice(0, 12)).toString("ascii");
    if (!header.startsWith("RIFF") || header.slice(8, 12) !== "WAVE") throw new ValidationError("Isi file WAV tidak valid");
    return;
  }

  if (mimeType === "audio/ogg") {
    if (Buffer.from(bytes.slice(0, 4)).toString("ascii") !== "OggS") throw new ValidationError("Isi file OGG tidak valid");
    return;
  }

  if (mimeType === "audio/webm" || mimeType === "video/webm") {
    if (bytes[0] !== 0x1a || bytes[1] !== 0x45 || bytes[2] !== 0xdf || bytes[3] !== 0xa3) throw new ValidationError("Isi file WebM tidak valid");
    return;
  }

  if (mimeType === "video/mp4" || mimeType === "video/quicktime") {
    if (Buffer.from(bytes.slice(4, 8)).toString("ascii") !== "ftyp") throw new ValidationError("Isi file video tidak valid");
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

export async function storeRppFile(file: File, folder: string): Promise<StoredFile> {
  const env = getEnv();
  const extension = allowedRppTypes.get(file.type);
  const fileExtension = path.extname(file.name).slice(1).toLowerCase();
  if (file.size < 1) throw new ValidationError("File RPP kosong");
  if (file.size > env.MAX_RPP_FILE_MB * 1024 * 1024) throw new ValidationError(`Ukuran file RPP maksimal ${env.MAX_RPP_FILE_MB} MB`);
  if (!extension || !allowedRppExtensions.get(file.type)?.has(fileExtension)) throw new ValidationError("File RPP harus berupa PDF, DOC, atau DOCX dengan ekstensi yang sesuai");
  const bytes = new Uint8Array(await file.arrayBuffer());
  validateRppMagicBytes(bytes, file.type);
  return writePrivateFile({ file, folder, extension, bytes });
}

export function validateAssignmentFile(input: { name: string; type: string; size: number; submissionType: AssignmentSubmissionType }) {
  const env = getEnv();
  const maxBytes = env.MAX_ASSIGNMENT_FILE_MB * 1024 * 1024;
  if (input.submissionType === "ONLINE_TEXT" || input.submissionType === "EXTERNAL_LINK" || input.submissionType === "OFFLINE_ACTIVITY") {
    throw new ValidationError("Tipe tugas ini tidak menerima file");
  }
  if (input.size < 1) throw new ValidationError("File submission kosong");
  if (input.size > maxBytes) throw new ValidationError(`Ukuran file submission maksimal ${env.MAX_ASSIGNMENT_FILE_MB} MB`);
  const types = allowedAssignmentTypes.get(input.submissionType);
  const mimeType = baseMimeType(input.type);
  const extension = path.extname(input.name).slice(1).toLowerCase();
  if (!types?.has(mimeType)) throw new ValidationError("Tipe file tidak diizinkan untuk tipe tugas ini");
  if (!types.get(mimeType)?.has(extension)) throw new ValidationError("Ekstensi file tidak sesuai dengan tipe tugas");
  return extension;
}

export async function storeAssignmentFile(file: File, folder: string, submissionType: AssignmentSubmissionType): Promise<StoredFile> {
  const extension = validateAssignmentFile({ name: file.name, type: file.type, size: file.size, submissionType });
  const bytes = new Uint8Array(await file.arrayBuffer());
  validateAssignmentMagicBytes(bytes, file.type);
  return writePrivateFile({ file, folder, extension, bytes });
}

async function writePrivateFile(input: { file: File; folder: string; extension: string; bytes: Uint8Array }): Promise<StoredFile> {
  const safeFolder = input.folder.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageRoot = resolveStorageRoot();
  const storageDir = path.join(/*turbopackIgnore: true*/ storageRoot, safeFolder);
  const storedName = `${randomUUID()}.${input.extension}`;
  const storagePath = path.join(/*turbopackIgnore: true*/ storageDir, storedName);

  await mkdir(/*turbopackIgnore: true*/ storageDir, { recursive: true });
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
  const probePath = path.join(/*turbopackIgnore: true*/ storageRoot, `.health-${randomUUID()}.tmp`);

  await mkdir(/*turbopackIgnore: true*/ storageRoot, { recursive: true });
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
