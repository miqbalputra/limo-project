import "server-only";
import { hashPassword } from "@/server/auth/password";
import type { Actor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { setUserPasswordSchema } from "@/server/validation/auth";

export async function setAccountPassword(actor: Actor, userId: string, input: unknown) {
  await requirePermission(actor, "admin.people.manage");

  if (actor.id === userId) {
    throw new ConflictError("Gunakan halaman Ubah Password untuk akun Anda sendiri");
  }

  const parsed = setUserPasswordSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Password belum valid", parsed.error.flatten().fieldErrors);
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, deletedAt: true } });
  if (!user) {
    throw new NotFoundError("Pengguna tidak ditemukan");
  }
  if (user.deletedAt) {
    throw new ConflictError("Akun sedang diarsipkan");
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const now = new Date();
  const reason = parsed.data.reason || undefined;

  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });

    const revoked = await tx.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now, revokedById: actor.id },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "USER_PASSWORD_SET",
        entityType: "User",
        entityId: user.id,
        reason,
        metadata: { sessionsRevoked: revoked.count },
      },
    });

    return { success: true, sessionsRevoked: revoked.count };
  });
}
