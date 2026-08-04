import { createHash } from "node:crypto";
import { z } from "zod";
import { getEnv } from "../../env.ts";
import { ForbiddenError, ProviderError, ValidationError } from "../../errors/application-error.ts";
import { timingSafeCompareText } from "../../security/crypto.ts";

const mayarCreateResponseSchema = z.object({
  statusCode: z.number(),
  messages: z.string().optional(),
  message: z.string().optional(),
  data: z.object({
    id: z.string().min(1),
    transactionId: z.string().min(1),
    link: z.string().url(),
    expiredAt: z.coerce.number().optional(),
    extraData: z.unknown().optional(),
  }),
});

const mayarInvoiceDetailSchema = z.object({
  statusCode: z.number(),
  messages: z.string().optional(),
  data: z.object({
    id: z.string().min(1),
    amount: z.coerce.number(),
    status: z.string(),
    expiredAt: z.coerce.number().optional(),
    transactionId: z.string().optional(),
    paymentLinkId: z.string().optional(),
    paymentUrl: z.string().url().optional(),
  }),
});

const mayarWebhookSchema = z.object({
  event: z.string().min(1).max(128),
  data: z.record(z.string(), z.unknown()),
});

function getBaseUrl() {
  const env = getEnv();
  return env.MAYAR_BASE_URL || (env.MAYAR_ENV === "production" ? "https://api.mayar.id/hl/v2" : "https://api.mayar.io/hl/v2");
}

function getApiKey() {
  const apiKey = getEnv().MAYAR_API_KEY;
  if (!apiKey) {
    throw new ValidationError("MAYAR_API_KEY belum dikonfigurasi");
  }

  return apiKey;
}

export function isMayarConfigured() {
  return Boolean(getEnv().MAYAR_API_KEY);
}

function isValidMobile(value: string) {
  return value.replace(/[\s-]/g, "").length >= 8;
}

export async function createMayarInvoice(input: {
  tagihanId: string;
  name: string;
  email: string;
  mobile: string;
  description: string;
  amount: number | string;
  expiredAt: Date;
  paymentMethod?: string;
}) {
  if (!isValidMobile(input.mobile)) {
    throw new ValidationError("Nomor WhatsApp Wali belum tersedia atau belum valid", { mobile: ["Nomor WhatsApp Wali wajib diisi untuk membuat invoice Mayar"] });
  }

  const paymentMethod = input.paymentMethod && input.paymentMethod !== "all" ? input.paymentMethod : undefined;
  const response = await fetch(`${getBaseUrl()}/invoices/create`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getApiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      mobile: input.mobile,
      description: input.description,
      expiredAt: input.expiredAt.toISOString(),
      items: [{ quantity: 1, rate: Math.round(Number(input.amount)), description: input.description }],
      ...(paymentMethod ? { paymentMethod } : {}),
      extraData: { tagihanId: input.tagihanId, source: "limo" },
    }),
  });
  const payload = await response.json().catch(() => null) as unknown;

  if (!response.ok) {
    throw new ProviderError(`Mayar gagal membuat invoice (${response.status})`);
  }

  const parsed = mayarCreateResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ProviderError("Respons invoice Mayar tidak valid");
  }

  return {
    provider: "mayar" as const,
    invoiceId: parsed.data.data.id,
    transactionId: parsed.data.data.transactionId,
    paymentUrl: parsed.data.data.link,
    expiresAt: parsed.data.data.expiredAt ? new Date(parsed.data.data.expiredAt) : input.expiredAt,
    rawPayload: parsed.data,
  };
}

export async function getMayarInvoice(invoiceId: string) {
  const response = await fetch(`${getBaseUrl()}/invoices/${encodeURIComponent(invoiceId)}`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });
  const payload = await response.json().catch(() => null) as unknown;

  if (!response.ok) {
    throw new ProviderError(`Mayar gagal membaca invoice (${response.status})`);
  }

  const parsed = mayarInvoiceDetailSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ProviderError("Respons detail invoice Mayar tidak valid");
  }

  return {
    ...parsed.data.data,
    rawPayload: parsed.data,
  };
}

export type VerifiedMayarEvent = {
  event: string;
  eventId: string;
  referenceIds: string[];
  tagihanId?: string;
  merchantId?: string;
  amount?: number;
  paymentMethod?: string;
  paidAt?: Date;
  status: string;
};

export function verifyMayarWebhook(input: { rawBody: string; secret: string | null }) {
  const expectedSecret = getEnv().MAYAR_WEBHOOK_SECRET;
  if (expectedSecret && (!input.secret || !timingSafeCompareText(expectedSecret, input.secret))) {
    throw new ValidationError("Secret webhook Mayar tidak valid");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(input.rawBody);
  } catch {
    throw new ValidationError("Payload webhook Mayar bukan JSON yang valid");
  }

  const parsed = mayarWebhookSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new ValidationError("Payload webhook Mayar tidak valid", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data.data;
  const dataString = (key: string) => typeof data[key] === "string" ? data[key] as string : undefined;
  const numberValue = (key: string) => typeof data[key] === "number" || typeof data[key] === "string" ? Number(data[key]) : undefined;
  const extraData = data.extraData && typeof data.extraData === "object" && !Array.isArray(data.extraData) ? data.extraData as Record<string, unknown> : undefined;
  const eventId = dataString("id") || dataString("transactionId") || createHash("sha256").update(input.rawBody).digest("hex");
  const referenceIds = [dataString("id"), dataString("transactionId"), dataString("invoiceId"), dataString("paymentLinkId")].filter((value): value is string => Boolean(value));
  const tagihanId = typeof extraData?.tagihanId === "string" ? extraData.tagihanId : dataString("tagihanId");
  const merchantId = dataString("merchantId") || dataString("userId");
  const expectedMerchantId = getEnv().MAYAR_MERCHANT_ID;
  if (expectedMerchantId && merchantId !== expectedMerchantId) {
    throw new ForbiddenError("Merchant Mayar pada webhook tidak valid");
  }
  const updatedAt = dataString("updatedAt") || dataString("paidAt");

  return {
    event: parsed.data.event,
    eventId,
    referenceIds: [...new Set(referenceIds)],
    tagihanId,
    merchantId,
    amount: numberValue("amount"),
    paymentMethod: dataString("paymentMethod") || dataString("payment_method"),
    paidAt: updatedAt ? new Date(updatedAt) : undefined,
    status: typeof data.status === "string" ? data.status : typeof data.transactionStatus === "string" ? data.transactionStatus : data.status === true ? "paid" : "",
  } satisfies VerifiedMayarEvent;
}

export function isPaidMayarEvent(input: { event: string; status?: string }) {
  return input.event === "payment.received" || ["paid", "success", "settlement", "completed"].includes((input.status || "").toLowerCase());
}
