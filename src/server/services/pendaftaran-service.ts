import "server-only";
import type { Prisma } from "@prisma/client";
import type { Actor } from "@/server/auth/session";
import { createPaginationMeta, resolvePagination, type PaginationInput } from "@/server/pagination";
import { hashPassword, normalizeEmail } from "@/server/auth/password";
import { createPasswordResetGrant } from "@/server/auth/password-reset";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { generateOpaqueToken } from "@/server/security/crypto";
import { assertRateLimit } from "@/server/security/rate-limit";
import { normalizePhone } from "@/lib/phone";
import {
  enqueuePendaftaranApproved,
  enqueuePendaftaranNotificationSafely,
  enqueuePendaftaranRejected,
  enqueuePendaftaranSubmitted,
} from "@/server/services/pendaftaran-notification-service";
import {
  rejectPendaftaranSchema,
  statusPendaftaranSchema,
  submitPendaftaranSchema,
  updatePendaftaranContactSchema,
} from "@/server/validation/pendaftaran";

const pendaftaranStatuses = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type PendaftaranStatus = (typeof pendaftaranStatuses)[number];

export const PENDAFTARAN_EXPORT_LIMIT = 10_000;

export type PendaftaranListFilters = {
  search?: string;
  status?: PendaftaranStatus;
};

export function parsePendaftaranStatus(value: string | null) {
  return value && pendaftaranStatuses.includes(value as PendaftaranStatus) ? value as PendaftaranStatus : undefined;
}

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

  const data = parsed.data;
  const waliEmail = data.waliEmail ? normalizeEmail(data.waliEmail) : null;
  const waliPhone = data.waliPhone || null;
  const program = await prisma.program.findFirst({
    where: {
      kind: data.programKind,
      isActive: true,
    },
    select: { id: true, name: true, registrationAvailability: true, registrationNote: true },
  });

  if (!program) {
    throw new ValidationError("Program yang dipilih belum tersedia");
  }

  if (program.registrationAvailability === "COMING_SOON") {
    throw new ValidationError(program.registrationNote || "Program ini segera dibuka. Silakan hubungi admin untuk informasi terbaru.");
  }

  const isWaitingList = program.registrationAvailability === "FULL";
  const duplicate = await prisma.pendaftaran.findFirst({
    where: {
      studentName: data.studentName,
      programId: program.id,
      status: { in: ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED"] },
      ...(waliEmail ? { waliEmail } : {}),
      ...(!waliEmail && waliPhone ? { waliPhone } : {}),
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
        isWaitingList,
        programId: program.id,
        participantType: data.participantType,
        studentName: data.studentName,
        studentNickname: data.studentNickname || null,
        studentGender: data.studentGender,
        studentBirthAt: parseBirthDate(data.studentBirthDate),
        address: data.address || null,
        schoolName: data.schoolName || null,
        gradeLevel: data.gradeLevel || null,
        programAnswers: (data.programAnswers ?? {}) as Prisma.InputJsonValue,
        waliName: data.waliName?.trim() || data.studentName,
        waliEmail,
        waliPhone,
        consentDataTruth: true,
        consentDataUse: true,
        consentContact: true,
        documentationConsent: data.consents.documentation,
        consentAt: new Date(),
        submittedAt: new Date(),
      },
      select: {
        id: true,
        kode: true,
        status: true,
        studentName: true,
        isWaitingList: true,
        waliEmail: true,
        createdAt: true,
        program: { select: { name: true } },
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

  await enqueuePendaftaranNotificationSafely("pendaftaran-submitted", () =>
    enqueuePendaftaranSubmitted({
      kode: pendaftaran.kode,
      studentName: pendaftaran.studentName,
      participantType: data.participantType,
      programName: program.name,
      waliName: data.waliName?.trim() || data.studentName,
      waliPhone: waliPhone,
      waliEmail: waliEmail,
    }),
  );

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

  const identitas = parsed.data.identitas;
  const identitasEmail = normalizeEmail(identitas);
  const identitasPhone = normalizePhone(identitas);
  const identityFilters: Prisma.PendaftaranWhereInput[] = [];

  if (identitasEmail.includes("@")) {
    identityFilters.push({ waliEmail: identitasEmail });
  }

  if (identitasPhone.length >= 8) {
    identityFilters.push({ waliPhone: identitasPhone });
  }

  if (identityFilters.length === 0) {
    throw new ValidationError("Masukkan email atau nomor WhatsApp yang valid");
  }

  const pendaftaran = await prisma.pendaftaran.findFirst({
    where: {
      kode: parsed.data.kode,
      OR: identityFilters,
    },
    select: {
      kode: true,
      status: true,
      studentName: true,
      rejectionReason: true,
      submittedAt: true,
      reviewedAt: true,
      participantType: true,
      program: { select: { name: true } },
    },
  });

  if (!pendaftaran) {
    throw new NotFoundError("Pendaftaran tidak ditemukan");
  }

  return { pendaftaran };
}

export async function listPendaftaran(actor: Actor, paginationInput: PaginationInput = {}, filters: PendaftaranListFilters = {}) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }

  const pagination = resolvePagination(paginationInput, 20);
  const where = buildPendaftaranWhere(filters);
  const [totalItems, items] = await Promise.all([
    prisma.pendaftaran.count({ where }),
    prisma.pendaftaran.findMany({
      where,
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
        participantType: true,
        submittedAt: true,
        isWaitingList: true,
         program: { select: { name: true, kind: true } },
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

export async function getPendaftaranExportData(actor: Actor, filters: PendaftaranListFilters = {}) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }

  const items = await prisma.pendaftaran.findMany({
    where: buildPendaftaranWhere(filters),
    orderBy: { createdAt: "desc" },
    take: PENDAFTARAN_EXPORT_LIMIT + 1,
    select: {
      id: true,
      kode: true,
      status: true,
      participantType: true,
      studentName: true,
      studentNickname: true,
      studentGender: true,
      studentBirthAt: true,
      address: true,
      schoolName: true,
      gradeLevel: true,
      programAnswers: true,
      waliName: true,
      waliEmail: true,
      waliPhone: true,
      documentationConsent: true,
      submittedAt: true,
      reviewedAt: true,
      rejectionReason: true,
      isWaitingList: true,
      program: { select: { name: true, kind: true } },
      files: {
        where: { deletedAt: null },
        select: { originalName: true },
      },
    },
  });

  return {
    items: items.slice(0, PENDAFTARAN_EXPORT_LIMIT),
    truncated: items.length > PENDAFTARAN_EXPORT_LIMIT,
  };
}

export async function recordPendaftaranExport(actor: Actor, input: { format: "PDF" | "XLSX"; filters: PendaftaranListFilters; rowCount: number; truncated: boolean }) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "PENDAFTARAN_EXPORTED",
      entityType: "Pendaftaran",
      metadata: {
        format: input.format,
        search: input.filters.search ?? null,
        status: input.filters.status ?? null,
        rowCount: input.rowCount,
        truncated: input.truncated,
      },
    },
  });
}

export async function recordPendaftaranDetailExport(actor: Actor, input: { format: "PDF" | "XLSX"; id: string; kode: string }) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "PENDAFTARAN_EXPORTED",
      entityType: "Pendaftaran",
      entityId: input.id,
      metadata: {
        scope: "detail",
        format: input.format,
        kode: input.kode,
      },
    },
  });
}

function buildPendaftaranWhere(filters: PendaftaranListFilters) {
  const search = filters.search?.trim().slice(0, 120);

  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(search ? { OR: [{ kode: { contains: search } }, { studentName: { contains: search } }, { studentNickname: { contains: search } }, { waliName: { contains: search } }, { waliEmail: { contains: search } }, { waliPhone: { contains: search } }] } : {}),
  };
}

export async function getPendaftaranSummary(actor: Actor) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }

  const [total, submitted, underReview, approved, rejected, cancelled] = await Promise.all([
    prisma.pendaftaran.count(),
    prisma.pendaftaran.count({ where: { status: "SUBMITTED" } }),
    prisma.pendaftaran.count({ where: { status: "UNDER_REVIEW" } }),
    prisma.pendaftaran.count({ where: { status: "APPROVED" } }),
    prisma.pendaftaran.count({ where: { status: "REJECTED" } }),
    prisma.pendaftaran.count({ where: { status: "CANCELLED" } }),
  ]);

  return { total, submitted, underReview, approved, rejected, cancelled, pending: submitted + underReview };
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

export async function updatePendaftaranContact(actor: Actor, id: string, input: unknown) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }

  const parsed = updatePendaftaranContactSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data kontak belum valid", parsed.error.flatten().fieldErrors);
  }

  const existing = await prisma.pendaftaran.findUnique({ where: { id }, select: { id: true } });

  if (!existing) {
    throw new NotFoundError("Pendaftaran tidak ditemukan");
  }

  const data: Prisma.PendaftaranUpdateInput = {};

  if (parsed.data.waliEmail !== undefined) {
    data.waliEmail = parsed.data.waliEmail ? normalizeEmail(parsed.data.waliEmail) : null;
  }

  if (parsed.data.waliPhone !== undefined) {
    data.waliPhone = parsed.data.waliPhone || null;
  }

  await prisma.pendaftaran.update({ where: { id }, data });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "PENDAFTARAN_CONTACT_UPDATED",
      entityType: "Pendaftaran",
      entityId: id,
      metadata: { fields: Object.keys(parsed.data) },
    },
  });

  return { success: true };
}

export async function approvePendaftaran(actor: Actor, id: string) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }

  const result = await prisma.$transaction(async (tx) => {
    const pendaftaran = await tx.pendaftaran.findUnique({
      where: { id },
      include: { program: true, approvedSiswa: true },
    });

    if (!pendaftaran) {
      throw new NotFoundError("Pendaftaran tidak ditemukan");
    }

    if (pendaftaran.status === "APPROVED" && pendaftaran.approvedSiswa) {
      return { pendaftaranId: pendaftaran.id, siswaId: pendaftaran.approvedSiswa.id, status: "APPROVED" as const, notification: null };
    }

    if (!["SUBMITTED", "UNDER_REVIEW"].includes(pendaftaran.status)) {
      throw new ConflictError("Pendaftaran tidak dapat disetujui dari status saat ini");
    }

    if (!pendaftaran.waliEmail) {
      throw new ConflictError("Email wali belum diisi. Lengkapi email pada detail pendaftaran sebelum menyetujui.");
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
        relationship: pendaftaran.participantType === "SELF" ? "Diri sendiri" : "Wali",
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

    return {
      pendaftaranId: pendaftaran.id,
      siswaId: siswa.id,
      status: "APPROVED" as const,
      notification: {
        kode: pendaftaran.kode,
        studentName: pendaftaran.studentName,
        participantType: pendaftaran.participantType,
        programName: pendaftaran.program.name,
        waliName: pendaftaran.waliName,
        waliEmail,
        waliPhone: pendaftaran.waliPhone,
        accountEmail: waliEmail,
        activationUrl: activation?.resetUrl ?? null,
      },
    };
  });

  const notification = result.notification;
  if (notification) {
    await enqueuePendaftaranNotificationSafely("pendaftaran-approved", () => enqueuePendaftaranApproved(notification));
  }

  return { pendaftaranId: result.pendaftaranId, siswaId: result.siswaId, status: result.status };
}

export async function rejectPendaftaran(actor: Actor, id: string, input: unknown) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }

  const parsed = rejectPendaftaranSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Alasan penolakan belum valid", parsed.error.flatten().fieldErrors);
  }

  const pendaftaran = await prisma.pendaftaran.findUnique({
    where: { id },
    include: { program: { select: { name: true } } },
  });

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
  ]);

  await enqueuePendaftaranNotificationSafely("pendaftaran-rejected", () =>
    enqueuePendaftaranRejected(
      {
        kode: pendaftaran.kode,
        studentName: pendaftaran.studentName,
        participantType: pendaftaran.participantType,
        programName: pendaftaran.program.name,
        waliName: pendaftaran.waliName,
        waliEmail: pendaftaran.waliEmail,
        waliPhone: pendaftaran.waliPhone,
      },
      parsed.data.reason,
    ),
  );

  return { success: true };
}
