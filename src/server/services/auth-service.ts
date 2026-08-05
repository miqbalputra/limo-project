import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "@/server/errors/application-error";
import { createSession, revokeSessionToken } from "@/server/auth/session";
import { hashPassword, normalizeEmail, verifyPassword } from "@/server/auth/password";
import { createPasswordResetGrant } from "@/server/auth/password-reset";
import type { Actor } from "@/server/auth/session";
import { changePasswordSchema, forgotPasswordSchema, loginSchema, resetPasswordSchema, userStatusSchema } from "@/server/validation/auth";
import { hashToken } from "@/server/security/crypto";
import { logger } from "@/server/logging/logger";
import { assertRateLimit, clearRateLimit } from "@/server/security/rate-limit";
import { createPaginationMeta, resolvePagination } from "@/server/pagination";

export async function login(input: unknown, context: { userAgent?: string | null; ipAddress?: string | null }) {
  const parsed = loginSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Email atau password belum valid", parsed.error.flatten().fieldErrors);
  }

  const identifier = parsed.data.identifier || parsed.data.email || "";
  const normalizedIdentifier = identifier.includes("@") ? normalizeEmail(identifier) : identifier.trim().toLowerCase();
  const throttleKey = `login:${context.ipAddress || "unknown"}:${normalizedIdentifier}`;
  assertRateLimit({
    key: throttleKey,
    limit: 5,
    windowMs: 15 * 60 * 1000,
    message: "Terlalu banyak percobaan login. Coba lagi nanti",
  });

  const user = await prisma.user.findFirst({
    where: identifier.includes("@")
      ? { email: normalizedIdentifier }
      : { OR: [{ email: normalizedIdentifier }, { siswaAccount: { loginIdentifier: normalizedIdentifier } }] },
    include: { siswaAccount: { select: { id: true, status: true } } },
  });

  if (!user || user.status !== "ACTIVE" || user.deletedAt || (user.role === "SISWA" && (!user.siswaAccount || user.siswaAccount.status !== "ACTIVE"))) {
    await writeAuditLog({
      action: "AUTH_LOGIN_FAILED",
      entityType: "User",
      entityId: user?.id,
      reason: "invalid_user",
      ipAddress: context.ipAddress,
    });
    throw new UnauthorizedError("Email atau password tidak sesuai");
  }

  const passwordValid = await verifyPassword(user.passwordHash, parsed.data.password);

  if (!passwordValid) {
    await writeAuditLog({
      actorId: user.id,
      action: "AUTH_LOGIN_FAILED",
      entityType: "User",
      entityId: user.id,
      reason: "invalid_password",
      ipAddress: context.ipAddress,
    });
    throw new UnauthorizedError("Email atau password tidak sesuai");
  }

  const session = await createSession({
    userId: user.id,
    userAgent: context.userAgent,
    ipAddress: context.ipAddress,
  });

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });
    if (user.siswaAccount) {
      await tx.siswaAccount.update({ where: { id: user.siswaAccount.id }, data: { lastLoginAt: now } });
    }
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "AUTH_LOGIN_SUCCESS",
        entityType: "User",
        entityId: user.id,
        ipAddress: context.ipAddress?.slice(0, 64),
      },
    });
  });

  clearRateLimit(throttleKey);

  return {
    session,
    actor: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

export async function logout(token: string | undefined) {
  await revokeSessionToken(token);
}

export async function requestPasswordReset(input: unknown, context: { requestId: string }) {
  const parsed = forgotPasswordSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Email belum valid", parsed.error.flatten().fieldErrors);
  }

  const email = normalizeEmail(parsed.data.email);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.status !== "ACTIVE" || user.deletedAt) {
    return { success: true };
  }

  const grant = createPasswordResetGrant();

  await prisma.$transaction([
    prisma.passwordResetToken.create({
      data: { tokenHash: grant.tokenHash, userId: user.id, expiresAt: grant.expiresAt },
    }),
    prisma.notifikasi.create({
      data: {
        channel: "email",
        template: "password-reset",
        recipient: user.email,
        subject: "Reset Password LIMO",
        body: `Gunakan tautan berikut untuk mengatur ulang password: ${grant.resetUrl}`,
        metadata: { expiresAt: grant.expiresAt.toISOString() },
      },
    }),
  ]);

  await writeAuditLog({
    actorId: user.id,
    action: "AUTH_PASSWORD_RESET_REQUESTED",
    entityType: "User",
    entityId: user.id,
  });

  logger.info("Password reset token created", {
    requestId: context.requestId,
    userId: user.id,
    resetUrlDevOnly: process.env.NODE_ENV === "production" ? undefined : grant.resetUrl,
  });

  return { success: true };
}

export async function resetPassword(input: unknown) {
  const parsed = resetPasswordSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Token atau password belum valid", parsed.error.flatten().fieldErrors);
  }

  const tokenHash = hashToken(parsed.data.token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { siswaAccount: { select: { id: true, status: true } } } } },
  });

  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt <= new Date() ||
    resetToken.user.status !== "ACTIVE" ||
    resetToken.user.deletedAt
  ) {
    throw new UnauthorizedError("Token reset password tidak valid atau sudah kedaluwarsa");
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.session.updateMany({
      where: {
        userId: resetToken.userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        actorId: resetToken.userId,
        action: "AUTH_PASSWORD_RESET_COMPLETED",
        entityType: "User",
        entityId: resetToken.userId,
      },
    }),
    ...(resetToken.user.role === "SISWA" && resetToken.user.siswaAccount?.status === "PENDING"
      ? [prisma.siswaAccount.update({ where: { id: resetToken.user.siswaAccount.id }, data: { status: "ACTIVE", activatedAt: new Date() } })]
      : []),
  ]);

  return { success: true };
}

export async function changePassword(actor: Actor, input: unknown) {
  const parsed = changePasswordSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Password belum valid", parsed.error.flatten().fieldErrors);
  }

  const user = await prisma.user.findUnique({ where: { id: actor.id } });

  if (!user || user.status !== "ACTIVE" || user.deletedAt) {
    throw new UnauthorizedError();
  }

  if (!(await verifyPassword(user.passwordHash, parsed.data.currentPassword))) {
    throw new UnauthorizedError("Password saat ini tidak sesuai");
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({ where: { id: actor.id }, data: { passwordHash } }),
    prisma.session.updateMany({
      where: { userId: actor.id, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "AUTH_PASSWORD_CHANGED",
        entityType: "User",
        entityId: actor.id,
      },
    }),
  ]);

  return { success: true };
}

export async function listUsers(actor: Actor, input: unknown = {}) {
  if (actor.role !== "ADMIN") throw new ForbiddenError();
  const parsed = adminUserListSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Filter pengguna belum valid", parsed.error.flatten().fieldErrors);
  const pagination = resolvePagination(parsed.data, 20);
  const where = {
    deletedAt: null,
    ...(parsed.data.search ? { OR: [{ name: { contains: parsed.data.search } }, { email: { contains: parsed.data.search } }] } : {}),
    ...(parsed.data.role ? { role: parsed.data.role } : {}),
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
  };
  const [totalItems, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { name: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
      select: { id: true, email: true, name: true, role: true, status: true, lastLoginAt: true, _count: { select: { sessions: true } } },
    }),
  ]);
  return { items, pagination: createPaginationMeta(pagination.page, pagination.pageSize, totalItems), filters: parsed.data };
}

export async function setUserStatus(actor: Actor, userId: string, input: unknown) {
  if (actor.role !== "ADMIN") throw new ForbiddenError();
  if (actor.id === userId) throw new ValidationError("Admin tidak dapat menonaktifkan akunnya sendiri");
  const parsed = userStatusSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Status user belum valid", parsed.error.flatten().fieldErrors);
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!existing) throw new NotFoundError("User tidak ditemukan");
  const now = new Date();
  const [, item] = await prisma.$transaction([
    prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now, revokedById: actor.id } }),
    prisma.user.update({
      where: { id: userId },
      data: { status: parsed.data.status },
      select: { id: true, email: true, name: true, role: true, status: true, lastLoginAt: true },
    }),
    prisma.auditLog.create({ data: { actorId: actor.id, action: `USER_${parsed.data.status}`, entityType: "User", entityId: userId } }),
  ]);
  return { item };
}

export async function revokeUserSessions(actor: Actor, userId: string) {
  if (actor.role !== "ADMIN") throw new ForbiddenError();
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!existing) throw new NotFoundError("User tidak ditemukan");
  const result = await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedById: actor.id },
  });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "USER_SESSIONS_REVOKED", entityType: "User", entityId: userId, metadata: { count: result.count } } });
  return { revoked: result.count };
}

const adminUserListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).default(""),
  role: z.enum(["ADMIN", "GURU", "WALI", "SISWA"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

async function writeAuditLog(input: {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  reason?: string;
  ipAddress?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      reason: input.reason,
      ipAddress: input.ipAddress?.slice(0, 64),
    },
  });
}
