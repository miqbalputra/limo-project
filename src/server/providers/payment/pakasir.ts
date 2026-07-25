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
  paidAt: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
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

  if (!env.PAKASIR_WEBHOOK_SECRET) {
    throw new ForbiddenError("Webhook secret belum dikonfigurasi");
  }

  if (!input.signature) {
    throw new ForbiddenError("Signature webhook tidak tersedia");
  }

  const expected = createHmac("sha256", env.PAKASIR_WEBHOOK_SECRET).update(input.rawBody).digest("hex");

  if (!timingSafeCompareText(expected, input.signature)) {
    throw new ForbiddenError("Signature webhook tidak valid");
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
