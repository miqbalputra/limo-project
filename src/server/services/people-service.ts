import "server-only";
import type { Prisma } from "@prisma/client";
import type { Actor } from "@/server/auth/session";
import { hashPassword, normalizeEmail } from "@/server/auth/password";
import { createPasswordResetGrant } from "@/server/auth/password-reset";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { generateOpaqueToken } from "@/server/security/crypto";
import { createPaginationMeta } from "@/server/pagination";
import {
  createGuruSchema,
  createSiswaSchema,
  createWaliSchema,
  importPeopleSchema,
  importPersonRowSchema,
  personListSchema,
  siswaListSchema,
  siswaWaliSchema,
  transferSiswaSchema,
  updateGuruSchema,
  updateSiswaSchema,
  updateWaliSchema,
} from "@/server/validation/master-data";
import { parseCsv } from "@/lib/csv";

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

function buildPersonWhere(input: { search: string; includeArchived: boolean }) {
  return {
    user: {
      ...(input.includeArchived ? {} : { deletedAt: null }),
      ...(input.search ? { OR: [{ name: { contains: input.search } }, { email: { contains: input.search } }] } : {}),
    },
  };
}

export async function listGuru(actor: Actor, input: unknown = {}) {
  requireAdmin(actor);
  const parsed = personListSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Filter guru belum valid", parsed.error.flatten().fieldErrors);

  const { page, pageSize, search, includeArchived } = parsed.data;
  const where = buildPersonWhere({ search, includeArchived });
  const [totalItems, items] = await Promise.all([
    prisma.guruProfile.count({ where }),
    prisma.guruProfile.findMany({
      where,
      orderBy: { user: { name: "asc" } },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        phone: true,
        address: true,
        user: { select: { id: true, name: true, email: true, status: true, deletedAt: true, lastLoginAt: true } },
        _count: { select: { kelas: true } },
      },
    }),
  ]);

  return { items, pagination: createPaginationMeta(page, pageSize, totalItems) };
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

  const activation = existing && !existing.deletedAt ? null : createPasswordResetGrant();
  const item = await prisma.$transaction(async (tx) => {
    const user = existing
      ? await tx.user.update({ where: { id: existing.id }, data: { name: parsed.data.name, status: "ACTIVE", deletedAt: null } })
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

export async function getGuru(actor: Actor, id: string) {
  requireAdmin(actor);
  const item = await prisma.guruProfile.findUnique({
    where: { id },
    select: {
      id: true,
      phone: true,
      address: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, name: true, email: true, status: true, deletedAt: true, lastLoginAt: true } },
      kelas: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, status: true, program: { select: { name: true } }, level: { select: { name: true } }, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
      },
    },
  });
  if (!item) throw new NotFoundError("Profil guru tidak ditemukan");
  return { item };
}

export async function updateGuru(actor: Actor, id: string, input: unknown) {
  requireAdmin(actor);
  const parsed = updateGuruSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data guru belum valid", parsed.error.flatten().fieldErrors);

  const existing = await prisma.guruProfile.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!existing) throw new NotFoundError("Profil guru tidak ditemukan");
  const email = normalizeEmail(parsed.data.email);
  const duplicate = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (duplicate && duplicate.id !== existing.userId) throw new ConflictError("Email sudah digunakan akun lain");

  const item = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: existing.userId }, data: { name: parsed.data.name, email } });
    const profile = await tx.guruProfile.update({
      where: { id },
      data: { phone: parsed.data.phone || null, address: parsed.data.address || null },
      select: { id: true, phone: true, address: true, user: { select: { name: true, email: true } } },
    });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "GURU_UPDATED", entityType: "GuruProfile", entityId: id } });
    return profile;
  });

  return { item };
}

export async function listWali(actor: Actor, input: unknown = {}) {
  requireAdmin(actor);
  const parsed = personListSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Filter wali belum valid", parsed.error.flatten().fieldErrors);

  const { page, pageSize, search, includeArchived } = parsed.data;
  const where = buildPersonWhere({ search, includeArchived });
  const [totalItems, items] = await Promise.all([
    prisma.waliProfile.count({ where }),
    prisma.waliProfile.findMany({
      where,
      orderBy: { user: { name: "asc" } },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        phone: true,
        address: true,
        user: { select: { id: true, name: true, email: true, status: true, deletedAt: true, lastLoginAt: true } },
        _count: { select: { siswaRelations: true } },
      },
    }),
  ]);

  return { items, pagination: createPaginationMeta(page, pageSize, totalItems) };
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

  const activation = existing && !existing.deletedAt ? null : createPasswordResetGrant();
  const item = await prisma.$transaction(async (tx) => {
    const user = existing
      ? await tx.user.update({ where: { id: existing.id }, data: { name: parsed.data.name, status: "ACTIVE", deletedAt: null } })
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

export async function getWali(actor: Actor, id: string) {
  requireAdmin(actor);
  const item = await prisma.waliProfile.findUnique({
    where: { id },
    select: {
      id: true,
      phone: true,
      address: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, name: true, email: true, status: true, deletedAt: true, lastLoginAt: true } },
      siswaRelations: {
        where: { endedAt: null },
        orderBy: [{ isPrimary: "desc" }, { siswa: { name: "asc" } }],
        select: {
          id: true,
          relationship: true,
          isPrimary: true,
          siswa: {
            select: {
              id: true,
              name: true,
              nomorInduk: true,
              program: { select: { name: true } },
              enrollments: { where: { status: "ACTIVE" }, select: { kelas: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });
  if (!item) throw new NotFoundError("Profil wali tidak ditemukan");
  return { item };
}

export async function updateWali(actor: Actor, id: string, input: unknown) {
  requireAdmin(actor);
  const parsed = updateWaliSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data wali belum valid", parsed.error.flatten().fieldErrors);

  const existing = await prisma.waliProfile.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!existing) throw new NotFoundError("Profil wali tidak ditemukan");
  const email = normalizeEmail(parsed.data.email);
  const duplicate = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (duplicate && duplicate.id !== existing.userId) throw new ConflictError("Email sudah digunakan akun lain");

  const item = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: existing.userId }, data: { name: parsed.data.name, email } });
    const profile = await tx.waliProfile.update({
      where: { id },
      data: { phone: parsed.data.phone || null, address: parsed.data.address || null },
      select: { id: true, phone: true, address: true, user: { select: { name: true, email: true } } },
    });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "WALI_UPDATED", entityType: "WaliProfile", entityId: id } });
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
         createdAt: true,
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

function logOnlyInDevelopment(url: string) {
  return process.env.NODE_ENV === "production" ? undefined : url;
}

async function issuePersonPasswordLink(input: {
  actor: Actor;
  userId: string;
  email: string;
  template: "password-reset" | "account-activation";
  subject: string;
  bodyPrefix: string;
  action: string;
  entityType: "GuruProfile" | "WaliProfile";
  entityId: string;
}) {
  const grant = createPasswordResetGrant();

  await prisma.$transaction([
    prisma.passwordResetToken.create({ data: { tokenHash: grant.tokenHash, userId: input.userId, expiresAt: grant.expiresAt } }),
    prisma.notifikasi.create({
      data: {
        channel: "email",
        template: input.template,
        recipient: input.email,
        subject: input.subject,
        body: `${input.bodyPrefix} ${grant.resetUrl}`,
        metadata: { userId: input.userId },
      },
    }),
    prisma.auditLog.create({ data: { actorId: input.actor.id, action: input.action, entityType: input.entityType, entityId: input.entityId } }),
  ]);

  return grant.resetUrl;
}

export async function archiveGuru(actor: Actor, id: string) {
  requireAdmin(actor);
  const profile = await prisma.guruProfile.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!profile) throw new NotFoundError("Profil guru tidak ditemukan");
  if (profile.userId === actor.id) throw new ValidationError("Admin tidak dapat mengarsipkan akunnya sendiri");

  const now = new Date();
  await prisma.$transaction([
    prisma.session.updateMany({ where: { userId: profile.userId, revokedAt: null }, data: { revokedAt: now, revokedById: actor.id } }),
    prisma.user.update({ where: { id: profile.userId }, data: { status: "INACTIVE", deletedAt: now } }),
    prisma.auditLog.create({ data: { actorId: actor.id, action: "GURU_ARCHIVED", entityType: "GuruProfile", entityId: id } }),
  ]);

  return { success: true };
}

export async function restoreGuru(actor: Actor, id: string) {
  requireAdmin(actor);
  const profile = await prisma.guruProfile.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!profile) throw new NotFoundError("Profil guru tidak ditemukan");

  const item = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: profile.userId }, data: { status: "ACTIVE", deletedAt: null } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "GURU_RESTORED", entityType: "GuruProfile", entityId: id } });
    return tx.guruProfile.findUnique({ where: { id }, select: { id: true, user: { select: { name: true, email: true, status: true } } } });
  });

  return { item };
}

export async function sendGuruPasswordReset(actor: Actor, id: string) {
  requireAdmin(actor);
  const profile = await prisma.guruProfile.findUnique({ where: { id }, select: { id: true, user: { select: { id: true, email: true, deletedAt: true } } } });
  if (!profile) throw new NotFoundError("Profil guru tidak ditemukan");
  if (profile.user.deletedAt) throw new ConflictError("Akun guru sedang diarsipkan");

  const resetUrl = await issuePersonPasswordLink({
    actor,
    userId: profile.user.id,
    email: profile.user.email,
    template: "password-reset",
    subject: "Reset Password Akun Guru LIMO",
    bodyPrefix: "Atur ulang password akun LIMO melalui:",
    action: "GURU_PASSWORD_RESET_SENT",
    entityType: "GuruProfile",
    entityId: id,
  });

  return { success: true, resetUrl: logOnlyInDevelopment(resetUrl) };
}

export async function resendGuruActivation(actor: Actor, id: string) {
  requireAdmin(actor);
  const profile = await prisma.guruProfile.findUnique({ where: { id }, select: { id: true, user: { select: { id: true, email: true, deletedAt: true, lastLoginAt: true } } } });
  if (!profile) throw new NotFoundError("Profil guru tidak ditemukan");
  if (profile.user.deletedAt) throw new ConflictError("Akun guru sedang diarsipkan");
  if (profile.user.lastLoginAt) throw new ConflictError("Akun sudah pernah login; gunakan kirim link reset password");

  const activationUrl = await issuePersonPasswordLink({
    actor,
    userId: profile.user.id,
    email: profile.user.email,
    template: "account-activation",
    subject: "Aktivasi Akun Guru LIMO",
    bodyPrefix: "Atur password akun LIMO melalui:",
    action: "GURU_ACTIVATION_RESENT",
    entityType: "GuruProfile",
    entityId: id,
  });

  return { success: true, activationUrl: logOnlyInDevelopment(activationUrl) };
}

export async function archiveWali(actor: Actor, id: string) {
  requireAdmin(actor);
  const profile = await prisma.waliProfile.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!profile) throw new NotFoundError("Profil wali tidak ditemukan");
  if (profile.userId === actor.id) throw new ValidationError("Admin tidak dapat mengarsipkan akunnya sendiri");

  const now = new Date();
  await prisma.$transaction([
    prisma.session.updateMany({ where: { userId: profile.userId, revokedAt: null }, data: { revokedAt: now, revokedById: actor.id } }),
    prisma.user.update({ where: { id: profile.userId }, data: { status: "INACTIVE", deletedAt: now } }),
    prisma.auditLog.create({ data: { actorId: actor.id, action: "WALI_ARCHIVED", entityType: "WaliProfile", entityId: id } }),
  ]);

  return { success: true };
}

export async function restoreWali(actor: Actor, id: string) {
  requireAdmin(actor);
  const profile = await prisma.waliProfile.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!profile) throw new NotFoundError("Profil wali tidak ditemukan");

  const item = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: profile.userId }, data: { status: "ACTIVE", deletedAt: null } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "WALI_RESTORED", entityType: "WaliProfile", entityId: id } });
    return tx.waliProfile.findUnique({ where: { id }, select: { id: true, user: { select: { name: true, email: true, status: true } } } });
  });

  return { item };
}

export async function sendWaliPasswordReset(actor: Actor, id: string) {
  requireAdmin(actor);
  const profile = await prisma.waliProfile.findUnique({ where: { id }, select: { id: true, user: { select: { id: true, email: true, deletedAt: true } } } });
  if (!profile) throw new NotFoundError("Profil wali tidak ditemukan");
  if (profile.user.deletedAt) throw new ConflictError("Akun wali sedang diarsipkan");

  const resetUrl = await issuePersonPasswordLink({
    actor,
    userId: profile.user.id,
    email: profile.user.email,
    template: "password-reset",
    subject: "Reset Password Akun Wali LIMO",
    bodyPrefix: "Atur ulang password akun LIMO melalui:",
    action: "WALI_PASSWORD_RESET_SENT",
    entityType: "WaliProfile",
    entityId: id,
  });

  return { success: true, resetUrl: logOnlyInDevelopment(resetUrl) };
}

export async function resendWaliActivation(actor: Actor, id: string) {
  requireAdmin(actor);
  const profile = await prisma.waliProfile.findUnique({ where: { id }, select: { id: true, user: { select: { id: true, email: true, deletedAt: true, lastLoginAt: true } } } });
  if (!profile) throw new NotFoundError("Profil wali tidak ditemukan");
  if (profile.user.deletedAt) throw new ConflictError("Akun wali sedang diarsipkan");
  if (profile.user.lastLoginAt) throw new ConflictError("Akun sudah pernah login; gunakan kirim link reset password");

  const activationUrl = await issuePersonPasswordLink({
    actor,
    userId: profile.user.id,
    email: profile.user.email,
    template: "account-activation",
    subject: "Aktivasi Akun Wali LIMO",
    bodyPrefix: "Atur password akun LIMO melalui:",
    action: "WALI_ACTIVATION_RESENT",
    entityType: "WaliProfile",
    entityId: id,
  });

  return { success: true, activationUrl: logOnlyInDevelopment(activationUrl) };
}

const MAX_IMPORT_ROWS = 500;

type PersonImportKind = "guru" | "wali";
type PersonImportStatus = "CREATE" | "RESTORE" | "SKIP" | "ERROR";
type PersonImportRowResult = { row: number; name: string; email: string; status: PersonImportStatus; message: string };

async function importPeople(actor: Actor, kind: PersonImportKind, input: unknown) {
  requireAdmin(actor);
  const parsed = importPeopleSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Permintaan impor belum valid", parsed.error.flatten().fieldErrors);

  const rows = parseCsv(parsed.data.csv);
  if (rows.length === 0) throw new ValidationError("File CSV kosong");

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const column = { name: header.indexOf("name"), email: header.indexOf("email"), phone: header.indexOf("phone"), address: header.indexOf("address") };
  if (column.name === -1 || column.email === -1) throw new ValidationError("Header CSV wajib memuat kolom name dan email");

  const dataRows = rows.slice(1);
  if (dataRows.length === 0) throw new ValidationError("CSV tidak memiliki baris data");
  if (dataRows.length > MAX_IMPORT_ROWS) throw new ValidationError(`Maksimal ${MAX_IMPORT_ROWS} baris per impor`);

  const role = kind === "guru" ? "GURU" : "WALI";
  const entityType = kind === "guru" ? "GuruProfile" : "WaliProfile";
  const results: PersonImportRowResult[] = [];
  const validRows: { row: number; name: string; email: string; phone: string; address: string }[] = [];
  const seenEmails = new Set<string>();

  dataRows.forEach((cells, index) => {
    const rowNumber = index + 2;
    const cell = (position: number) => (position >= 0 ? (cells[position] ?? "").trim() : "");
    const candidate = { name: cell(column.name), email: cell(column.email).toLowerCase(), phone: cell(column.phone), address: cell(column.address) };
    const rowParsed = importPersonRowSchema.safeParse(candidate);

    if (!rowParsed.success) {
      results.push({ row: rowNumber, name: candidate.name, email: candidate.email, status: "ERROR", message: "Baris tidak valid (nama minimal 2 karakter, email harus valid)" });
      return;
    }

    if (seenEmails.has(rowParsed.data.email)) {
      results.push({ row: rowNumber, name: rowParsed.data.name, email: rowParsed.data.email, status: "ERROR", message: "Email duplikat di dalam file" });
      return;
    }

    seenEmails.add(rowParsed.data.email);
    validRows.push({ row: rowNumber, ...rowParsed.data });
  });

  const existingUsers = validRows.length > 0
    ? await prisma.user.findMany({ where: { email: { in: validRows.map((entry) => entry.email) } }, select: { id: true, email: true, role: true, deletedAt: true } })
    : [];
  const existingByEmail = new Map(existingUsers.map((user) => [user.email, user]));

  const plan: { action: "CREATE" | "RESTORE"; userId?: string; name: string; email: string; phone: string; address: string }[] = [];

  for (const entry of validRows) {
    const existing = existingByEmail.get(entry.email);

    if (!existing) {
      plan.push({ ...entry, action: "CREATE" });
      results.push({ row: entry.row, name: entry.name, email: entry.email, status: "CREATE", message: "Akun baru akan dibuat" });
      continue;
    }

    if (existing.role !== role) {
      results.push({ row: entry.row, name: entry.name, email: entry.email, status: "ERROR", message: "Email sudah dipakai role lain" });
      continue;
    }

    if (existing.deletedAt) {
      plan.push({ ...entry, action: "RESTORE", userId: existing.id });
      results.push({ row: entry.row, name: entry.name, email: entry.email, status: "RESTORE", message: "Akun arsip akan dipulihkan dan diperbarui" });
      continue;
    }

    results.push({ row: entry.row, name: entry.name, email: entry.email, status: "SKIP", message: "Email sudah terdaftar dan aktif" });
  }

  let created = 0;
  let restored = 0;

  if (!parsed.data.dryRun) {
    for (const entry of plan) {
      if (entry.action === "CREATE") {
        const activation = createPasswordResetGrant();
        await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: { email: entry.email, name: entry.name, role, status: "ACTIVE", passwordHash: await createInitialPasswordHash() },
          });
          if (kind === "guru") {
            await tx.guruProfile.create({ data: { userId: user.id, phone: entry.phone || undefined, address: entry.address || undefined } });
          } else {
            await tx.waliProfile.create({ data: { userId: user.id, phone: entry.phone || undefined, address: entry.address || undefined } });
          }
          await tx.passwordResetToken.create({ data: { tokenHash: activation.tokenHash, userId: user.id, expiresAt: activation.expiresAt } });
          await tx.notifikasi.create({
            data: {
              channel: "email",
              template: "account-activation",
              recipient: entry.email,
              subject: `Aktivasi Akun ${kind === "guru" ? "Guru" : "Wali"} LIMO`,
              body: `Atur password akun LIMO melalui: ${activation.resetUrl}`,
            },
          });
          await tx.auditLog.create({ data: { actorId: actor.id, action: `${role}_IMPORT_CREATED`, entityType, entityId: user.id, metadata: { email: entry.email, source: "csv-import" } } });
        });
        created += 1;
        continue;
      }

      const userId = entry.userId!;
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: userId }, data: { name: entry.name, status: "ACTIVE", deletedAt: null } });
        if (kind === "guru") {
          await tx.guruProfile.upsert({
            where: { userId },
            update: { phone: entry.phone || null, address: entry.address || null },
            create: { userId, phone: entry.phone || undefined, address: entry.address || undefined },
          });
        } else {
          await tx.waliProfile.upsert({
            where: { userId },
            update: { phone: entry.phone || null, address: entry.address || null },
            create: { userId, phone: entry.phone || undefined, address: entry.address || undefined },
          });
        }
        await tx.auditLog.create({ data: { actorId: actor.id, action: `${role}_IMPORT_RESTORED`, entityType, entityId: userId, metadata: { email: entry.email, source: "csv-import" } } });
      });
      restored += 1;
    }

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: kind === "guru" ? "GURU_IMPORTED" : "WALI_IMPORTED",
        entityType,
        metadata: { created, restored, skipped: results.filter((entry) => entry.status === "SKIP").length, errors: results.filter((entry) => entry.status === "ERROR").length },
      },
    });
  }

  return {
    dryRun: parsed.data.dryRun,
    created,
    restored,
    skipped: results.filter((entry) => entry.status === "SKIP").length,
    errors: results.filter((entry) => entry.status === "ERROR").length,
    results,
  };
}

export async function importGuruCsv(actor: Actor, input: unknown) {
  return importPeople(actor, "guru", input);
}

export async function importWaliCsv(actor: Actor, input: unknown) {
  return importPeople(actor, "wali", input);
}
