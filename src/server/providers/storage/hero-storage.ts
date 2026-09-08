import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "@/server/env";
import { ValidationError } from "@/server/errors/application-error";

const allowed = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const MAX_BYTES = 12 * 1024 * 1024;

function root() {
  const configured = getEnv().PRIVATE_STORAGE_PATH;
  return path.resolve(path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured));
}

function validateMagic(bytes: Uint8Array, mime: string) {
  if (mime === "image/jpeg" && (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff)) throw new ValidationError("Isi JPG hero tidak valid");
  if (mime === "image/png" && ![0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => bytes[i] === v)) throw new ValidationError("Isi PNG hero tidak valid");
  if (mime === "image/webp") {
    const header = Buffer.from(bytes.slice(0, 12)).toString("ascii");
    if (!header.startsWith("RIFF") || header.slice(8, 12) !== "WEBP") throw new ValidationError("Isi WebP hero tidak valid");
  }
}

export type StoredHeroImage = { storagePath: string; mimeType: string; checksumSha256: string };

export async function storeHeroImage(file: File, variant: "desktop" | "mobile"): Promise<StoredHeroImage> {
  const extension = allowed.get(file.type);
  if (!extension) throw new ValidationError("Gambar hero harus JPG, PNG, atau WebP");
  if (file.size < 1 || file.size > MAX_BYTES) throw new ValidationError("Ukuran gambar hero maksimal 12 MB");
  const bytes = new Uint8Array(await file.arrayBuffer());
  validateMagic(bytes, file.type);
  const dir = path.join(root(), "hero", variant);
  await mkdir(dir, { recursive: true });
  const storagePath = path.join(dir, `${randomUUID()}.${extension}`);
  await writeFile(storagePath, bytes, { flag: "wx" });
  return { storagePath, mimeType: file.type, checksumSha256: createHash("sha256").update(bytes).digest("hex") };
}

export async function readHeroImage(storagePath: string) {
  const resolved = path.resolve(storagePath);
  const privateBase = path.resolve(root(), "hero");
  const publicBase = path.resolve(process.cwd(), "public");
  // Izinkan dua sumber: storage privat (upload admin) dan aset publik (slide default yang di-seed).
  const isPrivate = resolved.startsWith(`${privateBase}${path.sep}`);
  const isPublicAsset = resolved.startsWith(`${publicBase}${path.sep}`);
  if (!isPrivate && !isPublicAsset) throw new ValidationError("Path hero tidak valid");
  return readFile(resolved);
}

export async function removeHeroImage(storagePath: string) {
  await unlink(storagePath).catch(() => undefined);
}
