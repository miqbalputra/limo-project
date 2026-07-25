import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { getEnv } from "@/server/env";
import { ForbiddenError, ValidationError } from "@/server/errors/application-error";
import { timingSafeCompareText } from "@/server/security/crypto";

export const pakasirWebhookSchema = z.object({
  eventId: z.string().min(1).max(200).optional(),
  project: z.string().min(1).max(200),
  reference: z.string().min(1).max(200).optional(),
  order_id: z.string().min(1).max(200).optional(),
  amount: z.coerce.number().positive(),
  status: z.string().min(1).max(64),
  paymentMethod: z.string().max(64).optional(),
  payment_method: z.string().max(64).optional(),
  paidAt: z.string().datetime({ offset: true }).optional(),
  completed_at: z.string().datetime({ offset: true }).optional(),
});

export type VerifiedPakasirEvent = {
  eventId: string;
  project: string;
  reference: string;
  amount: number;
  status: string;
  paymentMethod?: string;
  paidAt?: string;
};

export function verifyPakasirWebhook(input: { rawBody: string; signature: string | null }) {
  const env = getEnv();

  if (env.PAKASIR_WEBHOOK_SECRET) {
    if (!input.signature) {
      throw new ForbiddenError("Signature webhook tidak tersedia");
    }

    const expected = createHmac("sha256", env.PAKASIR_WEBHOOK_SECRET).update(input.rawBody).digest("hex");

    if (!timingSafeCompareText(expected, input.signature)) {
      throw new ForbiddenError("Signature webhook tidak valid");
    }
  }

  const parsedJson = JSON.parse(input.rawBody) as unknown;
  const parsed = pakasirWebhookSchema.safeParse(parsedJson);

  if (!parsed.success) {
    throw new ValidationError("Payload webhook tidak valid", parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.project !== env.PAKASIR_PROJECT) {
    throw new ForbiddenError("Project webhook tidak valid");
  }

  const reference = parsed.data.reference || parsed.data.order_id;

  if (!reference) {
    throw new ValidationError("Order ID webhook tidak tersedia");
  }

  return {
    eventId: parsed.data.eventId || `${parsed.data.project}-${reference}-${parsed.data.status}`,
    project: parsed.data.project,
    reference,
    amount: parsed.data.amount,
    status: parsed.data.status,
    paymentMethod: parsed.data.paymentMethod || parsed.data.payment_method,
    paidAt: parsed.data.paidAt || parsed.data.completed_at,
  };
}

export function isPaidPakasirStatus(status: string) {
  return ["paid", "success", "settlement", "completed"].includes(status.toLowerCase());
}

export function createPakasirPaymentUrl(input: { tagihanId: string; amount: number | string; redirectPath?: string }) {
  const env = getEnv();

  if (!env.PAKASIR_PROJECT) {
    return null;
  }

  const url = new URL(`https://app.pakasir.com/pay/${encodeURIComponent(env.PAKASIR_PROJECT)}/${Math.round(Number(input.amount))}`);
  url.searchParams.set("order_id", input.tagihanId);
  url.searchParams.set("redirect", new URL(input.redirectPath || "/wali/tagihan", env.APP_URL).toString());

  return url.toString();
}

const pakasirTransactionSchema = z.object({
  payment: z.object({
    project: z.string(),
    order_id: z.string(),
    amount: z.coerce.number(),
    fee: z.coerce.number().optional(),
    total_payment: z.coerce.number().optional(),
    payment_method: z.string(),
    payment_number: z.string(),
    expired_at: z.string().optional(),
  }),
});

const pakasirTransactionDetailSchema = z.object({
  transaction: z.object({
    project: z.string(),
    order_id: z.string(),
    amount: z.coerce.number(),
    status: z.string(),
    payment_method: z.string().optional(),
    completed_at: z.string().datetime({ offset: true }).optional(),
  }),
});

export async function createPakasirTransaction(input: { tagihanId: string; amount: number | string; method: string }) {
  const env = getEnv();
  const paymentUrl = createPakasirPaymentUrl({ tagihanId: input.tagihanId, amount: input.amount });

  if (!env.PAKASIR_PROJECT) {
    throw new ValidationError("Project Pakasir belum dikonfigurasi");
  }

  if (!env.PAKASIR_API_KEY) {
    return { mode: "redirect" as const, paymentUrl, payment: null };
  }

  const response = await fetch(`https://app.pakasir.com/api/transactioncreate/${encodeURIComponent(input.method)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project: env.PAKASIR_PROJECT,
      order_id: input.tagihanId,
      amount: Math.round(Number(input.amount)),
      api_key: env.PAKASIR_API_KEY,
    }),
  });

  const payload = await response.json().catch(() => null) as unknown;

  if (!response.ok) {
    throw new ValidationError("Transaksi Pakasir gagal dibuat");
  }

  const parsed = pakasirTransactionSchema.safeParse(payload);

  if (!parsed.success) {
    throw new ValidationError("Respons Pakasir tidak valid", parsed.error.flatten().fieldErrors);
  }

  return { mode: "api" as const, paymentUrl, payment: parsed.data.payment };
}

export async function verifyPakasirTransactionDetail(event: VerifiedPakasirEvent) {
  const env = getEnv();

  if (!env.PAKASIR_API_KEY) {
    return null;
  }

  const url = new URL("https://app.pakasir.com/api/transactiondetail");
  url.searchParams.set("project", env.PAKASIR_PROJECT);
  url.searchParams.set("amount", String(Math.round(event.amount)));
  url.searchParams.set("order_id", event.reference);
  url.searchParams.set("api_key", env.PAKASIR_API_KEY);

  const response = await fetch(url);
  const payload = await response.json().catch(() => null) as unknown;

  if (!response.ok) {
    throw new ValidationError("Detail transaksi Pakasir gagal diverifikasi");
  }

  const parsed = pakasirTransactionDetailSchema.safeParse(payload);

  if (!parsed.success) {
    throw new ValidationError("Respons detail transaksi Pakasir tidak valid", parsed.error.flatten().fieldErrors);
  }

  const detail = parsed.data.transaction;

  if (detail.project !== event.project || detail.order_id !== event.reference || Number(detail.amount) !== Number(event.amount)) {
    throw new ValidationError("Detail transaksi Pakasir tidak sesuai webhook");
  }

  return detail;
}
