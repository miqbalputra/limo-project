import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { canAccessInvoice } from "@/server/policies/access-policy";
import { createMayarInvoice, isPaidMayarEvent, verifyMayarWebhook } from "@/server/providers/payment/mayar";
import { notifyAdmins, notifyWaliForStudents } from "@/server/services/notification-service";
import { MAYAR_PAYMENT_METHODS } from "@/lib/mayar-payment-methods";

export async function processMayarWebhook(input: { rawBody: string; secret: string | null }) {
  const event = verifyMayarWebhook(input);
  const payloadHash = createHash("sha256").update(input.rawBody).digest("hex");
  const existingByPayload = await prisma.webhookEvent.findUnique({ where: { payloadHash }, select: { id: true, processedAt: true } });
  const existingByEvent = await prisma.webhookEvent.findUnique({ where: { provider_providerEventId: { provider: "mayar", providerEventId: event.eventId } }, select: { id: true, processedAt: true } });
  const existing = existingByPayload || existingByEvent;

  if (existing?.processedAt) {
    return { duplicate: true, processed: true };
  }

  const existingPayment = event.referenceIds.length > 0
    ? await prisma.pembayaran.findFirst({ where: { provider: "mayar", providerReference: { in: event.referenceIds } }, select: { providerReference: true, tagihanId: true, amount: true } })
    : null;
  if (event.tagihanId && existingPayment && event.tagihanId !== existingPayment.tagihanId) {
    throw new ConflictError("Referensi tagihan pada webhook Mayar tidak konsisten");
  }
  const tagihanId = event.tagihanId || existingPayment?.tagihanId;
  if (!tagihanId) {
    throw new NotFoundError("Tagihan webhook Mayar tidak ditemukan");
  }

  const tagihan = await prisma.tagihan.findUnique({ where: { id: tagihanId }, select: { id: true, siswaId: true, amount: true, status: true } });
  if (!tagihan) {
    throw new NotFoundError("Tagihan webhook Mayar tidak ditemukan");
  }

  if (event.amount !== undefined && Number(tagihan.amount) !== Number(event.amount)) {
    throw new ConflictError("Nominal webhook Mayar tidak sesuai tagihan");
  }

  const rawPayload = JSON.parse(input.rawBody) as object;
  const paid = isPaidMayarEvent(event);
  if (paid && ["CANCELLED", "REFUNDED"].includes(tagihan.status)) {
    throw new ConflictError("Tagihan yang dibatalkan atau direfund tidak dapat ditandai lunas");
  }
  if (paid && event.amount === undefined) {
    throw new ValidationError("Nominal webhook Mayar wajib tersedia untuk event pembayaran");
  }
  const paymentReference = existingPayment?.providerReference || event.referenceIds[0] || event.eventId;
  const paidAt = event.paidAt && !Number.isNaN(event.paidAt.getTime()) ? event.paidAt : new Date();

  await prisma.$transaction(async (tx) => {
    const webhook = existing
      ? await tx.webhookEvent.update({ where: { id: existing.id }, data: { processedAt: new Date(), payload: rawPayload } })
      : await tx.webhookEvent.create({ data: { provider: "mayar", providerEventId: event.eventId, payloadHash, payload: rawPayload, processedAt: new Date() } });

    if (paid) {
      await tx.pembayaran.upsert({
        where: { providerReference: paymentReference },
        update: { status: "PAID", amount: tagihan.amount, paidAt, paymentMethod: event.paymentMethod, rawPayload },
        create: { tagihanId: tagihan.id, provider: "mayar", providerReference: paymentReference, amount: tagihan.amount, status: "PAID", paidAt, paymentMethod: event.paymentMethod, rawPayload },
      });
      await tx.tagihan.update({ where: { id: tagihan.id }, data: { status: "PAID", paidAt } });
    } else if (existingPayment && ["expired", "closed"].includes(event.status.toLowerCase())) {
      await tx.pembayaran.update({ where: { providerReference: existingPayment.providerReference }, data: { status: "EXPIRED", rawPayload } });
      if (tagihan.status === "PENDING") {
        await tx.tagihan.update({ where: { id: tagihan.id }, data: { status: "UNPAID" } });
      }
    } else if (existingPayment && event.status.toLowerCase() === "cancelled") {
      await tx.pembayaran.update({ where: { providerReference: existingPayment.providerReference }, data: { status: "CANCELLED", rawPayload } });
      if (tagihan.status === "PENDING") {
        await tx.tagihan.update({ where: { id: tagihan.id }, data: { status: "UNPAID" } });
      }
    } else if (existingPayment && event.status.toLowerCase() === "failed") {
      await tx.pembayaran.update({ where: { providerReference: existingPayment.providerReference }, data: { status: "FAILED", rawPayload } });
    }

    if (!webhook.id) throw new Error("Webhook Mayar gagal disimpan");
  });

  if (paid) {
    await notifyWaliForStudents({
      siswaIds: [tagihan.siswaId],
      template: "payment-success",
      subject: "Pembayaran tagihan diterima",
      body: `Pembayaran tagihan ${tagihan.id} telah diterima melalui Mayar.`,
      metadata: { tagihanId: tagihan.id, provider: "mayar" },
      channels: ["email", "whatsapp"],
    });
    await notifyAdmins({
      template: "admin-payment-success",
      subject: "Pembayaran Mayar diterima",
      body: `Pembayaran tagihan ${tagihan.id} sebesar Rp ${Number(tagihan.amount).toLocaleString("id-ID")} telah diterima melalui Mayar.`,
      metadata: { tagihanId: tagihan.id, provider: "mayar", siswaId: tagihan.siswaId },
    });
  }

  return { duplicate: Boolean(existing), processed: true, paid };
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

  const tagihan = await prisma.tagihan.findUnique({
    where: { id: tagihanId },
    select: {
      id: true,
      amount: true,
      status: true,
      dueDate: true,
      jenis: true,
      description: true,
      siswa: {
        select: {
          id: true,
          name: true,
          waliRelations: {
            where: { endedAt: null },
            orderBy: { isPrimary: "desc" },
            take: 1,
            select: { waliProfile: { select: { phone: true, user: { select: { name: true, email: true } } } } },
          },
        },
      },
    },
  });

  if (!tagihan) {
    throw new NotFoundError("Tagihan tidak ditemukan");
  }

  if (tagihan.status === "PAID") {
    throw new ConflictError("Tagihan sudah dibayar");
  }

  const wali = tagihan.siswa.waliRelations[0]?.waliProfile;
  if (!wali) {
    throw new NotFoundError("Wali untuk tagihan tidak ditemukan");
  }

  const existing = await prisma.pembayaran.findFirst({
    where: { tagihanId: tagihan.id, provider: "mayar", status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { providerReference: true, rawPayload: true },
  });
  const existingPayload = existing?.rawPayload && typeof existing.rawPayload === "object" && !Array.isArray(existing.rawPayload) ? existing.rawPayload as { paymentUrl?: string; transactionId?: string; invoiceId?: string } : null;

  if (existingPayload?.paymentUrl) {
    return {
      mode: "redirect" as const,
      provider: "mayar" as const,
      paymentUrl: existingPayload.paymentUrl,
      payment: null,
      invoiceId: existingPayload.invoiceId || existing?.providerReference,
      transactionId: existingPayload.transactionId,
    };
  }

  const transaction = await createMayarInvoice({
    tagihanId,
    name: wali.user.name,
    email: wali.user.email,
    mobile: wali.phone || "",
    description: tagihan.description || `${tagihan.jenis} ${tagihan.id}`,
    amount: tagihan.amount.toString(),
    expiredAt: new Date(tagihan.dueDate.getTime() + 24 * 60 * 60 * 1000 - 1),
    paymentMethod: parsed.data.method,
  });

  await prisma.$transaction([
    prisma.pembayaran.upsert({
      where: { providerReference: transaction.transactionId },
      update: {
        amount: tagihan.amount,
        status: "PENDING",
        paymentMethod: parsed.data.method,
        rawPayload: { source: "mayar-api", invoiceId: transaction.invoiceId, transactionId: transaction.transactionId, paymentUrl: transaction.paymentUrl, response: { statusCode: transaction.rawPayload.statusCode, messages: transaction.rawPayload.messages || transaction.rawPayload.message || "" } },
      },
      create: {
        tagihanId: tagihan.id,
        provider: "mayar",
        providerReference: transaction.transactionId,
        amount: tagihan.amount,
        status: "PENDING",
        paymentMethod: parsed.data.method,
        rawPayload: { source: "mayar-api", invoiceId: transaction.invoiceId, transactionId: transaction.transactionId, paymentUrl: transaction.paymentUrl, response: { statusCode: transaction.rawPayload.statusCode, messages: transaction.rawPayload.messages || transaction.rawPayload.message || "" } },
      },
    }),
    prisma.tagihan.update({ where: { id: tagihan.id }, data: { status: "PENDING" } }),
  ]);

  await notifyWaliForStudents({
    siswaIds: [tagihan.siswa.id],
    template: "payment-created",
    subject: "Instruksi Pembayaran LIMO",
    body: `Link pembayaran Mayar untuk tagihan ${tagihan.id} telah dibuat: ${transaction.paymentUrl}`,
    metadata: { tagihanId: tagihan.id, method: parsed.data.method, provider: "mayar" },
    channels: ["email", "whatsapp"],
  });

  return { ...transaction, mode: "redirect" as const, payment: null };
}

export async function reconcilePayment(actor: Actor, input: unknown) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }

  const parsed = zManualReconcile.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data rekonsiliasi belum valid", parsed.error.flatten().fieldErrors);
  }

  const result = await prisma.$transaction(async (tx) => {
    const tagihan = await tx.tagihan.findUnique({ where: { id: parsed.data.tagihanId }, select: { id: true, siswaId: true, amount: true, status: true } });

    if (!tagihan) {
      throw new NotFoundError("Tagihan tidak ditemukan");
    }

    const existingPaid = await tx.pembayaran.findFirst({ where: { tagihanId: tagihan.id, status: "PAID" }, select: { provider: true } });
    if (existingPaid) {
      if (existingPaid.provider === "manual") {
        return { duplicate: true, siswaId: tagihan.siswaId };
      }

      throw new ConflictError("Tagihan sudah memiliki pembayaran lunas");
    }

    if (!["UNPAID", "PENDING", "OVERDUE"].includes(tagihan.status)) {
      throw new ConflictError("Status tagihan tidak dapat direkonsiliasi secara manual");
    }

    const paidAt = new Date();
    await tx.pembayaran.create({
      data: {
        tagihanId: tagihan.id,
        provider: "manual",
        providerReference: `manual-${tagihan.id}-${actor.id}`,
        amount: tagihan.amount,
        status: "PAID",
        paidAt,
        rawPayload: { reason: parsed.data.reason, actorId: actor.id },
      },
    });
    await tx.tagihan.update({ where: { id: tagihan.id }, data: { status: "PAID", paidAt } });
    await tx.auditLog.create({
      data: { actorId: actor.id, action: "PAYMENT_RECONCILED", entityType: "Tagihan", entityId: tagihan.id, reason: parsed.data.reason },
    });

    return { duplicate: false, siswaId: tagihan.siswaId };
  });

  if (!result.duplicate) {
    await notifyWaliForStudents({
      siswaIds: [result.siswaId],
      template: "payment-success",
      subject: "Pembayaran tagihan diterima",
      body: `Pembayaran tagihan ${parsed.data.tagihanId} telah direkonsiliasi oleh Admin.`,
      metadata: { tagihanId: parsed.data.tagihanId, provider: "manual" },
      channels: ["email", "whatsapp"],
    });
    await notifyAdmins({
      template: "admin-payment-success",
      subject: "Pembayaran manual diterima",
      body: `Pembayaran tagihan ${parsed.data.tagihanId} telah direkonsiliasi oleh Admin.`,
      metadata: { tagihanId: parsed.data.tagihanId, provider: "manual" },
    });
  }

  return { success: true, duplicate: result.duplicate };
}

const zManualReconcile = z.object({
  tagihanId: z.string().min(8).max(64),
  reason: z.string().trim().min(8).max(500),
});

const zCreateInvoicePayment = z.object({
  method: z.enum(["all", ...MAYAR_PAYMENT_METHODS] as [string, ...string[]]).default("all"),
});
