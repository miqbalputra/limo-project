import "server-only";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { canAccessInvoice } from "@/server/policies/access-policy";
import { createTarifSchema, generateInvoiceSchema } from "@/server/validation/billing";

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

export async function listTagihan(actor: Actor) {
  const where = actor.role === "ADMIN"
    ? {}
    : actor.role === "WALI"
      ? { siswa: { waliRelations: { some: { endedAt: null, waliProfile: { userId: actor.id } } } } }
      : { siswaId: "__none__" };

  const items = await prisma.tagihan.findMany({
    where,
    orderBy: [{ periode: "desc" }, { dueDate: "asc" }],
    take: 100,
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
    },
  });

  return { items };
}

export async function getTagihan(actor: Actor, id: string) {
  const allowed = actor.role === "ADMIN" || (await canAccessInvoice(actor, id));

  if (!allowed) {
    throw new ForbiddenError("Anda tidak memiliki akses ke tagihan ini");
  }

  const item = await prisma.tagihan.findUnique({
    where: { id },
    include: { siswa: true, pembayaran: { orderBy: { createdAt: "desc" } } },
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
  }

  return { created, skipped, failed: failures.length, failures, dryRun: parsed.data.dryRun };
}
