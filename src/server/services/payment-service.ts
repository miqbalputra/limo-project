import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { getEnv } from "@/server/env";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { canAccessInvoice } from "@/server/policies/access-policy";
import { createMayarInvoice, isPaidMayarEvent, verifyMayarWebhook } from "@/server/providers/payment/mayar";
import { createPakasirPayment, isPaidPakasirEvent, verifyPakasirWebhook } from "@/server/providers/payment/pakasir";
import type { PaymentProviderName } from "@/server/providers/payment/types";
import { getPaymentGatewayRuntimeConfig, getPrimaryPaymentGateway, newPakasirOrderId } from "@/server/services/payment-gateway-service";
import { notifyAdmins, notifyWaliForStudents } from "@/server/services/notification-service";
import { formatRupiah } from "@/lib/money";

export async function processMayarWebhook(input: { rawBody: string; secret: string | null }) {
  const config = await getPaymentGatewayRuntimeConfig("mayar");
  const event = verifyMayarWebhook(input, config || undefined);
  const payloadHash = createHash("sha256").update(input.rawBody).digest("hex");
  const existingByPayload = await prisma.webhookEvent.findUnique({ where: { payloadHash }, select: { id: true, processedAt: true } });
  const existingByEvent = await prisma.webhookEvent.findUnique({ where: { provider_providerEventId: { provider: "mayar", providerEventId: event.eventId } }, select: { id: true, processedAt: true } });
  const existing = existingByPayload || existingByEvent;

  if (existing?.processedAt) {
    return { duplicate: true, processed: true };
  }

  const existingPayment = event.referenceIds.length > 0
    ? await prisma.pembayaran.findFirst({ where: { provider: "mayar", providerReference: { in: event.referenceIds } }, select: { providerReference: true, tagihanId: true, amount: true, status: true } })
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
  const duplicatePaid = paid && tagihan.status === "PAID" && existingPayment?.status !== "PAID";
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
      if (tagihan.status !== "PAID") await tx.tagihan.update({ where: { id: tagihan.id }, data: { status: "PAID", paidAt } });
    } else if (existingPayment && existingPayment.status !== "PAID" && ["expired", "closed"].includes(event.status.toLowerCase())) {
      await tx.pembayaran.update({ where: { providerReference: existingPayment.providerReference }, data: { status: "EXPIRED", rawPayload } });
      if (tagihan.status === "PENDING") {
        await tx.tagihan.update({ where: { id: tagihan.id }, data: { status: "UNPAID" } });
      }
    } else if (existingPayment && existingPayment.status !== "PAID" && event.status.toLowerCase() === "cancelled") {
      await tx.pembayaran.update({ where: { providerReference: existingPayment.providerReference }, data: { status: "CANCELLED", rawPayload } });
      if (tagihan.status === "PENDING") {
        await tx.tagihan.update({ where: { id: tagihan.id }, data: { status: "UNPAID" } });
      }
    } else if (existingPayment && existingPayment.status !== "PAID" && event.status.toLowerCase() === "failed") {
      await tx.pembayaran.update({ where: { providerReference: existingPayment.providerReference }, data: { status: "FAILED", rawPayload } });
    }

    if (!webhook.id) throw new Error("Webhook Mayar gagal disimpan");
  });

  if (paid && !duplicatePaid) {
    await notifyWaliForStudents({
      siswaIds: [tagihan.siswaId],
      template: "payment-success",
      subject: "Pembayaran tagihan diterima",
      body: `Pembayaran tagihan ${tagihan.id} telah diterima melalui Mayar.`,
      metadata: { tagihanId: tagihan.id, provider: "mayar" },
      channels: ["email", "whatsapp"],
    });
  }
  if (paid) {
    await notifyAdmins({
      template: duplicatePaid ? "admin-payment-duplicate" : "admin-payment-success",
      subject: duplicatePaid ? "Peringatan pembayaran ganda Mayar" : "Pembayaran Mayar diterima",
      body: duplicatePaid
        ? `Pembayaran tambahan melalui Mayar untuk tagihan ${tagihan.id} terdeteksi setelah tagihan sudah lunas. Periksa transaksi ini.`
        : `Pembayaran tagihan ${tagihan.id} sebesar ${formatRupiah(Number(tagihan.amount))} telah diterima melalui Mayar.`,
      metadata: { tagihanId: tagihan.id, provider: "mayar", siswaId: tagihan.siswaId, duplicate: duplicatePaid },
    });
  }

  return { duplicate: Boolean(existing), processed: true, paid };
}

export async function processPakasirWebhook(input: { rawBody: string; secret: string | null }) {
  const config = await getPaymentGatewayRuntimeConfig("pakasir");
  if (!config) throw new ValidationError("Konfigurasi Pakasir belum tersedia");
  const event = verifyPakasirWebhook(input, config);
  const payloadHash = createHash("sha256").update(input.rawBody).digest("hex");
  const existingByPayload = await prisma.webhookEvent.findUnique({ where: { payloadHash }, select: { id: true, processedAt: true } });
  const existingByEvent = await prisma.webhookEvent.findUnique({ where: { provider_providerEventId: { provider: "pakasir", providerEventId: event.eventId } }, select: { id: true, processedAt: true } });
  const existing = existingByPayload || existingByEvent;
  if (existing?.processedAt) return { duplicate: true, processed: true };

  const existingPayment = await prisma.pembayaran.findFirst({ where: { provider: "pakasir", providerReference: event.orderId }, select: { providerReference: true, tagihanId: true, amount: true, status: true } });
  if (!existingPayment) throw new NotFoundError("Transaksi Pakasir tidak ditemukan");
  const tagihan = await prisma.tagihan.findUnique({ where: { id: existingPayment.tagihanId }, select: { id: true, siswaId: true, amount: true, status: true } });
  if (!tagihan) throw new NotFoundError("Tagihan webhook Pakasir tidak ditemukan");
  if (Number(tagihan.amount) !== Number(event.amount)) throw new ConflictError("Nominal webhook Pakasir tidak sesuai tagihan");
  const paid = isPaidPakasirEvent(event.status);
  const duplicatePaid = paid && tagihan.status === "PAID" && existingPayment.status !== "PAID";
  const rawPayload = JSON.parse(input.rawBody) as object;
  const paidAt = event.completedAt && !Number.isNaN(event.completedAt.getTime()) ? event.completedAt : new Date();

  await prisma.$transaction(async (tx) => {
    const webhook = existing
      ? await tx.webhookEvent.update({ where: { id: existing.id }, data: { processedAt: new Date(), payload: rawPayload } })
      : await tx.webhookEvent.create({ data: { provider: "pakasir", providerEventId: event.eventId, payloadHash, payload: rawPayload, processedAt: new Date() } });
    if (paid) {
      await tx.pembayaran.update({ where: { providerReference: event.orderId }, data: { status: "PAID", amount: tagihan.amount, paidAt, paymentMethod: event.paymentMethod, rawPayload } });
      if (tagihan.status !== "PAID") await tx.tagihan.update({ where: { id: tagihan.id }, data: { status: "PAID", paidAt } });
    } else if (existingPayment.status !== "PAID") {
      const normalized = event.status.toLowerCase();
      const status = normalized === "expired" ? "EXPIRED" : normalized === "cancelled" ? "CANCELLED" : normalized === "failed" ? "FAILED" : null;
      if (status) {
        await tx.pembayaran.update({ where: { providerReference: event.orderId }, data: { status, rawPayload } });
        if (tagihan.status === "PENDING" && status !== "FAILED") await tx.tagihan.update({ where: { id: tagihan.id }, data: { status: "UNPAID" } });
      }
    }
    if (!webhook.id) throw new Error("Webhook Pakasir gagal disimpan");
  });

  if (paid && !duplicatePaid) {
    await notifyWaliForStudents({ siswaIds: [tagihan.siswaId], template: "payment-success", subject: "Pembayaran tagihan diterima", body: `Pembayaran tagihan ${tagihan.id} telah diterima melalui Pakasir.`, metadata: { tagihanId: tagihan.id, provider: "pakasir" }, channels: ["email", "whatsapp"] });
  }
  if (paid) {
    await notifyAdmins({ template: duplicatePaid ? "admin-payment-duplicate" : "admin-payment-success", subject: duplicatePaid ? "Peringatan pembayaran ganda Pakasir" : "Pembayaran Pakasir diterima", body: duplicatePaid ? `Pembayaran tambahan melalui Pakasir untuk tagihan ${tagihan.id} terdeteksi setelah tagihan sudah lunas. Periksa transaksi ini.` : `Pembayaran tagihan ${tagihan.id} sebesar ${formatRupiah(Number(tagihan.amount))} telah diterima melalui Pakasir.`, metadata: { tagihanId: tagihan.id, provider: "pakasir", siswaId: tagihan.siswaId, duplicate: duplicatePaid } });
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

  const requestedProvider = parsed.data.provider;
  const providerConfig = requestedProvider
    ? await getPaymentGatewayRuntimeConfig(requestedProvider, { requireEnabled: true })
    : await getPrimaryPaymentGateway();
  if (!providerConfig) throw new ValidationError("Belum ada payment gateway aktif. Minta Admin mengatur Mayar atau Pakasir terlebih dahulu.");
  const provider = providerConfig.provider;

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

  if (!["UNPAID", "PENDING", "OVERDUE"].includes(tagihan.status)) {
    throw new ConflictError(`Status tagihan belum dapat dibayar melalui ${provider === "mayar" ? "Mayar" : "Pakasir"}`);
  }

  const wali = tagihan.siswa.waliRelations[0]?.waliProfile;
  if (!wali) {
    throw new NotFoundError("Wali untuk tagihan tidak ditemukan");
  }

  const existing = await prisma.pembayaran.findFirst({
    where: { tagihanId: tagihan.id, provider, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { providerReference: true, rawPayload: true },
  });
  const existingPayload = readPaymentPayload(existing?.rawPayload);

  if (existingPayload?.paymentUrl && !isExpiredPaymentPayload(existingPayload) && canReusePayment(existingPayload, parsed.data.method, provider)) {
    return {
      mode: "redirect" as const,
      provider,
      paymentUrl: existingPayload.paymentUrl,
      payment: null,
      providerReference: existing?.providerReference,
      invoiceId: existingPayload.invoiceId || existing?.providerReference,
      transactionId: existingPayload.transactionId,
      paymentMethod: existingPayload.paymentMethod || parsed.data.method,
      expiresAt: existingPayload.expiresAt || null,
    };
  }

  if (existing && existingPayload?.paymentUrl && isExpiredPaymentPayload(existingPayload)) {
    await prisma.$transaction([
      prisma.pembayaran.update({ where: { providerReference: existing.providerReference }, data: { status: "EXPIRED" } }),
      prisma.tagihan.updateMany({ where: { id: tagihan.id, status: "PENDING" }, data: { status: "UNPAID" } }),
    ]);
  }

  const expiryDate = getMayarExpiry(tagihan.dueDate);

  const paymentInput = {
    tagihanId,
    name: wali.user.name,
    email: wali.user.email,
    mobile: wali.phone || "",
    description: tagihan.description || `${tagihan.jenis} ${tagihan.id}`,
    amount: tagihan.amount.toString(),
    expiredAt: expiryDate,
    paymentMethod: parsed.data.method,
    redirectUrl: `${getEnv().APP_URL.replace(/\/$/, "")}/wali/tagihan/success?tagihanId=${encodeURIComponent(tagihan.id)}`,
  };
  let providerReference: string;
  let paymentUrl: string;
  let paymentMethod: string;
  let expiresAt: Date | null;
  let rawPayload: object;
  let invoiceId: string | undefined;
  let transactionId: string | undefined;
  if (provider === "mayar") {
    const transaction = await createMayarInvoice(paymentInput, providerConfig);
    providerReference = transaction.transactionId;
    paymentUrl = transaction.paymentUrl;
    paymentMethod = transaction.paymentMethod;
    expiresAt = transaction.expiresAt;
    invoiceId = transaction.invoiceId;
    transactionId = transaction.transactionId;
    rawPayload = JSON.parse(JSON.stringify(createMayarPaymentPayload(transaction, parsed.data.method))) as object;
  } else {
    const transaction = createPakasirPayment({ ...paymentInput, orderId: newPakasirOrderId(tagihan.id) }, providerConfig);
    providerReference = transaction.providerReference;
    paymentUrl = transaction.paymentUrl;
    paymentMethod = transaction.paymentMethod;
    expiresAt = transaction.expiresAt;
    rawPayload = transaction.rawPayload;
  }

  await prisma.$transaction([
    prisma.pembayaran.upsert({
      where: { providerReference },
      update: {
        amount: tagihan.amount,
        status: "PENDING",
        paymentMethod,
        rawPayload,
      },
      create: {
        tagihanId: tagihan.id,
        provider,
        providerReference,
        amount: tagihan.amount,
        status: "PENDING",
        paymentMethod,
        rawPayload,
      },
    }),
    prisma.tagihan.update({ where: { id: tagihan.id }, data: { status: "PENDING" } }),
  ]);

  await notifyWaliForStudents({
    siswaIds: [tagihan.siswa.id],
    template: "payment-created",
    subject: "Instruksi Pembayaran LIMO",
    body: `Link pembayaran ${provider === "mayar" ? "Mayar" : "Pakasir"} untuk tagihan ${tagihan.id} telah dibuat: ${paymentUrl}`,
    metadata: { tagihanId: tagihan.id, method: paymentMethod, provider },
    channels: ["email", "whatsapp"],
  });

  return { provider, providerReference, paymentUrl, paymentMethod, expiresAt, invoiceId, transactionId, mode: "redirect" as const, payment: null };
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
  provider: z.enum(["mayar", "pakasir"]).optional(),
  method: z.string().trim().min(1).max(64).default("all"),
});

type MayarPaymentPayload = {
  source?: unknown;
  invoiceId?: unknown;
  transactionId?: unknown;
  paymentUrl?: unknown;
  expiresAt?: unknown;
  paymentMethod?: unknown;
};

function readPaymentPayload(payload: unknown): {
  invoiceId?: string;
  transactionId?: string;
  paymentUrl?: string;
  expiresAt?: string;
  paymentMethod?: string;
} | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = payload as MayarPaymentPayload;
  return {
    ...(typeof value.invoiceId === "string" ? { invoiceId: value.invoiceId } : {}),
    ...(typeof value.transactionId === "string" ? { transactionId: value.transactionId } : {}),
    ...(typeof value.paymentUrl === "string" ? { paymentUrl: value.paymentUrl } : {}),
    ...(typeof value.expiresAt === "string" ? { expiresAt: value.expiresAt } : {}),
    ...(typeof value.paymentMethod === "string" ? { paymentMethod: value.paymentMethod } : {}),
  };
}

function canReusePayment(payload: { paymentMethod?: string }, requestedMethod: string, provider: PaymentProviderName) {
  if (provider === "pakasir") return requestedMethod === "all" || payload.paymentMethod === requestedMethod || payload.paymentMethod === "all";
  return !payload.paymentMethod || requestedMethod === "all" || payload.paymentMethod === "all" || payload.paymentMethod === requestedMethod;
}

function isExpiredPaymentPayload(payload: { expiresAt?: string | null }) {
  if (!payload.expiresAt) return false;
  const expiresAt = new Date(payload.expiresAt).getTime();
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
}

function getMayarExpiry(dueDate: Date) {
  const dueDateExpiry = dueDate.getTime() + 24 * 60 * 60 * 1000 - 1;
  const minimumExpiry = Date.now() + 24 * 60 * 60 * 1000;
  return new Date(Math.max(dueDateExpiry, minimumExpiry));
}

function createMayarPaymentPayload(transaction: Awaited<ReturnType<typeof createMayarInvoice>>, paymentMethod: string) {
  return {
    source: "mayar-api",
    invoiceId: transaction.invoiceId,
    transactionId: transaction.transactionId,
    paymentUrl: transaction.paymentUrl,
    expiresAt: transaction.expiresAt.toISOString(),
    paymentMethod,
    response: {
      statusCode: transaction.rawPayload.statusCode,
      messages: transaction.rawPayload.messages || transaction.rawPayload.message || "",
    },
  };
}
