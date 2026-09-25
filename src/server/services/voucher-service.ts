import "server-only";
import type { Voucher } from "@prisma/client";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { canAccessInvoice } from "@/server/policies/access-policy";
import { computeVoucherDiscount } from "@/lib/billing-discount";
import { applyVoucherSchema, createVoucherSchema, updateVoucherSchema } from "@/server/validation/billing";

const PAYABLE_STATUSES = ["UNPAID", "OVERDUE"];

function requireAdmin(actor: Actor) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }
}

function parseDayStart(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function parseDayEnd(value: string) {
  return new Date(`${value}T23:59:59.999Z`);
}

function serializeVoucher(item: Voucher) {
  return {
    id: item.id,
    code: item.code,
    description: item.description,
    discountType: item.discountType,
    discountValue: Number(item.discountValue),
    minAmount: item.minAmount === null ? null : Number(item.minAmount),
    maxUses: item.maxUses,
    usedCount: item.usedCount,
    programId: item.programId,
    kelasId: item.kelasId,
    validFrom: item.validFrom,
    validUntil: item.validUntil,
    isActive: item.isActive,
    createdAt: item.createdAt,
  };
}

function assertVoucherUsable(voucher: Voucher) {
  const now = new Date();
  if (!voucher.isActive) throw new ConflictError("Voucher sedang tidak aktif");
  if (voucher.validFrom && voucher.validFrom > now) throw new ConflictError("Voucher belum mulai berlaku");
  if (voucher.validUntil && voucher.validUntil < now) throw new ConflictError("Voucher sudah kedaluwarsa");
  if (voucher.maxUses !== null && voucher.usedCount >= voucher.maxUses) throw new ConflictError("Kuota voucher sudah habis");
}

async function assertCanTouchInvoice(actor: Actor, tagihanId: string) {
  const allowed = actor.role === "ADMIN" || (await canAccessInvoice(actor, tagihanId));
  if (!allowed) {
    throw new ForbiddenError("Anda tidak memiliki akses ke tagihan ini");
  }
}

export async function listVouchers(actor: Actor) {
  requireAdmin(actor);

  const items = await prisma.voucher.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: { program: { select: { name: true } }, kelas: { select: { name: true } } },
  });
  const now = new Date();

  return {
    items: items.map((item) => ({
      ...serializeVoucher(item),
      programName: item.program?.name ?? null,
      kelasName: item.kelas?.name ?? null,
      usable: item.isActive
        && (!item.validFrom || item.validFrom <= now)
        && (!item.validUntil || item.validUntil >= now)
        && (item.maxUses === null || item.usedCount < item.maxUses),
    })),
  };
}

export async function createVoucher(actor: Actor, input: unknown) {
  requireAdmin(actor);
  const parsed = createVoucherSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data voucher belum valid", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const existing = await prisma.voucher.findUnique({ where: { code: data.code }, select: { id: true } });
  if (existing) {
    throw new ConflictError("Kode voucher sudah dipakai");
  }

  const item = await prisma.voucher.create({
    data: {
      code: data.code,
      description: data.description || null,
      discountType: data.discountType,
      discountValue: data.discountValue,
      minAmount: data.minAmount && data.minAmount > 0 ? data.minAmount : null,
      maxUses: data.maxUses ?? null,
      programId: data.programId || null,
      kelasId: data.kelasId || null,
      validFrom: data.validFrom ? parseDayStart(data.validFrom) : null,
      validUntil: data.validUntil ? parseDayEnd(data.validUntil) : null,
    },
  });

  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "VOUCHER_CREATED", entityType: "Voucher", entityId: item.id, metadata: { code: item.code, discountType: item.discountType } },
  });

  return { item: serializeVoucher(item) };
}

export async function setVoucherActive(actor: Actor, id: string, input: unknown) {
  requireAdmin(actor);
  const parsed = updateVoucherSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Status voucher belum valid", parsed.error.flatten().fieldErrors);
  }

  const existing = await prisma.voucher.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new NotFoundError("Voucher tidak ditemukan");
  }

  const item = await prisma.voucher.update({ where: { id }, data: { isActive: parsed.data.isActive } });
  await prisma.auditLog.create({
    data: { actorId: actor.id, action: parsed.data.isActive ? "VOUCHER_ACTIVATED" : "VOUCHER_ARCHIVED", entityType: "Voucher", entityId: item.id },
  });

  return { item: serializeVoucher(item) };
}

export async function applyVoucher(actor: Actor, tagihanId: string, input: unknown) {
  await assertCanTouchInvoice(actor, tagihanId);
  const parsed = applyVoucherSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Kode voucher belum valid", parsed.error.flatten().fieldErrors);
  }

  const tagihan = await prisma.tagihan.findUnique({
    where: { id: tagihanId },
    select: {
      id: true,
      amount: true,
      subtotal: true,
      voucherId: true,
      status: true,
      siswa: { select: { programId: true, enrollments: { where: { status: "ACTIVE" }, select: { kelasId: true } } } },
    },
  });

  if (!tagihan) {
    throw new NotFoundError("Tagihan tidak ditemukan");
  }
  if (tagihan.voucherId) {
    throw new ConflictError("Tagihan ini sudah memakai voucher");
  }
  if (!PAYABLE_STATUSES.includes(tagihan.status)) {
    throw new ConflictError("Voucher hanya dapat dipakai pada tagihan yang belum dibayar");
  }

  const voucher = await prisma.voucher.findUnique({ where: { code: parsed.data.code } });
  if (!voucher) {
    throw new NotFoundError("Kode voucher tidak ditemukan");
  }
  assertVoucherUsable(voucher);

  if (voucher.kelasId && !tagihan.siswa.enrollments.some((enrollment) => enrollment.kelasId === voucher.kelasId)) {
    throw new ValidationError("Voucher hanya berlaku untuk kelas tertentu");
  }
  if (voucher.programId && tagihan.siswa.programId !== voucher.programId) {
    throw new ValidationError("Voucher hanya berlaku untuk program tertentu");
  }

  const subtotal = Number(tagihan.subtotal ?? tagihan.amount);
  const minAmount = voucher.minAmount === null ? null : Number(voucher.minAmount);
  if (minAmount !== null && minAmount > 0 && subtotal < minAmount) {
    throw new ValidationError(`Voucher berlaku untuk tagihan minimal ${minAmount}`);
  }

  const discount = computeVoucherDiscount(subtotal, { discountType: voucher.discountType, discountValue: Number(voucher.discountValue) });
  if (discount <= 0) {
    throw new ValidationError("Voucher tidak menghasilkan potongan untuk tagihan ini");
  }
  const amount = subtotal - discount;
  if (amount < 1) {
    throw new ValidationError("Potongan voucher membuat nominal tagihan tidak dapat dibayar");
  }

  const result = await prisma.$transaction(async (tx) => {
    const consumed = await tx.voucher.updateMany({
      where: { id: voucher.id, isActive: true, ...(voucher.maxUses !== null ? { usedCount: { lt: voucher.maxUses } } : {}) },
      data: { usedCount: { increment: 1 } },
    });
    if (consumed.count !== 1) {
      throw new ConflictError("Kuota voucher sudah habis");
    }

    const updated = await tx.tagihan.update({
      where: { id: tagihan.id },
      data: { subtotal, discountAmount: discount, voucherId: voucher.id, amount },
      select: { id: true, amount: true, subtotal: true, discountAmount: true },
    });

    await tx.auditLog.create({
      data: { actorId: actor.id, action: "VOUCHER_APPLIED", entityType: "Tagihan", entityId: tagihan.id, metadata: { voucherId: voucher.id, code: voucher.code, discount } },
    });

    return updated;
  });

  return {
    item: {
      id: result.id,
      amount: Number(result.amount),
      subtotal: result.subtotal === null ? null : Number(result.subtotal),
      discountAmount: Number(result.discountAmount),
      voucherCode: voucher.code,
    },
  };
}

export async function removeVoucher(actor: Actor, tagihanId: string) {
  await assertCanTouchInvoice(actor, tagihanId);

  const tagihan = await prisma.tagihan.findUnique({
    where: { id: tagihanId },
    select: { id: true, amount: true, subtotal: true, voucherId: true, status: true },
  });

  if (!tagihan) {
    throw new NotFoundError("Tagihan tidak ditemukan");
  }
  if (!tagihan.voucherId) {
    throw new ConflictError("Tagihan ini tidak memakai voucher");
  }
  if (!PAYABLE_STATUSES.includes(tagihan.status)) {
    throw new ConflictError("Voucher tidak dapat dilepas dari tagihan yang sudah dibayar");
  }

  const voucherId = tagihan.voucherId;
  const subtotal = Number(tagihan.subtotal ?? tagihan.amount);

  await prisma.$transaction(async (tx) => {
    await tx.tagihan.update({ where: { id: tagihan.id }, data: { amount: subtotal, subtotal: null, discountAmount: 0, voucherId: null } });
    await tx.voucher.updateMany({ where: { id: voucherId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "VOUCHER_REMOVED", entityType: "Tagihan", entityId: tagihan.id, metadata: { voucherId } } });
  });

  return { item: { id: tagihan.id, amount: subtotal } };
}
