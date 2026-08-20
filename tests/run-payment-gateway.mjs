import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

Object.assign(process.env, {
  NODE_ENV: "test",
  APP_URL: "https://limo.example.com",
  DATABASE_URL: "file:./test.db",
  SESSION_SECRET: "test-session-secret-that-is-at-least-32-chars",
  PRIVATE_STORAGE_PATH: "./storage/private",
  PAYMENT_CONFIG_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
});

const { encryptPaymentCredentials, decryptPaymentCredentials } = await import("../src/server/security/payment-config.ts");
const { createPakasirPayment, verifyPakasirWebhook, isPaidPakasirEvent } = await import("../src/server/providers/payment/pakasir.ts");

const encrypted = encryptPaymentCredentials({ apiKey: "pakasir-api-key", webhookSecret: "pakasir-secret" });
assert.notEqual(encrypted.includes("pakasir-api-key"), true);
assert.deepEqual(decryptPaymentCredentials(encrypted), { apiKey: "pakasir-api-key", webhookSecret: "pakasir-secret" });

const config = {
  provider: "pakasir",
  enabled: true,
  isPrimary: true,
  environment: "sandbox",
  projectSlug: "limoedu",
  apiKey: "pakasir-api-key",
  webhookSecret: "pakasir-secret",
  source: "database",
};
const payment = createPakasirPayment({
  tagihanId: "ctagihan123456",
  orderId: "LIMO-ctagihan123456-test",
  name: "Wali Siswa",
  email: "wali@example.com",
  mobile: "081234567890",
  description: "SPP Agustus",
  amount: 125000,
  expiredAt: new Date(Date.now() + 86_400_000),
  paymentMethod: "qris",
}, config);
assert.match(payment.paymentUrl, /^https:\/\/app\.pakasir\.com\/pay\/limoedu\/125000\?/);
assert.match(payment.paymentUrl, /qris_only=1/);
assert.equal(payment.providerReference, "LIMO-ctagihan123456-test");

const allMethodsPayment = createPakasirPayment({
  tagihanId: "ctagihan123456",
  orderId: "LIMO-ctagihan123456-all",
  name: "Wali Siswa",
  email: "wali@example.com",
  mobile: "081234567890",
  description: "SPP Agustus",
  amount: 125000,
  expiredAt: new Date(Date.now() + 86_400_000),
  paymentMethod: "all",
}, config);
assert.doesNotMatch(allMethodsPayment.paymentUrl, /qris_only/);
assert.equal(allMethodsPayment.paymentMethod, "all");

const event = verifyPakasirWebhook({
  rawBody: JSON.stringify({ amount: 125000, order_id: payment.providerReference, project: "limoedu", status: "completed", payment_method: "qris", completed_at: "2026-08-21T00:00:00.000Z" }),
  secret: "pakasir-secret",
}, config);
assert.equal(event.orderId, payment.providerReference);
assert.equal(event.amount, 125000);
assert.equal(isPaidPakasirEvent(event.status), true);
assert.throws(() => verifyPakasirWebhook({ rawBody: JSON.stringify({ amount: 125000, order_id: payment.providerReference, project: "limoedu", status: "completed" }), secret: "wrong" }, config));
assert.throws(() => verifyPakasirWebhook({ rawBody: JSON.stringify({ amount: 125000, order_id: payment.providerReference, project: "other-project", status: "completed" }), secret: "pakasir-secret" }, config));
assert.equal(isPaidPakasirEvent("pending"), false);

console.log("ok - payment gateway encryption, Pakasir checkout URL, and webhook validation");
