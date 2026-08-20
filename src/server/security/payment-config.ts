import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getEnv } from "../env.ts";
import { ValidationError } from "../errors/application-error.ts";

type EncryptedEnvelope = {
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  ciphertext: string;
};

function getEncryptionKey() {
  const encoded = getEnv().PAYMENT_CONFIG_ENCRYPTION_KEY.trim();
  if (!encoded) {
    throw new ValidationError("PAYMENT_CONFIG_ENCRYPTION_KEY belum dikonfigurasi di environment aplikasi");
  }

  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new ValidationError("PAYMENT_CONFIG_ENCRYPTION_KEY harus berupa base64 dari tepat 32 byte");
  }

  return key;
}

export function encryptPaymentCredentials(value: Record<string, string>) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const envelope: EncryptedEnvelope = {
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
  return JSON.stringify(envelope);
}

export function decryptPaymentCredentials(value: string) {
  let envelope: EncryptedEnvelope;
  try {
    envelope = JSON.parse(value) as EncryptedEnvelope;
  } catch {
    throw new ValidationError("Konfigurasi credential payment gateway rusak atau tidak valid");
  }

  if (envelope.algorithm !== "aes-256-gcm" || !envelope.iv || !envelope.authTag || !envelope.ciphertext) {
    throw new ValidationError("Format credential payment gateway tidak valid");
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(envelope.iv, "base64"));
    decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
    const credentials = JSON.parse(plaintext) as Record<string, unknown>;
    if (!credentials || typeof credentials !== "object" || Array.isArray(credentials)) {
      throw new Error("credentials bukan object");
    }
    return Object.fromEntries(Object.entries(credentials).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    throw new ValidationError("Credential payment gateway tidak dapat dibuka; pastikan PAYMENT_CONFIG_ENCRYPTION_KEY tidak berubah");
  }
}
