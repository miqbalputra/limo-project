import "server-only";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "@/server/errors/application-error";
import { createSession, revokeSessionToken } from "@/server/auth/session";
import { hashPassword, normalizeEmail, verifyPassword } from "@/server/auth/password";
import { createPasswordResetGrant } from "@/server/auth/password-reset";
import type { Actor } from "@/server/auth/session";
import {
  adminUserListSchema,
  changePasswordSchema,
  createAdminUserSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  updateAdminUserSchema,
  userStatusSchema,
} from "@/server/validation/auth";
import { generateOpaqueToken, hashToken } from "@/server/security/crypto";
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
    ...(parsed.data.includeArchived ? {} : { deletedAt: null }),
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
      select: { id: true, email: true, name: true, role: true, status: true, lastLoginAt: true, deletedAt: true, _count: { select: { sessions: true } } },
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

function requireAdmin(actor: Actor) {
  if (actor.role !== "ADMIN") throw new ForbiddenError();
}

function logOnlyInDevelopment(url: string) {
  return process.env.NODE_ENV === "production" ? undefined : url;
}

const adminUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  deletedAt: true,
} as const;

export async function getAdminUser(actor: Actor, userId: string) {
  requireAdmin(actor);
  const item = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...adminUserSelect,
      guruProfile: { select: { id: true, phone: true, address: true } },
      waliProfile: { select: { id: true, phone: true, address: true } },
      _count: { select: { sessions: true } },
    },
  });
  if (!item) throw new NotFoundError("Pengguna tidak ditemukan");
  return { item };
}

export async function createAdminUser(actor: Actor, input: unknown) {
  requireAdmin(actor);
  const parsed = createAdminUserSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data pengguna belum valid", parsed.error.flatten().fieldErrors);

  const email = normalizeEmail(parsed.data.email);
  const phone = parsed.data.phone || undefined;
  const address = parsed.data.address || undefined;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, deletedAt: true } });
  if (existing && !existing.deletedAt) throw new ConflictError("Email sudah digunakan akun lain");
  if (existing && existing.role !== parsed.data.role) throw new ConflictError("Email sudah digunakan role lain");

  const grant = createPasswordResetGrant();

  const item = await prisma.$transaction(async (tx) => {
    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: { name: parsed.data.name, role: parsed.data.role, status: "ACTIVE", deletedAt: null },
        })
      : await tx.user.create({
          data: {
            email,
            name: parsed.data.name,
            role: parsed.data.role,
            status: "ACTIVE",
            passwordHash: await hashPassword(generateOpaqueToken(18)),
          },
        });

    if (parsed.data.role === "GURU") {
      await tx.guruProfile.upsert({
        where: { userId: user.id },
        update: { phone, address },
        create: { userId: user.id, phone, address },
      });
    } else if (parsed.data.role === "WALI") {
      await tx.waliProfile.upsert({
        where: { userId: user.id },
        update: { phone, address },
        create: { userId: user.id, phone, address },
      });
    }

    await tx.passwordResetToken.create({ data: { tokenHash: grant.tokenHash, userId: user.id, expiresAt: grant.expiresAt } });
    await tx.notifikasi.create({
      data: {
        channel: "email",
        template: "account-activation",
        recipient: email,
        subject: "Aktivasi Akun LIMO",
        body: `Atur password akun LIMO melalui: ${grant.resetUrl}`,
      },
    });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "USER_CREATED", entityType: "User", entityId: user.id, metadata: { role: parsed.data.role } } });

    return tx.user.findUniqueOrThrow({ where: { id: user.id }, select: adminUserSelect });
  });

  return { item, activationUrl: logOnlyInDevelopment(grant.resetUrl) };
}

export async function updateAdminUser(actor: Actor, userId: string, input: unknown) {
  requireAdmin(actor);
  const parsed = updateAdminUserSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data pengguna belum valid", parsed.error.flatten().fieldErrors);

  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!existing) throw new NotFoundError("Pengguna tidak ditemukan");
  if (existing.role === "SISWA") throw new ValidationError("Akun Siswa dikelola melalui modul Siswa");
  if (actor.id === userId && parsed.data.role !== "ADMIN") throw new ValidationError("Admin tidak dapat mengubah role akunnya sendiri");

  const email = normalizeEmail(parsed.data.email);
  const duplicate = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (duplicate && duplicate.id !== userId) throw new ConflictError("Email sudah digunakan akun lain");

  const phone = parsed.data.phone || null;
  const address = parsed.data.address || null;
  const roleChanged = existing.role !== parsed.data.role;
  const now = new Date();

  const item = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { name: parsed.data.name, email, role: parsed.data.role },
      select: adminUserSelect,
    });

    if (parsed.data.role === "GURU") {
      await tx.guruProfile.upsert({ where: { userId }, update: { phone, address }, create: { userId, phone, address } });
    } else if (parsed.data.role === "WALI") {
      await tx.waliProfile.upsert({ where: { userId }, update: { phone, address }, create: { userId, phone, address } });
    }

    if (roleChanged) {
      await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now, revokedById: actor.id } });
      await tx.auditLog.create({ data: { actorId: actor.id, action: "USER_ROLE_CHANGED", entityType: "User", entityId: userId, metadata: { from: existing.role, to: parsed.data.role } } });
    }

    await tx.auditLog.create({ data: { actorId: actor.id, action: "USER_UPDATED", entityType: "User", entityId: userId } });

    return user;
  });

  return { item };
}

export async function archiveAdminUser(actor: Actor, userId: string) {
  requireAdmin(actor);
  if (actor.id === userId) throw new ValidationError("Admin tidak dapat mengarsipkan akunnya sendiri");

  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, deletedAt: true } });
  if (!existing) throw new NotFoundError("Pengguna tidak ditemukan");
  if (existing.role === "SISWA") throw new ValidationError("Akun Siswa dikelola melalui modul Siswa");

  if (existing.role === "ADMIN" && !existing.deletedAt) {
    const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE", deletedAt: null } });
    if (activeAdmins <= 1) throw new ValidationError("Tidak dapat mengarsipkan admin terakhir");
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now, revokedById: actor.id } }),
    prisma.user.update({ where: { id: userId }, data: { status: "INACTIVE", deletedAt: now } }),
    prisma.auditLog.create({ data: { actorId: actor.id, action: "USER_ARCHIVED", entityType: "User", entityId: userId } }),
  ]);

  return { success: true };
}

export async function restoreAdminUser(actor: Actor, userId: string) {
  requireAdmin(actor);
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!existing) throw new NotFoundError("Pengguna tidak ditemukan");

  const item = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { status: "ACTIVE", deletedAt: null },
      select: adminUserSelect,
    });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "USER_RESTORED", entityType: "User", entityId: userId } });
    return user;
  });

  return { item };
}

async function issueUserPasswordLink(input: {
  actor: Actor;
  userId: string;
  email: string;
  template: "password-reset" | "account-activation";
  subject: string;
  action: string;
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
        body: `Atur password akun LIMO melalui: ${grant.resetUrl}`,
        metadata: { userId: input.userId },
      },
    }),
    prisma.auditLog.create({ data: { actorId: input.actor.id, action: input.action, entityType: "User", entityId: input.userId } }),
  ]);

  return grant.resetUrl;
}

export async function sendAdminUserPasswordReset(actor: Actor, userId: string) {
  requireAdmin(actor);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, deletedAt: true } });
  if (!user) throw new NotFoundError("Pengguna tidak ditemukan");
  if (user.deletedAt) throw new ConflictError("Akun sedang diarsipkan");

  const resetUrl = await issueUserPasswordLink({
    actor,
    userId: user.id,
    email: user.email,
    template: "password-reset",
    subject: "Reset Password LIMO",
    action: "USER_PASSWORD_RESET_SENT",
  });

  return { success: true, resetUrl: logOnlyInDevelopment(resetUrl) };
}

export async function resendAdminUserActivation(actor: Actor, userId: string) {
  requireAdmin(actor);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, deletedAt: true, lastLoginAt: true } });
  if (!user) throw new NotFoundError("Pengguna tidak ditemukan");
  if (user.deletedAt) throw new ConflictError("Akun sedang diarsipkan");
  if (user.lastLoginAt) throw new ConflictError("Akun sudah pernah login; gunakan kirim link reset password");

  const activationUrl = await issueUserPasswordLink({
    actor,
    userId: user.id,
    email: user.email,
    template: "account-activation",
    subject: "Aktivasi Akun LIMO",
    action: "USER_ACTIVATION_RESENT",
  });

  return { success: true, activationUrl: logOnlyInDevelopment(activationUrl) };
}

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
