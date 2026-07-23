import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { getEnv } from "@/server/env";
import { ForbiddenError, ValidationError } from "@/server/errors/application-error";
import { timingSafeCompareText } from "@/server/security/crypto";

export const pakasirWebhookSchema = z.object({
  eventId: z.string().min(1).max(200),
  project: z.string().min(1).max(200),
  reference: z.string().min(1).max(200),
  amount: z.coerce.number().positive(),
  status: z.string().min(1).max(64),
  paymentMethod: z.string().max(64).optional(),
  paidAt: z.string().datetime().optional(),
});

export type VerifiedPakasirEvent = z.infer<typeof pakasirWebhookSchema>;

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

  return parsed.data;
}

export function isPaidPakasirStatus(status: string) {
  return ["paid", "success", "settlement", "completed"].includes(status.toLowerCase());
}
