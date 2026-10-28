import { createHash } from "node:crypto";
import { prisma } from "../db/prisma.ts";
import { getMayarInvoice, isPaidMayarEvent } from "../providers/payment/mayar.ts";
import { getPaymentGatewayRuntimeConfig } from "./payment-gateway-service.ts";
import { notifyAdmins } from "./notification-service.ts";
export { sendDeadlineReminders } from "./reminder-service.ts";
export { retryPendingNotifications } from "./notification-job-service.ts";

export async function markOverdueInvoices(input: { dryRun?: boolean; now?: Date } = {}) {
  const now = input.now ?? new Date();
  const candidates = await prisma.tagihan.findMany({
    where: {
      status: "UNPAID",
      dueDate: { lt: now },
    },
    select: { id: true },
  });

  if (!input.dryRun && candidates.length > 0) {
    await prisma.tagihan.updateMany({
      where: { id: { in: candidates.map((item) => item.id) }, status: "UNPAID" },
      data: { status: "OVERDUE" },
    });
  }

  if (!input.dryRun) {
    await prisma.jobRun.create({
      data: {
        name: "mark-overdue-invoices",
        status: "SUCCESS",
        finishedAt: new Date(),
        successCount: candidates.length,
        metadata: { dryRun: false },
      },
    });
  }

  return { marked: candidates.length, dryRun: Boolean(input.dryRun) };
}

export async function cleanupExpiredSessions(input: { dryRun?: boolean; now?: Date } = {}) {
  const now = input.now ?? new Date();
  const candidates = await prisma.session.findMany({
    where: {
      OR: [{ expiresAt: { lt: now } }, { revokedAt: { not: null } }],
    },
    select: { id: true },
  });

  if (!input.dryRun && candidates.length > 0) {
    await prisma.session.deleteMany({ where: { id: { in: candidates.map((item) => item.id) } } });
  }

  if (!input.dryRun) {
    await prisma.jobRun.create({
      data: {
        name: "cleanup-expired-sessions",
        status: "SUCCESS",
        finishedAt: new Date(),
        successCount: candidates.length,
        metadata: { dryRun: false },
      },
    });
  }

  return { deleted: candidates.length, dryRun: Boolean(input.dryRun) };
}

export async function reconcilePendingMayarPayments(input: { dryRun?: boolean; limit?: number } = {}) {
  const mayarConfig = await getPaymentGatewayRuntimeConfig("mayar");
  if (!mayarConfig) return { checked: 0, paid: 0, expired: 0, skipped: 0, failed: 0, errors: ["Konfigurasi Mayar belum tersedia"] };
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const payments = await prisma.pembayaran.findMany({
    where: { provider: "mayar", status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      tagihanId: true,
      rawPayload: true,
      tagihan: { select: { id: true, siswaId: true, amount: true, status: true } },
    },
  });

  let checked = 0;
  let paid = 0;
  let expired = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const payment of payments) {
    const payload = payment.rawPayload && typeof payment.rawPayload === "object" && !Array.isArray(payment.rawPayload)
      ? payment.rawPayload as { invoiceId?: unknown }
      : null;
    const invoiceId = typeof payload?.invoiceId === "string" ? payload.invoiceId : null;

    if (!invoiceId) {
      skipped += 1;
      continue;
    }

    checked += 1;

    try {
      const invoice = await getMayarInvoice(invoiceId, mayarConfig);
      const status = invoice.status.toLowerCase();

      if (isPaidMayarEvent({ event: "invoice.status", status })) {
        if (Number(payment.tagihan.amount) !== Number(invoice.amount)) {
          throw new Error(`Nominal invoice ${invoiceId} tidak sesuai tagihan`);
        }

        if (!input.dryRun) {
          const rawPayload = invoice.rawPayload as object;
          const eventId = invoice.transactionId || invoice.id;
          const payloadHash = createHash("sha256").update(JSON.stringify(rawPayload)).digest("hex");
          const paidAt = new Date();

          // Guard status: webhook/instance lain bisa mengubah pembayaran/tagihan
          // setelah daftar PENDING dibaca — jangan pernah menimpanya paksa.
          const applied = await prisma.$transaction(async (tx) => {
            const current = await tx.pembayaran.findUnique({ where: { id: payment.id }, select: { status: true } });
            if (current?.status !== "PENDING") return false;

            await tx.webhookEvent.upsert({
              where: { provider_providerEventId: { provider: "mayar", providerEventId: eventId } },
              update: { payload: rawPayload, payloadHash, processedAt: paidAt },
              create: { provider: "mayar", providerEventId: eventId, payloadHash, payload: rawPayload, processedAt: paidAt },
            });
            await tx.pembayaran.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: "PAID", amount: payment.tagihan.amount, paidAt, rawPayload } });
            await tx.tagihan.updateMany({
              where: { id: payment.tagihanId, status: { in: ["UNPAID", "PENDING", "OVERDUE"] } },
              data: { status: "PAID", paidAt },
            });
            return true;
          });

          if (!applied) {
            skipped += 1;
            continue;
          }

           await enqueuePaymentSuccessNotifications(payment.tagihan.siswaId, payment.tagihanId, "mayar");
           await notifyAdmins({
             template: "admin-payment-success",
             subject: "Pembayaran Mayar diterima",
             body: `Pembayaran tagihan ${payment.tagihanId} telah dikonfirmasi oleh rekonsiliasi Mayar.`,
             metadata: { tagihanId: payment.tagihanId, provider: "mayar", source: "reconciliation" },
           });
        }

        paid += 1;
      } else if (["expired", "closed", "cancelled"].includes(status)) {
        const paymentStatus = status === "cancelled" ? "CANCELLED" : "EXPIRED";
        if (!input.dryRun) {
          await prisma.$transaction([
            prisma.pembayaran.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: paymentStatus, rawPayload: invoice.rawPayload as object } }),
            prisma.tagihan.updateMany({ where: { id: payment.tagihanId, status: "PENDING" }, data: { status: "UNPAID" } }),
          ]);
        }

        expired += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      failed += 1;
      errors.push(`${payment.tagihanId}: ${error instanceof Error ? error.message : "Gagal membaca invoice Mayar"}`);
    }
  }

  if (!input.dryRun) {
    await prisma.jobRun.create({
      data: {
        name: "reconcile-mayar-payments",
        status: failed > 0 ? "FAILED" : "SUCCESS",
        finishedAt: new Date(),
        successCount: paid + expired,
        skippedCount: skipped,
        failedCount: failed,
        errorMessage: errors.length > 0 ? errors.slice(0, 10).join("; ").slice(0, 2000) : undefined,
        metadata: { dryRun: false, limit, checked, errors: errors.slice(0, 10) },
      },
    });
    if (failed > 0) {
      await notifyAdmins({
        template: "job-failure",
        subject: `Rekonsiliasi Mayar: ${failed} pembayaran gagal dicek`,
        body: `Rekonsiliasi otomatis Mayar gagal memproses ${failed} pembayaran. Contoh: ${errors.slice(0, 3).join(" | ").slice(0, 400)}. Detail lengkap di /admin → jejak JobRun.`,
        metadata: { source: "reconcile-mayar", failed },
      }).catch(() => undefined);
    }
  }

  return { checked, paid, expired, skipped, failed, errors, dryRun: Boolean(input.dryRun) };
}

async function enqueuePaymentSuccessNotifications(siswaId: string, tagihanId: string, provider: "mayar") {
  const relations = await prisma.waliSiswa.findMany({
    where: { siswaId, endedAt: null },
    select: { siswaId: true, waliProfile: { select: { phone: true, user: { select: { email: true } } } } },
  });

  for (const relation of relations) {
    for (const channel of ["email", "whatsapp"] as const) {
      const recipient = channel === "email" ? relation.waliProfile.user.email : relation.waliProfile.phone;
      if (!recipient) continue;

      const body = `Pembayaran tagihan ${tagihanId} telah diterima melalui Mayar.`;
      try {
        await prisma.notifikasi.create({
          data: {
            channel,
            template: "payment-success",
            recipient,
            subject: "Pembayaran tagihan diterima",
            body,
            dedupeKey: createHash("sha256").update(`payment-success|${channel}|${recipient}|${body}`).digest("hex"),
            metadata: { tagihanId, provider, source: "reconciliation", siswaId: relation.siswaId },
          },
        });
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "P2002") continue;
        throw error;
      }
    }
  }
}
