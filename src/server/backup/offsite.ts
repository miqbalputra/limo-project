import { createHash, createHmac } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getEnv } from "../env.ts";

const REQUEST_TIMEOUT_MS = 120_000;

export type BackupOffsiteConfig = {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix: string;
};

export type OffsiteUploadObject = { key: string };
export type OffsiteUploadStatus =
  | { configured: false }
  | { configured: true; uploaded: true; objects: OffsiteUploadObject[] }
  | { configured: true; uploaded: false; error: string };

export function readBackupOffsiteConfig(): BackupOffsiteConfig | null {
  const env = getEnv();
  const endpoint = env.BACKUP_OFFSITE_ENDPOINT?.trim().replace(/\/+$/, "");
  const bucket = env.BACKUP_OFFSITE_BUCKET?.trim();
  const accessKeyId = env.BACKUP_OFFSITE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.BACKUP_OFFSITE_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  if (!/^https?:\/\//.test(endpoint)) throw new Error("BACKUP_OFFSITE_ENDPOINT harus berupa URL http(s)");
  return {
    endpoint,
    bucket,
    region: env.BACKUP_OFFSITE_REGION?.trim() || "us-east-1",
    accessKeyId,
    secretAccessKey,
    prefix: (env.BACKUP_OFFSITE_PREFIX?.trim() || "limo-backups").replace(/^\/+|\/+$/g, ""),
  };
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function amzDates(now: Date) {
  const iso = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

function canonicalUriFor(endpoint: URL, bucket: string, key: string) {
  const encode = (part: string) => part.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `/${encode(bucket)}/${encode(key)}`;
}

export type S3SignInput = {
  method: string;
  host: string;
  uri: string;
  headers: Record<string, string>;
  payloadHash: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  now: Date;
  service?: string;
};

export function buildS3CanonicalRequest(input: S3SignInput) {
  const sortedHeaders = Object.entries(input.headers)
    .map(([key, value]) => [key.toLowerCase(), value.trim().replace(/\s+/g, " ")] as const)
    .sort(([left], [right]) => left.localeCompare(right));
  const canonicalHeaders = sortedHeaders.map(([key, value]) => `${key}:${value}\n`).join("");
  const signedHeaders = sortedHeaders.map(([key]) => key).join(";");
  return {
    canonicalRequest: [input.method, input.uri, "", canonicalHeaders, signedHeaders, input.payloadHash].join("\n"),
    signedHeaders,
  };
}

export function signS3Request(input: S3SignInput) {
  const service = input.service || "s3";
  const { amzDate, dateStamp } = amzDates(input.now);
  const { canonicalRequest, signedHeaders } = buildS3CanonicalInputWithDate(input, amzDate);
  const scope = `${dateStamp}/${input.region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${input.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");
  return {
    amzDate,
    scope,
    signedHeaders,
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

function buildS3CanonicalInputWithDate(input: S3SignInput, amzDate: string) {
  return buildS3CanonicalRequest({
    ...input,
    headers: { ...input.headers, "x-amz-date": amzDate },
  });
}

async function putObject(config: BackupOffsiteConfig, objectKey: string, filePath: string, contentType: string) {
  const endpoint = new URL(config.endpoint);
  const host = endpoint.host;
  const uri = canonicalUriFor(endpoint, config.bucket, objectKey);
  const fileDetails = await stat(filePath);
  const { amzDate, authorization } = signS3Request({
    method: "PUT",
    host,
    uri,
    headers: {
      host,
      "content-length": String(fileDetails.size),
      "content-type": contentType,
      "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
    },
    payloadHash: "UNSIGNED-PAYLOAD",
    region: config.region,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    now: new Date(),
  });

  const url = `${config.endpoint}${uri}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "PUT",
      signal: controller.signal,
      headers: {
        Host: host,
        Authorization: authorization,
        "x-amz-date": amzDate,
        "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
        "Content-Type": contentType,
        "Content-Length": String(fileDetails.size),
      },
      body: Readable.toWeb(createReadStream(filePath)) as ReadableStream,
      // @ts-expect-error undici requires duplex for streaming request bodies
      duplex: "half",
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Unggah off-site gagal (${response.status}) untuk ${objectKey}: ${body.trim().slice(0, 240)}`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Unggah off-site timeout untuk ${objectKey}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function uploadBackupOffsite(
  input: { backupId: string; zipPath: string; manifestPath: string },
  config: BackupOffsiteConfig,
) {
  const objects: OffsiteUploadObject[] = [];
  const zipKey = `${config.prefix}/${input.backupId}/backup.zip`;
  const manifestKey = `${config.prefix}/${input.backupId}/manifest.json`;
  await putObject(config, zipKey, input.zipPath, "application/zip");
  objects.push({ key: zipKey });
  await putObject(config, manifestKey, input.manifestPath, "application/json");
  objects.push({ key: manifestKey });
  return objects;
}
