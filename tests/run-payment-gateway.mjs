import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

Object.assign(process.env, {
  NODE_ENV: "test",
  APP_URL: "https://limo.example.com",
  DATABASE_URL: "file:./test.db",
  SESSION_SECRET: "test-session-secret-that-is-at-least-32-chars",
  PRIVATE_STORAGE_PATH: "./storage/private",
  PAYMENT_CONFIG_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  // Mayar webhook secret DISENGAJAAN kosong sejak sebelum import pertama agar
  // cache getEnv() membaca tanpa secret — test "secret belum dikonfigurasi"
  // mengandalkan ini; jalur positif memakai secret dari konfigurasi runtime.
  MAYAR_WEBHOOK_SECRET: "",
});

const { encryptPaymentCredentials, decryptPaymentCredentials } = await import("../src/server/security/payment-config.ts");

const encrypted = encryptPaymentCredentials({ apiKey: "mayar-api-key", webhookSecret: "mayar-secret" });
assert.notEqual(encrypted.includes("mayar-api-key"), true);
assert.deepEqual(decryptPaymentCredentials(encrypted), { apiKey: "mayar-api-key", webhookSecret: "mayar-secret" });

const config = {
  provider: "mayar",
  enabled: true,
  isPrimary: true,
  environment: "sandbox",
  apiKey: "mayar-api-key",
  webhookSecret: "mayar-db-secret",
  source: "database",
};

// Mayar: secret webhook wajib — tanpa konfigurasi secret, webhook harus DITOLAK
// (sebelumnya verifikasi dilewati total sehingga event bisa dipalsukan).
const { verifyMayarWebhook } = await import("../src/server/providers/payment/mayar.ts");
const suiteMerchantId = process.env.MAYAR_MERCHANT_ID || "";
const mayarConfig = { ...config, webhookSecret: "mayar-db-secret", merchantId: suiteMerchantId };
const mayarBody = JSON.stringify({ event: "payment.received", data: { id: "inv-1", transactionStatus: "PAID", amount: 125000, merchantId: suiteMerchantId || undefined, extraData: { tagihanId: "ctagihan123456" } } });
const mayarEvent = verifyMayarWebhook({ rawBody: mayarBody, secret: "mayar-db-secret" }, mayarConfig);
assert.equal(mayarEvent.event, "payment.received");
assert.equal(mayarEvent.tagihanId, "ctagihan123456");
assert.throws(() => verifyMayarWebhook({ rawBody: mayarBody, secret: "wrong-secret" }, mayarConfig), /Secret webhook Mayar tidak valid/);
assert.throws(() => verifyMayarWebhook({ rawBody: mayarBody, secret: null }, mayarConfig), /Secret webhook Mayar tidak valid/);
// Secret belum dikonfigurasi di DB maupun env → ditolak, bukan dilewati.
assert.throws(() => verifyMayarWebhook({ rawBody: mayarBody, secret: "anything" }, { ...mayarConfig, webhookSecret: "" }), /belum dikonfigurasi/);

console.log("ok - payment gateway encryption, webhook validation, and mandatory Mayar webhook secret");
