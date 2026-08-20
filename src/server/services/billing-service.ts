import type { Actor } from "../auth/session.ts";
import { prisma } from "../db/prisma.ts";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors/application-error.ts";
import { canAccessInvoice } from "../policies/access-policy.ts";
import { createTarifSchema, generateInvoiceSchema, type PembayaranStatusValue, type TagihanStatusValue } from "../validation/billing.ts";
import { notifyWaliForStudents } from "./notification-service.ts";
import { getActivePaymentGateways } from "./payment-gateway-service.ts";
import { createPaginationMeta, resolvePagination, type PaginationInput } from "../pagination.ts";

function requireAdmin(actor: Actor) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function parsePeriod(value: string) {
  return new Date(`${value}-01T00:00:00.000Z`);
}

export type TagihanListFilters = {
  status?: TagihanStatusValue;
  search?: string;
};

export type PaymentLedgerFilters = {
  status?: PembayaranStatusValue;
  search?: string;
};

export async function listTarif(actor: Actor) {
  requireAdmin(actor);

  const items = await prisma.tarif.findMany({
    orderBy: [{ isActive: "desc" }, { effectiveFrom: "desc" }],
    select: {
      id: true,
      name: true,
      amount: true,
      effectiveFrom: true,
      effectiveTo: true,
      isActive: true,
      program: { select: { id: true, name: true } },
      kelas: { select: { id: true, name: true } },
    },
  });

  return { items };
}

export async function getTagihanSummary(actor: Actor) {
  requireAdmin(actor);

  const grouped = await prisma.tagihan.groupBy({
    by: ["status"],
    _count: { _all: true },
    _sum: { amount: true },
  });
  const groupedByStatus = new Map(grouped.map((item) => [item.status, item]));
  const getStatus = (status: (typeof grouped)[number]["status"]) => {
    const item = groupedByStatus.get(status);
    return { count: item?._count._all ?? 0, amount: Number(item?._sum.amount ?? 0) };
  };
  const draft = getStatus("DRAFT");
  const paid = getStatus("PAID");
  const unpaid = getStatus("UNPAID");
  const pending = getStatus("PENDING");
  const overdue = getStatus("OVERDUE");
  const cancelled = getStatus("CANCELLED");
  const refunded = getStatus("REFUNDED");
  const totalCount = grouped.reduce((sum, item) => sum + item._count._all, 0);
  const totalAmount = grouped.reduce((sum, item) => sum + Number(item._sum.amount ?? 0), 0);
  const openCount = unpaid.count + pending.count + overdue.count;
  const openAmount = unpaid.amount + pending.amount + overdue.amount;

  return {
    totalCount,
    totalAmount,
    paidCount: paid.count,
    paidAmount: paid.amount,
    openCount,
    openAmount,
    overdueCount: overdue.count,
    overdueAmount: overdue.amount,
    collectionRate: totalAmount > 0 ? Math.round((paid.amount / totalAmount) * 100) : 0,
    statusBreakdown: [
      { status: "DRAFT" as const, label: "Draft", ...draft },
      { status: "PAID" as const, label: "Lunas", ...paid },
      { status: "UNPAID" as const, label: "Belum dibayar", ...unpaid },
      { status: "PENDING" as const, label: "Menunggu", ...pending },
      { status: "OVERDUE" as const, label: "Lewat tempo", ...overdue },
      { status: "CANCELLED" as const, label: "Dibatalkan", ...cancelled },
      { status: "REFUNDED" as const, label: "Refund", ...refunded },
    ],
  };
}

export async function createTarif(actor: Actor, input: unknown) {
  requireAdmin(actor);
  const parsed = createTarifSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data tarif belum valid", parsed.error.flatten().fieldErrors);
  }

  if (!parsed.data.programId && !parsed.data.kelasId) {
    throw new ValidationError("Tarif wajib terkait program atau kelas");
  }

  const item = await prisma.tarif.create({
    data: {
      name: parsed.data.name,
      programId: parsed.data.programId || undefined,
      kelasId: parsed.data.kelasId || undefined,
      amount: parsed.data.amount,
      effectiveFrom: parseDate(parsed.data.effectiveFrom),
      effectiveTo: parsed.data.effectiveTo ? parseDate(parsed.data.effectiveTo) : undefined,
    },
    select: { id: true, name: true, amount: true },
  });

  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "TARIF_CREATED", entityType: "Tarif", entityId: item.id },
  });

  return { item };
}

export async function listTagihan(actor: Actor, paginationInput: PaginationInput = {}, filters: TagihanListFilters = {}, selectedStudentId: string | null = null) {
  const activePaymentGateways = await getActivePaymentGateways();
  const activePaymentProviders = activePaymentGateways.map((gateway) => gateway.provider);
  const where = actor.role === "ADMIN"
    ? {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.search ? {
          OR: [
            { id: { contains: filters.search } },
            { siswa: { name: { contains: filters.search } } },
            { siswa: { nomorInduk: { contains: filters.search } } },
            { pembayaran: { some: { OR: [{ provider: { contains: filters.search } }, { providerReference: { contains: filters.search } }, { paymentMethod: { contains: filters.search } }] } } },
          ],
        } : {}),
      }
    : actor.role === "WALI"
      ? { ...(selectedStudentId ? { siswaId: selectedStudentId } : {}), siswa: { waliRelations: { some: { endedAt: null, waliProfile: { userId: actor.id } } } } }
      : { siswaId: "__none__" };

  const pagination = resolvePagination(paginationInput, actor.role === "ADMIN" ? 20 : 100);
  const [totalItems, items] = await Promise.all([
    prisma.tagihan.count({ where }),
    prisma.tagihan.findMany({
      where,
      orderBy: [{ periode: "desc" }, { dueDate: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        periode: true,
        jenis: true,
        description: true,
        amount: true,
        status: true,
        dueDate: true,
        paidAt: true,
        siswa: { select: { id: true, name: true, nomorInduk: true } },
        pembayaran: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, provider: true, providerReference: true, amount: true, status: true, paymentMethod: true, paidAt: true, createdAt: true, rawPayload: true } },
        _count: { select: { pembayaran: true } },
      },
    }),
  ]);

  return {
    items: items.map(({ pembayaran, _count, ...item }) => {
      const latestPayment = pembayaran.find((payment) => getPaymentUrl(payment.rawPayload));
      return {
        ...item,
        paymentUrl: getPaymentUrl(latestPayment?.rawPayload),
        paymentProvider: latestPayment?.provider || null,
        paymentHistory: pembayaran.map(({ rawPayload: _rawPayload, ...payment }) => ({ ...payment, amount: Number(payment.amount) })),
        paymentHistoryCount: _count.pembayaran,
        paymentAvailable: activePaymentProviders.length > 0,
        availablePaymentProviders: activePaymentProviders,
      };
    }),
    pagination: createPaginationMeta(pagination.page, pagination.pageSize, totalItems),
  };
}

function getPaymentUrl(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as { paymentUrl?: unknown }).paymentUrl;
  return typeof value === "string" ? value : null;
}

export async function getTagihan(actor: Actor, id: string) {
  const allowed = actor.role === "ADMIN" || (await canAccessInvoice(actor, id));

  if (!allowed) {
    throw new ForbiddenError("Anda tidak memiliki akses ke tagihan ini");
  }

  const item = await prisma.tagihan.findUnique({
    where: { id },
    select: {
      id: true,
      siswaId: true,
      periode: true,
      jenis: true,
      description: true,
      amount: true,
      status: true,
      dueDate: true,
      paidAt: true,
      siswa: { select: { id: true, name: true, nomorInduk: true } },
      pembayaran: { orderBy: { createdAt: "desc" }, select: { id: true, provider: true, providerReference: true, amount: true, status: true, paymentMethod: true, paidAt: true, createdAt: true } },
    },
  });

  if (!item) {
    throw new NotFoundError("Tagihan tidak ditemukan");
  }

  return { item };
}

export async function listPaymentLedger(actor: Actor, paginationInput: PaginationInput = {}, filters: PaymentLedgerFilters = {}, selectedStudentId: string | null = null) {
  if (actor.role !== "ADMIN" && actor.role !== "WALI") {
    throw new ForbiddenError();
  }

  const where = actor.role === "ADMIN"
    ? {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.search ? {
          OR: [
            { id: { contains: filters.search } },
            { provider: { contains: filters.search } },
            { providerReference: { contains: filters.search } },
            { paymentMethod: { contains: filters.search } },
            { tagihan: { id: { contains: filters.search } } },
            { tagihan: { siswa: { name: { contains: filters.search } } } },
            { tagihan: { siswa: { nomorInduk: { contains: filters.search } } } },
          ],
        } : {}),
      }
    : {
        ...(filters.status ? { status: filters.status } : {}),
        tagihan: {
          ...(selectedStudentId ? { siswaId: selectedStudentId } : {}),
          siswa: { waliRelations: { some: { endedAt: null, waliProfile: { userId: actor.id } } } },
        },
        ...(filters.search ? {
          OR: [
            { provider: { contains: filters.search } },
            { providerReference: { contains: filters.search } },
            { paymentMethod: { contains: filters.search } },
            { tagihan: { id: { contains: filters.search } } },
            { tagihan: { jenis: { contains: filters.search } } },
          ],
        } : {}),
      };
  const pagination = resolvePagination(paginationInput, actor.role === "ADMIN" ? 30 : 50);
  const [totalItems, items] = await Promise.all([
    prisma.pembayaran.count({ where }),
    prisma.pembayaran.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        provider: true,
        providerReference: true,
        amount: true,
        status: true,
        paymentMethod: true,
        paidAt: true,
        createdAt: true,
        updatedAt: true,
        tagihan: {
          select: {
            id: true,
            jenis: true,
            description: true,
            periode: true,
            status: true,
            siswa: { select: { id: true, name: true, nomorInduk: true } },
          },
        },
      },
    }),
  ]);

  return {
    items: items.map((item) => ({ ...item, amount: Number(item.amount) })),
    pagination: createPaginationMeta(pagination.page, pagination.pageSize, totalItems),
  };
}

export async function generateMonthlyInvoices(actor: Actor | null, input: unknown) {
  if (actor) {
    requireAdmin(actor);
  }

  const parsed = generateInvoiceSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Parameter generate tagihan belum valid", parsed.error.flatten().fieldErrors);
  }

  const period = parsePeriod(parsed.data.period);
  const dueDate = parseDate(parsed.data.dueDate);
  const students = await prisma.siswa.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    select: {
      id: true,
      name: true,
      programId: true,
      enrollments: { where: { status: "ACTIVE" }, take: 1, select: { kelasId: true } },
    },
  });

  let created = 0;
  let skipped = 0;
  const failures: string[] = [];
  const createdStudentIds: string[] = [];

  for (const student of students) {
    const kelasId = student.enrollments[0]?.kelasId;
    const tarif = await prisma.tarif.findFirst({
      where: {
        isActive: true,
        effectiveFrom: { lte: period },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: period } }],
        AND: [{ OR: [{ kelasId }, { programId: student.programId }] }],
      },
      orderBy: [{ kelasId: "desc" }, { effectiveFrom: "desc" }],
    });

    if (!tarif) {
      failures.push(`Tarif tidak ditemukan untuk ${student.name}`);
      continue;
    }

    const existingInvoice = await prisma.tagihan.findUnique({
      where: { siswaId_periode_jenis: { siswaId: student.id, periode: period, jenis: parsed.data.jenis } },
      select: { id: true },
    });

    if (existingInvoice) {
      skipped += 1;
      continue;
    }

    if (parsed.data.dryRun) {
      created += 1;
      continue;
    }

    try {
      await prisma.tagihan.create({
        data: {
          siswaId: student.id,
          tarifId: tarif.id,
          periode: period,
          jenis: parsed.data.jenis,
          description: `${parsed.data.jenis} ${parsed.data.period}`,
          amount: tarif.amount,
          status: "UNPAID",
          dueDate,
        },
      });
      created += 1;
      createdStudentIds.push(student.id);
    } catch (caught) {
      if (typeof caught === "object" && caught && "code" in caught && caught.code === "P2002") {
        skipped += 1;
      } else {
        failures.push(`Tagihan gagal dibuat untuk ${student.name}`);
      }
    }
  }

  if (!parsed.data.dryRun) {
    await prisma.jobRun.create({
      data: {
        name: "generate-monthly-invoices",
        status: failures.length ? "FAILED" : "SUCCESS",
        finishedAt: new Date(),
        successCount: created,
        skippedCount: skipped,
        failedCount: failures.length,
        metadata: { period: parsed.data.period, failures },
      },
    });

    await notifyWaliForStudents({
      siswaIds: createdStudentIds,
      template: "invoice-created",
      subject: "Tagihan baru LIMO tersedia",
      body: `Tagihan ${parsed.data.jenis} periode ${parsed.data.period} sudah dibuat. Buka menu Tagihan untuk melihat nominal dan instruksi pembayaran.`,
      metadata: { period: parsed.data.period, jenis: parsed.data.jenis },
      channels: ["email", "whatsapp"],
    });
  }

  return { created, skipped, failed: failures.length, failures, dryRun: parsed.data.dryRun };
}
