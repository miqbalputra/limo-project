import "server-only";
import type { Prisma } from "@prisma/client";
import type { Actor } from "@/server/auth/session";
import { hashPassword, normalizeEmail } from "@/server/auth/password";
import { createPasswordResetGrant } from "@/server/auth/password-reset";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { generateOpaqueToken } from "@/server/security/crypto";
import { createPaginationMeta, resolvePagination, type PaginationInput } from "@/server/pagination";
import {
  createGuruSchema,
  createSiswaSchema,
  createWaliSchema,
  siswaListSchema,
  siswaWaliSchema,
  transferSiswaSchema,
  updateSiswaSchema,
} from "@/server/validation/master-data";

function requireAdmin(actor: Actor) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }
}

function parseDate(value: string | undefined) {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

async function createInitialPasswordHash() {
  return hashPassword(generateOpaqueToken(18));
}

export async function listGuru(actor: Actor, input: PaginationInput & { search?: string } = {}) {
  requireAdmin(actor);

  const pagination = resolvePagination(input, 20);
  const where = input.search ? { user: { OR: [{ name: { contains: input.search } }, { email: { contains: input.search } }] } } : {};
  const [totalItems, items] = await Promise.all([
    prisma.guruProfile.count({ where }),
    prisma.guruProfile.findMany({
      where,
      orderBy: { user: { name: "asc" } },
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        phone: true,
        address: true,
        user: { select: { id: true, name: true, email: true, status: true } },
        _count: { select: { kelas: true } },
      },
    }),
  ]);

  return { items, pagination: createPaginationMeta(pagination.page, pagination.pageSize, totalItems) };
}

export async function createGuru(actor: Actor, input: unknown) {
  requireAdmin(actor);
  const parsed = createGuruSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data guru belum valid", parsed.error.flatten().fieldErrors);
  }

  const email = normalizeEmail(parsed.data.email);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing && existing.role !== "GURU") {
    throw new ConflictError("Email sudah digunakan role lain");
  }

  const activation = existing ? null : createPasswordResetGrant();
  const item = await prisma.$transaction(async (tx) => {
    const user = existing
      ? await tx.user.update({ where: { id: existing.id }, data: { name: parsed.data.name, status: "ACTIVE" } })
      : await tx.user.create({
          data: {
            email,
            name: parsed.data.name,
            role: "GURU",
            status: "ACTIVE",
            passwordHash: await createInitialPasswordHash(),
          },
        });

    const profile = await tx.guruProfile.upsert({
      where: { userId: user.id },
      update: { phone: parsed.data.phone || undefined, address: parsed.data.address || undefined },
      create: { userId: user.id, phone: parsed.data.phone || undefined, address: parsed.data.address || undefined },
      select: { id: true, user: { select: { name: true, email: true } } },
    });

    if (activation) {
      await tx.passwordResetToken.create({ data: { tokenHash: activation.tokenHash, userId: user.id, expiresAt: activation.expiresAt } });
      await tx.notifikasi.create({
        data: { channel: "email", template: "account-activation", recipient: email, subject: "Aktivasi Akun Guru LIMO", body: `Atur password akun LIMO melalui: ${activation.resetUrl}` },
      });
    }

    await tx.auditLog.create({
      data: { actorId: actor.id, action: "GURU_CREATED", entityType: "GuruProfile", entityId: profile.id },
    });

    return profile;
  });

  return { item };
}

export async function listWali(actor: Actor, input: PaginationInput & { search?: string } = {}) {
  requireAdmin(actor);

  const pagination = resolvePagination(input, 20);
  const where = input.search ? { user: { OR: [{ name: { contains: input.search } }, { email: { contains: input.search } }] } } : {};
  const [totalItems, items] = await Promise.all([
    prisma.waliProfile.count({ where }),
    prisma.waliProfile.findMany({
      where,
      orderBy: { user: { name: "asc" } },
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        phone: true,
        address: true,
        user: { select: { id: true, name: true, email: true, status: true } },
        _count: { select: { siswaRelations: true } },
      },
    }),
  ]);

  return { items, pagination: createPaginationMeta(pagination.page, pagination.pageSize, totalItems) };
}

export async function createWali(actor: Actor, input: unknown) {
  requireAdmin(actor);
  const parsed = createWaliSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data wali belum valid", parsed.error.flatten().fieldErrors);
  }

  const email = normalizeEmail(parsed.data.email);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing && existing.role !== "WALI") {
    throw new ConflictError("Email sudah digunakan role lain");
  }

  const activation = existing ? null : createPasswordResetGrant();
  const item = await prisma.$transaction(async (tx) => {
    const user = existing
      ? await tx.user.update({ where: { id: existing.id }, data: { name: parsed.data.name, status: "ACTIVE" } })
      : await tx.user.create({
          data: {
            email,
            name: parsed.data.name,
            role: "WALI",
            status: "ACTIVE",
            passwordHash: await createInitialPasswordHash(),
          },
        });

    const profile = await tx.waliProfile.upsert({
      where: { userId: user.id },
      update: { phone: parsed.data.phone || undefined, address: parsed.data.address || undefined },
      create: { userId: user.id, phone: parsed.data.phone || undefined, address: parsed.data.address || undefined },
      select: { id: true, user: { select: { name: true, email: true } } },
    });

    if (activation) {
      await tx.passwordResetToken.create({ data: { tokenHash: activation.tokenHash, userId: user.id, expiresAt: activation.expiresAt } });
      await tx.notifikasi.create({
        data: { channel: "email", template: "account-activation", recipient: email, subject: "Aktivasi Akun Wali LIMO", body: `Atur password akun LIMO melalui: ${activation.resetUrl}` },
      });
    }

    await tx.auditLog.create({
      data: { actorId: actor.id, action: "WALI_CREATED", entityType: "WaliProfile", entityId: profile.id },
    });

    return profile;
  });

  return { item };
}

export async function listSiswa(actor: Actor, input: unknown = {}) {
  requireAdmin(actor);
  const parsed = siswaListSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Filter siswa belum valid", parsed.error.flatten().fieldErrors);
  }

  const { page, pageSize, search, programId, kelasId, status, sort, direction } = parsed.data;
  const where: Prisma.SiswaWhereInput = {
    ...(status === "ARCHIVED" ? { status: "ARCHIVED" } : { deletedAt: null, ...(status ? { status } : {}) }),
    ...(search ? { OR: [{ name: { contains: search } }, { nomorInduk: { contains: search } }] } : {}),
    ...(programId ? { programId } : {}),
    ...(kelasId ? { enrollments: { some: { kelasId, status: "ACTIVE" } } } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.siswa.findMany({
      where,
      orderBy: { [sort]: direction },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        nomorInduk: true,
        name: true,
        status: true,
        program: { select: { id: true, name: true } },
        waliRelations: {
          where: { endedAt: null },
          select: { waliProfile: { select: { id: true, user: { select: { name: true, email: true } } } } },
        },
        enrollments: {
          where: { status: "ACTIVE" },
          select: { kelas: { select: { id: true, name: true } }, startDate: true },
        },
      },
    }),
    prisma.siswa.count({ where }),
  ]);

  return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function createSiswa(actor: Actor, input: unknown) {
  requireAdmin(actor);
  const parsed = createSiswaSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data siswa belum valid", parsed.error.flatten().fieldErrors);
  }

  const program = await prisma.program.findUnique({ where: { id: parsed.data.programId }, select: { id: true } });

  if (!program) {
    throw new NotFoundError("Program tidak ditemukan");
  }

  const item = await prisma.$transaction(async (tx) => {
    if (parsed.data.kelasId) {
      const kelas = await tx.kelas.findFirst({
        where: { id: parsed.data.kelasId, programId: parsed.data.programId },
        select: { id: true },
      });

      if (!kelas) {
        throw new NotFoundError("Kelas tidak ditemukan untuk program siswa");
      }
    }

    if (parsed.data.waliProfileId) {
      const wali = await tx.waliProfile.findUnique({ where: { id: parsed.data.waliProfileId }, select: { id: true } });

      if (!wali) {
        throw new NotFoundError("Wali tidak ditemukan");
      }
    }

    const siswa = await tx.siswa.create({
      data: {
        nomorInduk: parsed.data.nomorInduk,
        name: parsed.data.name,
        birthAt: parseDate(parsed.data.birthDate),
        programId: parsed.data.programId,
      },
      select: { id: true, name: true, nomorInduk: true },
    });

    if (parsed.data.waliProfileId) {
      await tx.waliSiswa.create({
        data: {
          waliProfileId: parsed.data.waliProfileId,
          siswaId: siswa.id,
          relationship: "Wali",
          isPrimary: true,
        },
      });
    }

    if (parsed.data.kelasId) {
      await tx.kelasSiswa.create({
        data: {
          kelasId: parsed.data.kelasId,
          siswaId: siswa.id,
          startDate: parseDate(parsed.data.startDate) ?? new Date(),
        },
      });
    }

    await tx.auditLog.create({
      data: { actorId: actor.id, action: "SISWA_CREATED", entityType: "Siswa", entityId: siswa.id },
    });

    return siswa;
  });

  return { item };
}

export async function getSiswa(actor: Actor, id: string) {
  requireAdmin(actor);
  const item = await prisma.siswa.findUnique({
    where: { id },
    include: {
      program: true,
      siswaAccount: { select: { id: true, loginIdentifier: true, contactEmail: true, status: true, activatedAt: true, lastLoginAt: true, user: { select: { email: true, status: true } } } },
      waliRelations: {
        orderBy: { createdAt: "asc" },
        include: { waliProfile: { include: { user: { select: { name: true, email: true } } } } },
      },
      enrollments: {
        orderBy: { startDate: "desc" },
        include: { kelas: { include: { program: true, level: true } } },
      },
    },
  });

  if (!item) {
    throw new NotFoundError("Siswa tidak ditemukan");
  }

  return { item };
}

export async function updateSiswa(actor: Actor, id: string, input: unknown) {
  requireAdmin(actor);
  const parsed = updateSiswaSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data siswa belum valid", parsed.error.flatten().fieldErrors);
  }

  const existing = await prisma.siswa.findUnique({ where: { id }, select: { id: true, programId: true } });
  if (!existing) throw new NotFoundError("Siswa tidak ditemukan");

  const item = await prisma.$transaction(async (tx) => {
    if (existing.programId !== parsed.data.programId) {
      const activeEnrollmentCount = await tx.kelasSiswa.count({ where: { siswaId: id, status: "ACTIVE" } });
      if (activeEnrollmentCount > 0) {
        throw new ConflictError("Program siswa tidak dapat diubah selama masih memiliki enrollment aktif; lakukan transfer kelas terlebih dahulu");
      }
    }

    if (parsed.data.status !== "ACTIVE") {
      await tx.kelasSiswa.updateMany({ where: { siswaId: id, status: "ACTIVE" }, data: { status: "CANCELLED", endDate: new Date() } });
    }

    const updated = await tx.siswa.update({
      where: { id },
      data: {
        name: parsed.data.name,
        birthAt: parseDate(parsed.data.birthDate),
        programId: parsed.data.programId,
        status: parsed.data.status,
        deletedAt: parsed.data.status === "ARCHIVED" ? new Date() : null,
      },
    });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "SISWA_UPDATED", entityType: "Siswa", entityId: id } });
    return updated;
  });

  return { item };
}

export async function archiveSiswa(actor: Actor, id: string) {
  requireAdmin(actor);
  const now = new Date();

  const item = await prisma.$transaction(async (tx) => {
    const existing = await tx.siswa.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError("Siswa tidak ditemukan");
    await tx.kelasSiswa.updateMany({ where: { siswaId: id, status: "ACTIVE" }, data: { status: "CANCELLED", endDate: now } });
    const archived = await tx.siswa.update({ where: { id }, data: { status: "ARCHIVED", deletedAt: now } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "SISWA_ARCHIVED", entityType: "Siswa", entityId: id } });
    return archived;
  });

  return { item };
}

export async function restoreSiswa(actor: Actor, id: string) {
  requireAdmin(actor);
  const item = await prisma.siswa.update({ where: { id }, data: { status: "ACTIVE", deletedAt: null } }).catch(() => {
    throw new NotFoundError("Siswa tidak ditemukan");
  });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "SISWA_RESTORED", entityType: "Siswa", entityId: id } });
  return { item };
}

export async function addSiswaWali(actor: Actor, siswaId: string, input: unknown) {
  requireAdmin(actor);
  const parsed = siswaWaliSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Relasi wali belum valid", parsed.error.flatten().fieldErrors);

  const item = await prisma.$transaction(async (tx) => {
    const [siswa, wali] = await Promise.all([
      tx.siswa.findUnique({ where: { id: siswaId }, select: { id: true } }),
      tx.waliProfile.findUnique({ where: { id: parsed.data.waliProfileId }, select: { id: true } }),
    ]);
    if (!siswa || !wali) throw new NotFoundError("Siswa atau wali tidak ditemukan");
    if (parsed.data.isPrimary) {
      await tx.waliSiswa.updateMany({ where: { siswaId, endedAt: null }, data: { isPrimary: false } });
    }
    const relation = await tx.waliSiswa.upsert({
      where: { waliProfileId_siswaId: { waliProfileId: wali.id, siswaId } },
      update: { relationship: parsed.data.relationship, isPrimary: parsed.data.isPrimary, endedAt: null },
      create: { waliProfileId: wali.id, siswaId, relationship: parsed.data.relationship, isPrimary: parsed.data.isPrimary },
    });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "SISWA_WALI_LINKED", entityType: "Siswa", entityId: siswaId } });
    return relation;
  });
  return { item };
}

export async function removeSiswaWali(actor: Actor, siswaId: string, waliProfileId: string) {
  requireAdmin(actor);
  const result = await prisma.waliSiswa.updateMany({
    where: { siswaId, waliProfileId, endedAt: null },
    data: { endedAt: new Date(), isPrimary: false },
  });
  if (result.count === 0) throw new NotFoundError("Relasi wali tidak ditemukan");
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "SISWA_WALI_UNLINKED", entityType: "Siswa", entityId: siswaId } });
  return { success: true };
}

export async function transferSiswa(actor: Actor, siswaId: string, input: unknown) {
  requireAdmin(actor);
  const parsed = transferSiswaSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data mutasi belum valid", parsed.error.flatten().fieldErrors);
  const startDate = parseDate(parsed.data.startDate)!;

  const item = await prisma.$transaction(async (tx) => {
    const siswa = await tx.siswa.findUnique({ where: { id: siswaId }, select: { id: true, programId: true } });
    const kelas = await tx.kelas.findUnique({ where: { id: parsed.data.kelasId }, select: { id: true, programId: true } });
    if (!siswa || !kelas || siswa.programId !== kelas.programId) throw new NotFoundError("Siswa atau kelas tujuan tidak sesuai");
    await tx.kelasSiswa.updateMany({
      where: { siswaId, status: "ACTIVE" },
      data: { status: "TRANSFERRED", endDate: startDate },
    });
    const enrollment = await tx.kelasSiswa.create({ data: { siswaId, kelasId: kelas.id, startDate } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "SISWA_TRANSFERRED", entityType: "Siswa", entityId: siswaId, metadata: { kelasId: kelas.id } } });
    return enrollment;
  });
  return { item };
}

export async function exportSiswaCsv(actor: Actor) {
  requireAdmin(actor);
  const items = await prisma.siswa.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { nomorInduk: true, name: true, status: true, program: { select: { name: true } } },
  });
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return ["Nomor Induk,Nama,Status,Program", ...items.map((item) => [item.nomorInduk, item.name, item.status, item.program.name].map(escape).join(","))].join("\r\n");
}

export async function listWaliOptions(actor: Actor) {
  const { items } = await listWali(actor);
  return { items: items.map((item) => ({ id: item.id, user: item.user })) };
}
