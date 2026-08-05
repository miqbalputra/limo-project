import "server-only";
import type { Actor } from "@/server/auth/session";
import { createPaginationMeta, resolvePagination, type PaginationInput } from "@/server/pagination";
import { hashPassword, normalizeEmail } from "@/server/auth/password";
import { createPasswordResetGrant } from "@/server/auth/password-reset";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { generateOpaqueToken } from "@/server/security/crypto";
import { assertRateLimit } from "@/server/security/rate-limit";
import {
  rejectPendaftaranSchema,
  statusPendaftaranSchema,
  submitPendaftaranSchema,
} from "@/server/validation/pendaftaran";

function parseBirthDate(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

function createRegistrationCode() {
  const now = new Date();
  const year = now.getUTCFullYear();
  return `LIMO-${year}-${generateOpaqueToken(6).toUpperCase()}`;
}

async function createUniqueRegistrationCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const kode = createRegistrationCode();
    const existing = await prisma.pendaftaran.findUnique({ where: { kode }, select: { id: true } });

    if (!existing) {
      return kode;
    }
  }

  throw new ConflictError("Kode pendaftaran belum dapat dibuat. Coba lagi");
}

export async function submitPendaftaran(input: unknown, context: { ipAddress?: string | null }) {
  assertRateLimit({
    key: `pendaftaran-submit:${context.ipAddress || "unknown"}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
    message: "Terlalu banyak pendaftaran dari koneksi ini. Coba lagi nanti",
  });

  const parsed = submitPendaftaranSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data pendaftaran belum valid", parsed.error.flatten().fieldErrors);
  }

  const waliEmail = normalizeEmail(parsed.data.waliEmail);
  const program = await prisma.program.findFirst({
    where: {
      kind: parsed.data.programKind,
      isActive: true,
    },
    select: { id: true, name: true },
  });

  if (!program) {
    throw new ValidationError("Program yang dipilih belum tersedia");
  }

  const duplicate = await prisma.pendaftaran.findFirst({
    where: {
      waliEmail,
      studentName: parsed.data.studentName,
      programId: program.id,
      status: { in: ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED"] },
    },
    select: { kode: true, status: true },
  });

  if (duplicate) {
    throw new ConflictError(`Pendaftaran serupa sudah ada dengan kode ${duplicate.kode}`);
  }

  const kode = await createUniqueRegistrationCode();

  const pendaftaran = await prisma.$transaction(async (tx) => {
    const created = await tx.pendaftaran.create({
      data: {
        kode,
        status: "SUBMITTED",
        programId: program.id,
        studentName: parsed.data.studentName,
        studentBirthAt: parseBirthDate(parsed.data.studentBirthDate),
        waliName: parsed.data.waliName,
        waliEmail,
        waliPhone: parsed.data.waliPhone || undefined,
        submittedAt: new Date(),
      },
      select: {
        id: true,
        kode: true,
        status: true,
        studentName: true,
        waliEmail: true,
        createdAt: true,
      },
    });

    await tx.riwayatStatusPendaftaran.create({
      data: {
        pendaftaranId: created.id,
        fromStatus: null,
        toStatus: "SUBMITTED",
      },
    });

    return created;
  });

  return { pendaftaran };
}

export async function lookupPendaftaranStatus(input: unknown, context: { ipAddress?: string | null }) {
  assertRateLimit({
    key: `pendaftaran-status:${context.ipAddress || "unknown"}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
    message: "Terlalu banyak pengecekan status. Coba lagi nanti",
  });

  const parsed = statusPendaftaranSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data pengecekan status belum valid", parsed.error.flatten().fieldErrors);
  }

  const pendaftaran = await prisma.pendaftaran.findFirst({
    where: {
      kode: parsed.data.kode,
      waliEmail: normalizeEmail(parsed.data.waliEmail),
    },
    select: {
      kode: true,
      status: true,
      studentName: true,
      rejectionReason: true,
      submittedAt: true,
      reviewedAt: true,
      program: { select: { name: true } },
    },
  });

  if (!pendaftaran) {
    throw new NotFoundError("Pendaftaran tidak ditemukan");
  }

  return { pendaftaran };
}

export async function listPendaftaran(actor: Actor, paginationInput: PaginationInput = {}) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }

  const pagination = resolvePagination(paginationInput, 20);
  const [totalItems, items] = await Promise.all([
    prisma.pendaftaran.count(),
    prisma.pendaftaran.findMany({
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        kode: true,
        status: true,
        studentName: true,
        waliName: true,
        waliEmail: true,
        submittedAt: true,
        program: { select: { name: true } },
        files: {
          where: { deletedAt: null },
          select: {
            id: true,
            originalName: true,
          },
        },
      },
    }),
  ]);

  return { items, pagination: createPaginationMeta(pagination.page, pagination.pageSize, totalItems) };
}

export async function getPendaftaranDetail(actor: Actor, id: string) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }

  const pendaftaran = await prisma.pendaftaran.findUnique({
    where: { id },
    include: {
      program: { select: { name: true, kind: true } },
      histories: { orderBy: { createdAt: "asc" } },
      files: { where: { deletedAt: null }, select: { id: true, originalName: true } },
    },
  });

  if (!pendaftaran) {
    throw new NotFoundError("Pendaftaran tidak ditemukan");
  }

  return { pendaftaran };
}

export async function approvePendaftaran(actor: Actor, id: string) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }

  return prisma.$transaction(async (tx) => {
    const pendaftaran = await tx.pendaftaran.findUnique({
      where: { id },
      include: { program: true, approvedSiswa: true },
    });

    if (!pendaftaran) {
      throw new NotFoundError("Pendaftaran tidak ditemukan");
    }

    if (pendaftaran.status === "APPROVED" && pendaftaran.approvedSiswa) {
      return { pendaftaranId: pendaftaran.id, siswaId: pendaftaran.approvedSiswa.id, status: "APPROVED" as const };
    }

    if (!["SUBMITTED", "UNDER_REVIEW"].includes(pendaftaran.status)) {
      throw new ConflictError("Pendaftaran tidak dapat disetujui dari status saat ini");
    }

    const waliEmail = normalizeEmail(pendaftaran.waliEmail);
    const existingUser = await tx.user.findUnique({ where: { email: waliEmail } });
    const activation = existingUser ? null : createPasswordResetGrant();

    if (existingUser && existingUser.role !== "WALI") {
      throw new ConflictError("Email wali sudah digunakan oleh role lain");
    }

    const user = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: {
            name: pendaftaran.waliName,
            status: "ACTIVE",
          },
        })
      : await tx.user.create({
          data: {
            email: waliEmail,
            name: pendaftaran.waliName,
            role: "WALI",
            status: "ACTIVE",
            passwordHash: await hashPassword(generateOpaqueToken(18)),
          },
        });

    const waliProfile = await tx.waliProfile.upsert({
      where: { userId: user.id },
      update: {
        phone: pendaftaran.waliPhone,
      },
      create: {
        userId: user.id,
        phone: pendaftaran.waliPhone,
      },
    });

    if (activation) {
      await tx.passwordResetToken.create({ data: { tokenHash: activation.tokenHash, userId: user.id, expiresAt: activation.expiresAt } });
    }

    const siswa = await tx.siswa.create({
      data: {
        nomorInduk: `LIMO-${new Date().getUTCFullYear()}-${generateOpaqueToken(5).toUpperCase()}`,
        name: pendaftaran.studentName,
        birthAt: pendaftaran.studentBirthAt,
        programId: pendaftaran.programId,
      },
    });

    await tx.waliSiswa.upsert({
      where: {
        waliProfileId_siswaId: {
          waliProfileId: waliProfile.id,
          siswaId: siswa.id,
        },
      },
      update: { isPrimary: true },
      create: {
        waliProfileId: waliProfile.id,
        siswaId: siswa.id,
        relationship: "Wali",
        isPrimary: true,
      },
    });

    await tx.pendaftaran.update({
      where: { id: pendaftaran.id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: actor.id,
        waliProfileId: waliProfile.id,
        approvedSiswaId: siswa.id,
      },
    });

    await tx.riwayatStatusPendaftaran.create({
      data: {
        pendaftaranId: pendaftaran.id,
        fromStatus: pendaftaran.status,
        toStatus: "APPROVED",
        actorId: actor.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "PENDAFTARAN_APPROVED",
        entityType: "Pendaftaran",
        entityId: pendaftaran.id,
      },
    });

    await tx.notifikasi.create({
      data: {
        channel: "email",
        template: "pendaftaran-approved",
        recipient: waliEmail,
        subject: "Pendaftaran LIMO Disetujui",
        body: activation
          ? `Pendaftaran ${pendaftaran.kode} untuk ${pendaftaran.studentName} telah disetujui. Atur password akun wali melalui: ${activation.resetUrl}`
          : `Pendaftaran ${pendaftaran.kode} untuk ${pendaftaran.studentName} telah disetujui.`,
      },
    });

    return { pendaftaranId: pendaftaran.id, siswaId: siswa.id, status: "APPROVED" as const };
  });
}

export async function rejectPendaftaran(actor: Actor, id: string, input: unknown) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }

  const parsed = rejectPendaftaranSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Alasan penolakan belum valid", parsed.error.flatten().fieldErrors);
  }

  const pendaftaran = await prisma.pendaftaran.findUnique({ where: { id } });

  if (!pendaftaran) {
    throw new NotFoundError("Pendaftaran tidak ditemukan");
  }

  if (!["SUBMITTED", "UNDER_REVIEW"].includes(pendaftaran.status)) {
    throw new ConflictError("Pendaftaran tidak dapat ditolak dari status saat ini");
  }

  await prisma.$transaction([
    prisma.pendaftaran.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedById: actor.id,
        rejectionReason: parsed.data.reason,
      },
    }),
    prisma.riwayatStatusPendaftaran.create({
      data: {
        pendaftaranId: id,
        fromStatus: pendaftaran.status,
        toStatus: "REJECTED",
        actorId: actor.id,
        reason: parsed.data.reason,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "PENDAFTARAN_REJECTED",
        entityType: "Pendaftaran",
        entityId: id,
        reason: parsed.data.reason,
      },
    }),
    prisma.notifikasi.create({
      data: {
        channel: "email",
        template: "pendaftaran-rejected",
        recipient: pendaftaran.waliEmail,
        subject: "Pendaftaran LIMO Belum Dapat Disetujui",
        body: `Pendaftaran ${pendaftaran.kode} belum dapat disetujui. Alasan: ${parsed.data.reason}`,
      },
    }),
  ]);

  return { success: true };
}
