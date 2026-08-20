import { createHash } from "node:crypto";
import { z } from "zod";
import { ForbiddenError, ProviderError, ValidationError } from "../../errors/application-error.ts";
import { timingSafeCompareText } from "../../security/crypto.ts";
import type { PaymentCreationInput, PaymentGatewayRuntimeConfig } from "./types";

const PAKASIR_BASE_URL = "https://app.pakasir.com";
const PAKASIR_REQUEST_TIMEOUT_MS = 15_000;

const pakasirWebhookSchema = z.object({
  amount: z.coerce.number(),
  order_id: z.string().min(1).max(191),
  project: z.string().min(1).max(191),
  status: z.string().min(1).max(64),
  payment_method: z.string().optional(),
  completed_at: z.string().optional(),
});

function getApiKey(config: PaymentGatewayRuntimeConfig) {
  if (!config.apiKey) throw new ValidationError("API key Pakasir belum dikonfigurasi");
  return config.apiKey;
}

function getProjectSlug(config: PaymentGatewayRuntimeConfig) {
  if (!config.projectSlug) throw new ValidationError("Project slug Pakasir belum dikonfigurasi");
  return config.projectSlug;
}

function getWebhookSecret(config: PaymentGatewayRuntimeConfig) {
  if (!config.webhookSecret) throw new ValidationError("Webhook secret Pakasir belum dikonfigurasi");
  return config.webhookSecret;
}

function normalizeMethod(method?: string) {
  return method === "qris" ? "qris" : "all";
}

function getAmount(input: PaymentCreationInput) {
  const amount = Math.round(Number(input.amount));
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new ValidationError("Nominal tagihan belum valid", { amount: ["Nominal tagihan harus berupa bilangan rupiah positif"] });
  }
  return amount;
}

export function createPakasirPayment(input: PaymentCreationInput & { orderId: string }, config: PaymentGatewayRuntimeConfig) {
  const project = getProjectSlug(config);
  const amount = getAmount(input);
  const method = normalizeMethod(input.paymentMethod);
  const url = new URL(`/pay/${encodeURIComponent(project)}/${amount}`, PAKASIR_BASE_URL);
  url.searchParams.set("order_id", input.orderId);
  if (input.redirectUrl) url.searchParams.set("redirect", input.redirectUrl);
  if (method === "qris") url.searchParams.set("qris_only", "1");

  return {
    provider: "pakasir" as const,
    providerReference: input.orderId,
    paymentUrl: url.toString(),
    paymentMethod: method,
    expiresAt: null,
    rawPayload: {
      source: "pakasir-hosted-checkout",
      project,
      orderId: input.orderId,
      amount,
      paymentMethod: method,
      paymentUrl: url.toString(),
    },
  };
}

async function requestPakasir(path: string, config: PaymentGatewayRuntimeConfig, action: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAKASIR_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${PAKASIR_BASE_URL}${path}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const payload = await response.json().catch(() => null) as unknown;
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new ProviderError("API key Pakasir ditolak");
      throw new ProviderError(`Pakasir gagal ${action} (${response.status})`);
    }
    return payload;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new ProviderError(`Pakasir tidak merespons saat ${action}`);
    throw new ProviderError(`Pakasir tidak dapat dihubungi saat ${action}`);
  } finally {
    clearTimeout(timeout);
  }
}

const pakasirTransactionSchema = z.object({
  transaction: z.object({
    amount: z.coerce.number(),
    order_id: z.string(),
    project: z.string(),
    status: z.string(),
    payment_method: z.string().optional(),
    completed_at: z.string().optional(),
  }),
});

export async function getPakasirTransaction(input: { orderId: string; amount: number | string }, config: PaymentGatewayRuntimeConfig) {
  const project = getProjectSlug(config);
  const amount = Math.round(Number(input.amount));
  const query = new URLSearchParams({ project, amount: String(amount), order_id: input.orderId, api_key: getApiKey(config) });
  const payload = await requestPakasir(`/api/transactiondetail?${query.toString()}`, config, "membaca status transaksi");
  const parsed = pakasirTransactionSchema.safeParse(payload);
  if (!parsed.success) throw new ProviderError("Respons detail transaksi Pakasir tidak valid");
  return { ...parsed.data.transaction, rawPayload: parsed.data };
}

export async function testPakasirConnection(config: PaymentGatewayRuntimeConfig) {
  const project = getProjectSlug(config);
  const query = new URLSearchParams({ project, amount: "1", order_id: `LIMO-CONNECTION-${Date.now()}`, api_key: getApiKey(config) });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAKASIR_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${PAKASIR_BASE_URL}/api/transactiondetail?${query.toString()}`, { cache: "no-store", signal: controller.signal, headers: { Accept: "application/json" } });
    if (response.status === 401 || response.status === 403) throw new ProviderError("API key Pakasir ditolak");
    if (response.status >= 500) throw new ProviderError("Pakasir mengalami gangguan saat uji koneksi");
    return { success: true, message: "Koneksi Pakasir berhasil diverifikasi; transaksi uji tidak dibuat." };
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new ProviderError("Pakasir tidak merespons saat uji koneksi");
    throw new ProviderError("Pakasir tidak dapat dihubungi saat uji koneksi");
  } finally {
    clearTimeout(timeout);
  }
}

export type VerifiedPakasirEvent = {
  eventId: string;
  orderId: string;
  project: string;
  amount: number;
  paymentMethod?: string;
  completedAt?: Date;
  status: string;
};

export function verifyPakasirWebhook(input: { rawBody: string; secret: string | null }, config: PaymentGatewayRuntimeConfig): VerifiedPakasirEvent {
  const expectedSecret = getWebhookSecret(config);
  if (!input.secret || !timingSafeCompareText(expectedSecret, input.secret)) throw new ValidationError("Secret webhook Pakasir tidak valid");
  let json: unknown;
  try {
    json = JSON.parse(input.rawBody);
  } catch {
    throw new ValidationError("Payload webhook Pakasir bukan JSON yang valid");
  }
  const parsed = pakasirWebhookSchema.safeParse(json);
  if (!parsed.success) throw new ValidationError("Payload webhook Pakasir tidak valid", parsed.error.flatten().fieldErrors);
  if (parsed.data.project !== getProjectSlug(config)) throw new ForbiddenError("Project Pakasir pada webhook tidak valid");
  const completedAt = parsed.data.completed_at ? new Date(parsed.data.completed_at) : undefined;
  return {
    eventId: createHash("sha256").update(input.rawBody).digest("hex"),
    orderId: parsed.data.order_id,
    project: parsed.data.project,
    amount: parsed.data.amount,
    paymentMethod: parsed.data.payment_method,
    completedAt: completedAt && !Number.isNaN(completedAt.getTime()) ? completedAt : undefined,
    status: parsed.data.status,
  };
}

export function isPaidPakasirEvent(status: string) {
  return ["completed", "paid", "success", "settlement"].includes(status.toLowerCase());
}
