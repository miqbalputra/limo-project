import "server-only";

import type { Actor } from "@/server/auth/session";
import { hashPassword, normalizeEmail } from "@/server/auth/password";
import { createPasswordResetGrant } from "@/server/auth/password-reset";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { requireFeature } from "@/server/features/feature-flags";
import { generateOpaqueToken } from "@/server/security/crypto";
import { createSiswaAccountSchema, updateSiswaAccountStatusSchema } from "@/server/validation/student-account";

function requireAdmin(actor: Actor) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }
}

function normalizeIdentifier(value: string) {
  return value.trim().toLowerCase();
}

function createSyntheticEmail(nomorInduk: string) {
  const safeIdentifier = normalizeIdentifier(nomorInduk).replace(/[^a-z0-9._-]/g, "-");
  return `siswa-${safeIdentifier}@student.limo.local`;
}

function selectAccount() {
  return {
    id: true,
    loginIdentifier: true,
    contactEmail: true,
    status: true,
    activatedAt: true,
    lastLoginAt: true,
    user: { select: { id: true, email: true, name: true, status: true } },
  } as const;
}

export async function getSiswaAccount(actor: Actor, siswaId: string) {
  requireAdmin(actor);
  requireFeature("studentPortalEnabled", "Portal Siswa belum diaktifkan");

  const item = await prisma.siswaAccount.findUnique({ where: { siswaId }, select: selectAccount() });
  return { item };
}

export async function createSiswaAccount(actor: Actor, siswaId: string, input: unknown) {
  requireAdmin(actor);
  requireFeature("studentPortalEnabled", "Portal Siswa belum diaktifkan");

  const parsed = createSiswaAccountSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Data akun siswa belum valid", parsed.error.flatten().fieldErrors);
  }

  const siswa = await prisma.siswa.findUnique({
    where: { id: siswaId },
    select: { id: true, name: true, nomorInduk: true, status: true, deletedAt: true, siswaAccount: { select: { id: true } } },
  });
  if (!siswa || siswa.deletedAt || siswa.status === "ARCHIVED") throw new NotFoundError("Siswa tidak ditemukan");
  if (siswa.siswaAccount) throw new ConflictError("Siswa sudah memiliki akun");

  const loginIdentifier = normalizeIdentifier(parsed.data.loginIdentifier || siswa.nomorInduk);
  const contactEmail = parsed.data.email ? normalizeEmail(parsed.data.email) : null;
  const email = contactEmail || createSyntheticEmail(siswa.nomorInduk);
  const [existingEmail, existingIdentifier] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.siswaAccount.findUnique({ where: { loginIdentifier }, select: { id: true } }),
  ]);
  if (existingEmail) throw new ConflictError("Email akun sudah digunakan");
  if (existingIdentifier) throw new ConflictError("Identifier login siswa sudah digunakan");

  const activation = createPasswordResetGrant();
  const item = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: siswa.name,
        passwordHash: await hashPassword(generateOpaqueToken(18)),
        role: "SISWA",
        status: "ACTIVE",
      },
    });
    const account = await tx.siswaAccount.create({
      data: {
        siswaId: siswa.id,
        userId: user.id,
        loginIdentifier,
        contactEmail,
        status: "PENDING",
      },
      select: selectAccount(),
    });

    await tx.passwordResetToken.create({ data: { tokenHash: activation.tokenHash, userId: user.id, expiresAt: activation.expiresAt } });
    await tx.notifikasi.create({
      data: {
        channel: contactEmail ? "email" : "in_app",
        template: "student-account-activation",
        recipient: email,
        subject: "Aktivasi Akun Siswa LIMO",
        body: `Akun siswa ${siswa.name} siap diaktifkan. Identifier login: ${loginIdentifier}. Atur password melalui: ${activation.resetUrl}`,
        metadata: { siswaId: siswa.id, userId: user.id },
      },
    });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "SISWA_ACCOUNT_CREATED", entityType: "SiswaAccount", entityId: account.id, metadata: { siswaId: siswa.id, loginIdentifier } } });
    return account;
  });

  return { item, activationUrl: activation.resetUrl };
}

export async function resendSiswaActivation(actor: Actor, siswaId: string) {
  requireAdmin(actor);
  requireFeature("studentPortalEnabled", "Portal Siswa belum diaktifkan");

  const account = await prisma.siswaAccount.findUnique({
    where: { siswaId },
    select: { id: true, status: true, userId: true, loginIdentifier: true, user: { select: { email: true } }, siswa: { select: { name: true } } },
  });
  if (!account) throw new NotFoundError("Akun siswa belum dibuat");
  if (account.status === "ACTIVE") throw new ConflictError("Akun siswa sudah aktif");

  const activation = createPasswordResetGrant();
  await prisma.$transaction([
    prisma.passwordResetToken.create({ data: { tokenHash: activation.tokenHash, userId: account.userId, expiresAt: activation.expiresAt } }),
    prisma.notifikasi.create({
      data: {
        channel: account.user.email.endsWith("@student.limo.local") ? "in_app" : "email",
        template: "student-account-activation",
        recipient: account.user.email,
        subject: "Aktivasi Akun Siswa LIMO",
        body: `Akun siswa ${account.siswa.name} belum aktif. Identifier login: ${account.loginIdentifier}. Atur password melalui: ${activation.resetUrl}`,
        metadata: { siswaId, userId: account.userId },
      },
    }),
    prisma.auditLog.create({ data: { actorId: actor.id, action: "SISWA_ACCOUNT_ACTIVATION_RESENT", entityType: "SiswaAccount", entityId: account.id } }),
  ]);

  return { activationUrl: activation.resetUrl };
}

export async function updateSiswaAccountStatus(actor: Actor, siswaId: string, input: unknown) {
  requireAdmin(actor);
  requireFeature("studentPortalEnabled", "Portal Siswa belum diaktifkan");

  const parsed = updateSiswaAccountStatusSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Status akun siswa belum valid", parsed.error.flatten().fieldErrors);
  const account = await prisma.siswaAccount.findUnique({ where: { siswaId }, select: { id: true, userId: true, status: true } });
  if (!account) throw new NotFoundError("Akun siswa belum dibuat");

  const now = new Date();
  const item = await prisma.$transaction(async (tx) => {
    if (parsed.data.status === "INACTIVE") {
      await tx.session.updateMany({ where: { userId: account.userId, revokedAt: null }, data: { revokedAt: now, revokedById: actor.id } });
    }
    await tx.user.update({ where: { id: account.userId }, data: { status: parsed.data.status } });
    const updated = await tx.siswaAccount.update({
      where: { id: account.id },
      data: { status: parsed.data.status, ...(parsed.data.status === "ACTIVE" && account.status !== "ACTIVE" ? { activatedAt: now, activatedById: actor.id } : {}) },
      select: selectAccount(),
    });
    await tx.auditLog.create({ data: { actorId: actor.id, action: `SISWA_ACCOUNT_${parsed.data.status}`, entityType: "SiswaAccount", entityId: account.id } });
    return updated;
  });

  return { item };
}
