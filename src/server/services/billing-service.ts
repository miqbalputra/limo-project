import type { Actor } from "../auth/session.ts";
import { prisma } from "../db/prisma.ts";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors/application-error.ts";
import { canAccessInvoice } from "../policies/access-policy.ts";
import { createTarifSchema, generateInvoiceSchema } from "../validation/billing.ts";
import { getSelectedWaliStudentId } from "../dal/wali-selector-dal.ts";
import { notifyWaliForStudents } from "./notification-service.ts";
import { isMayarConfigured } from "../providers/payment/mayar.ts";
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

export async function listTagihan(actor: Actor, paginationInput: PaginationInput = {}) {
  const selectedStudentId = actor.role === "WALI" ? await getSelectedWaliStudentId(actor) : null;
  const where = actor.role === "ADMIN"
    ? {}
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
        pembayaran: { where: { provider: "mayar" }, orderBy: { createdAt: "desc" }, take: 1, select: { status: true, rawPayload: true } },
      },
    }),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      paymentUrl: getPaymentUrl(item.pembayaran[0]?.rawPayload),
      paymentAvailable: isMayarConfigured(),
    })),
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

    if (parsed.data.dryRun) {
      created += 1;
      continue;
    }

    const result = await prisma.tagihan.upsert({
      where: { siswaId_periode_jenis: { siswaId: student.id, periode: period, jenis: parsed.data.jenis } },
      update: {},
      create: {
        siswaId: student.id,
        tarifId: tarif.id,
        periode: period,
        jenis: parsed.data.jenis,
        description: `${parsed.data.jenis} ${parsed.data.period}`,
        amount: tarif.amount,
        status: "UNPAID",
        dueDate,
      },
      select: { createdAt: true, updatedAt: true },
    });

    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created += 1;
      createdStudentIds.push(student.id);
    } else {
      skipped += 1;
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
