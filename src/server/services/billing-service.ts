import type { Actor } from "../auth/session.ts";
import { requirePermission } from "../auth/permissions.ts";
import { prisma } from "../db/prisma.ts";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors/application-error.ts";
import { canAccessInvoice } from "../policies/access-policy.ts";
import { createTarifSchema, generateInvoiceSchema, updateTarifSchema, type PembayaranStatusValue, type TagihanStatusValue } from "../validation/billing.ts";
import { notifyWaliForStudents } from "./notification-service.ts";
import { getActivePaymentGateways } from "./payment-gateway-service.ts";
import { createPaginationMeta, resolvePagination, type PaginationInput } from "../pagination.ts";
import { pickTarifForStudent } from "../billing/pick-tarif.ts";


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

const tarifSelect = {
  id: true,
  name: true,
  amount: true,
  effectiveFrom: true,
  effectiveTo: true,
  isActive: true,
  program: { select: { id: true, name: true } },
  kelas: { select: { id: true, name: true } },
  siswa: { select: { id: true, name: true } },
} as const;

export async function listTarif(actor: Actor) {
  await requirePermission(actor, "admin.billing.manage");

  const items = await prisma.tarif.findMany({
    orderBy: [{ isActive: "desc" }, { effectiveFrom: "desc" }],
    select: tarifSelect,
  });

  return { items };
}

export async function getTagihanSummary(actor: Actor) {
  await requirePermission(actor, "admin.billing.manage");

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
  await requirePermission(actor, "admin.billing.manage");
  const parsed = createTarifSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data tarif belum valid", parsed.error.flatten().fieldErrors);
  }

  if (!parsed.data.programId && !parsed.data.kelasId && !parsed.data.siswaId) {
    throw new ValidationError("Tarif wajib terkait siswa, kelas, atau program");
  }

  const item = await prisma.tarif.create({
    data: {
      name: parsed.data.name,
      programId: parsed.data.programId || undefined,
      kelasId: parsed.data.kelasId || undefined,
      siswaId: parsed.data.siswaId || undefined,
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

export async function updateTarif(actor: Actor, id: string, input: unknown) {
  await requirePermission(actor, "admin.billing.manage");
  const parsed = updateTarifSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data tarif belum valid", parsed.error.flatten().fieldErrors);
  }

  const existing = await prisma.tarif.findUnique({
    where: { id },
    select: { id: true, programId: true, kelasId: true, siswaId: true, effectiveFrom: true, effectiveTo: true },
  });
  if (!existing) {
    throw new NotFoundError("Tarif tidak ditemukan");
  }

  const patch = parsed.data;
  const nextProgramId = patch.programId !== undefined ? patch.programId || null : existing.programId;
  const nextKelasId = patch.kelasId !== undefined ? patch.kelasId || null : existing.kelasId;
  const nextSiswaId = patch.siswaId !== undefined ? patch.siswaId || null : existing.siswaId;

  if (!nextProgramId && !nextKelasId && !nextSiswaId) {
    throw new ValidationError("Tarif wajib terkait siswa, kelas, atau program");
  }

  const nextEffectiveFrom = patch.effectiveFrom !== undefined ? parseDate(patch.effectiveFrom) : existing.effectiveFrom;
  const nextEffectiveTo = patch.effectiveTo !== undefined
    ? patch.effectiveTo ? parseDate(patch.effectiveTo) : null
    : existing.effectiveTo;

  if (nextEffectiveTo && nextEffectiveTo < nextEffectiveFrom) {
    throw new ValidationError("Tanggal berakhir tidak boleh sebelum tanggal mulai");
  }

  const data: {
    name?: string;
    amount?: number;
    programId?: string | null;
    kelasId?: string | null;
    siswaId?: string | null;
    effectiveFrom?: Date;
    effectiveTo?: Date | null;
    isActive?: boolean;
  } = {};

  if (patch.name !== undefined) data.name = patch.name;
  if (patch.amount !== undefined) data.amount = patch.amount;
  if (patch.programId !== undefined) data.programId = nextProgramId;
  if (patch.kelasId !== undefined) data.kelasId = nextKelasId;
  if (patch.siswaId !== undefined) data.siswaId = nextSiswaId;
  if (patch.effectiveFrom !== undefined) data.effectiveFrom = nextEffectiveFrom;
  if (patch.effectiveTo !== undefined) data.effectiveTo = nextEffectiveTo;
  if (patch.isActive !== undefined) data.isActive = patch.isActive;

  const item = await prisma.tarif.update({ where: { id }, data, select: tarifSelect });

  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "TARIF_UPDATED", entityType: "Tarif", entityId: id, metadata: { fields: Object.keys(data) } },
  });

  return { item };
}

export async function archiveTarif(actor: Actor, id: string) {
  await requirePermission(actor, "admin.billing.manage");

  const existing = await prisma.tarif.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new NotFoundError("Tarif tidak ditemukan");
  }

  const item = await prisma.tarif.update({ where: { id }, data: { isActive: false }, select: tarifSelect });

  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "TARIF_ARCHIVED", entityType: "Tarif", entityId: id },
  });

  return { item };
}

export async function restoreTarif(actor: Actor, id: string) {
  await requirePermission(actor, "admin.billing.manage");

  const existing = await prisma.tarif.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new NotFoundError("Tarif tidak ditemukan");
  }

  const item = await prisma.tarif.update({ where: { id }, data: { isActive: true }, select: tarifSelect });

  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "TARIF_RESTORED", entityType: "Tarif", entityId: id },
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
        subtotal: true,
        discountAmount: true,
        voucher: { select: { code: true } },
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
    items: items.map(({ pembayaran, _count, voucher, ...item }) => {
      const latestPayment = pembayaran.find((payment) => getPaymentUrl(payment.rawPayload));
      return {
        ...item,
        subtotal: item.subtotal === null ? null : Number(item.subtotal),
        discountAmount: Number(item.discountAmount),
        voucherCode: voucher?.code ?? null,
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
      subtotal: true,
      discountAmount: true,
      voucher: { select: { code: true } },
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

  return {
    item: {
      ...item,
      subtotal: item.subtotal === null ? null : Number(item.subtotal),
      discountAmount: Number(item.discountAmount),
      voucherCode: item.voucher?.code ?? null,
    },
  };
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
    await requirePermission(actor, "admin.billing.manage");
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
    const candidates = await prisma.tarif.findMany({
      where: {
        isActive: true,
        effectiveFrom: { lte: period },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: period } }],
        AND: [{ OR: [{ siswaId: student.id }, { kelasId }, { programId: student.programId }] }],
      },
      select: { id: true, amount: true, effectiveFrom: true, programId: true, kelasId: true, siswaId: true },
      orderBy: { effectiveFrom: "desc" },
    });
    const tarif = pickTarifForStudent(candidates, { siswaId: student.id, kelasId, programId: student.programId });

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

    const baseAmount = parsed.data.amountOverride ?? Number(tarif.amount);
    const extraFee = parsed.data.extraFee ?? 0;
    const finalAmount = baseAmount + extraFee;

    if (finalAmount <= 0) {
      failures.push(`Nominal tagihan tidak valid untuk ${student.name}`);
      continue;
    }

    const adjustmentNote = parsed.data.amountOverride !== undefined
      ? " · nominal khusus"
      : extraFee !== 0
        ? " · biaya tambahan"
        : "";

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
          description: `${parsed.data.jenis} ${parsed.data.period}${adjustmentNote}`,
          subtotal: baseAmount,
          discountAmount: extraFee < 0 ? Math.abs(extraFee) : 0,
          amount: finalAmount,
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
