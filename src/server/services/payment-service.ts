import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { canAccessInvoice } from "@/server/policies/access-policy";
import { createPakasirTransaction, isPaidPakasirStatus, verifyPakasirTransactionDetail, verifyPakasirWebhook } from "@/server/providers/payment/pakasir";

export async function processPakasirWebhook(input: { rawBody: string; signature: string | null }) {
  const event = verifyPakasirWebhook(input);
  const transactionDetail = await verifyPakasirTransactionDetail(event);
  const paymentStatus = transactionDetail?.status ?? event.status;
  const paymentMethod = transactionDetail?.payment_method ?? event.paymentMethod;
  const paidAt = transactionDetail?.completed_at ?? event.paidAt;
  const payloadHash = createHash("sha256").update(input.rawBody).digest("hex");

  const existingByPayload = await prisma.webhookEvent.findUnique({
    where: { payloadHash },
    select: { id: true, processedAt: true },
  });
  const existingByEvent = await prisma.webhookEvent.findUnique({
    where: { provider_providerEventId: { provider: "pakasir", providerEventId: event.eventId } },
    select: { id: true, processedAt: true },
  });
  const existing = existingByPayload || existingByEvent;

  if (existing?.processedAt) {
    return { duplicate: true, processed: true };
  }

  const tagihan = await prisma.tagihan.findUnique({
    where: { id: event.reference },
    select: { id: true, amount: true, status: true },
  });

  if (!tagihan) {
    throw new NotFoundError("Tagihan webhook tidak ditemukan");
  }

  if (Number(tagihan.amount) !== Number(event.amount)) {
    throw new ConflictError("Nominal webhook tidak sesuai tagihan");
  }

  await prisma.$transaction(async (tx) => {
    const webhook = existing
      ? await tx.webhookEvent.update({
          where: { id: existing.id },
          data: { processedAt: new Date() },
        })
      : await tx.webhookEvent.create({
          data: {
            provider: "pakasir",
            providerEventId: event.eventId,
            payloadHash,
            payload: JSON.parse(input.rawBody),
            processedAt: new Date(),
          },
        });

    if (isPaidPakasirStatus(paymentStatus)) {
      await tx.pembayaran.upsert({
        where: { providerReference: event.reference },
        update: {
          status: "PAID",
          amount: event.amount,
          paidAt: paidAt ? new Date(paidAt) : new Date(),
          rawPayload: JSON.parse(input.rawBody),
        },
        create: {
          tagihanId: tagihan.id,
          provider: "pakasir",
          providerReference: event.reference,
          amount: event.amount,
          status: "PAID",
          paymentMethod,
          paidAt: paidAt ? new Date(paidAt) : new Date(),
          rawPayload: JSON.parse(input.rawBody),
        },
      });

      await tx.tagihan.update({
        where: { id: tagihan.id },
        data: { status: "PAID", paidAt: paidAt ? new Date(paidAt) : new Date() },
      });

      await tx.notifikasi.create({
        data: {
          channel: "email",
          template: "payment-success",
          recipient: "admin@limo.local",
          subject: "Pembayaran diterima",
          body: `Pembayaran tagihan ${tagihan.id} telah diterima melalui Pakasir.`,
          metadata: { webhookEventId: webhook.id },
        },
      });
    }
  });

  return { duplicate: Boolean(existing), processed: true };
}

export async function createInvoicePayment(actor: Actor, tagihanId: string, input: unknown) {
  const allowed = actor.role === "ADMIN" || (await canAccessInvoice(actor, tagihanId));

  if (!allowed) {
    throw new ForbiddenError("Anda tidak memiliki akses ke tagihan ini");
  }

  const parsed = zCreateInvoicePayment.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Metode pembayaran belum valid", parsed.error.flatten().fieldErrors);
  }

  const tagihan = await prisma.tagihan.findUnique({ where: { id: tagihanId }, select: { id: true, amount: true, status: true } });

  if (!tagihan) {
    throw new NotFoundError("Tagihan tidak ditemukan");
  }

  if (tagihan.status === "PAID") {
    throw new ConflictError("Tagihan sudah dibayar");
  }

  const transaction = await createPakasirTransaction({ tagihanId, amount: tagihan.amount.toString(), method: parsed.data.method });

  await prisma.$transaction([
    prisma.pembayaran.upsert({
      where: { providerReference: tagihan.id },
      update: {
        amount: tagihan.amount,
        status: "PENDING",
        paymentMethod: parsed.data.method,
        rawPayload: transaction.payment ? { source: "pakasir-api", payment: transaction.payment } : { source: "pakasir-url", paymentUrl: transaction.paymentUrl },
      },
      create: {
        tagihanId: tagihan.id,
        provider: "pakasir",
        providerReference: tagihan.id,
        amount: tagihan.amount,
        status: "PENDING",
        paymentMethod: parsed.data.method,
        rawPayload: transaction.payment ? { source: "pakasir-api", payment: transaction.payment } : { source: "pakasir-url", paymentUrl: transaction.paymentUrl },
      },
    }),
    prisma.tagihan.update({ where: { id: tagihan.id }, data: { status: "PENDING" } }),
    prisma.notifikasi.create({
      data: {
        channel: "email",
        template: "payment-created",
        recipient: actor.email,
        subject: "Instruksi Pembayaran LIMO",
        body: transaction.payment ? `Instruksi pembayaran ${parsed.data.method} untuk tagihan ${tagihan.id} telah dibuat.` : `Link pembayaran Pakasir untuk tagihan ${tagihan.id}: ${transaction.paymentUrl}`,
        metadata: { tagihanId: tagihan.id, method: parsed.data.method, mode: transaction.mode },
      },
    }),
  ]);

  return transaction;
}

export async function reconcilePayment(actor: Actor, input: unknown) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }

  const parsed = zManualReconcile.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data rekonsiliasi belum valid", parsed.error.flatten().fieldErrors);
  }

  const tagihan = await prisma.tagihan.findUnique({ where: { id: parsed.data.tagihanId } });

  if (!tagihan) {
    throw new NotFoundError("Tagihan tidak ditemukan");
  }

  await prisma.$transaction([
    prisma.pembayaran.create({
      data: {
        tagihanId: tagihan.id,
        provider: "manual",
        providerReference: `manual-${tagihan.id}-${Date.now()}`,
        amount: tagihan.amount,
        status: "PAID",
        paidAt: new Date(),
        rawPayload: { reason: parsed.data.reason, actorId: actor.id },
      },
    }),
    prisma.tagihan.update({ where: { id: tagihan.id }, data: { status: "PAID", paidAt: new Date() } }),
    prisma.auditLog.create({
      data: { actorId: actor.id, action: "PAYMENT_RECONCILED", entityType: "Tagihan", entityId: tagihan.id, reason: parsed.data.reason },
    }),
  ]);

  return { success: true };
}

const zManualReconcile = z.object({
  tagihanId: z.string().min(8).max(64),
  reason: z.string().trim().min(8).max(500),
});

const zCreateInvoicePayment = z.object({
  method: z.enum(["qris", "cimb_niaga_va", "bni_va", "sampoerna_va", "bnc_va", "maybank_va", "permata_va", "atm_bersama_va", "artha_graha_va", "bri_va"]).default("qris"),
});
